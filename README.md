# 恨古人工具箱

面向语文与英语学习的工具箱，支持文言实词查找、文学常识、单词测试、课文挖空练习和错题复习。学习工具无需登录即可使用；登录 CubeID 后，可在不同设备间同步错题本与掌握度。

项目采用 Next.js App Router、React 和 TypeScript，界面通过第三方 M3E 组件库实现 Material 3 Expressive，支持简体中文和英语、主题配色与离线使用。M3E 并非 Google 官方组件库。

## 功能

| 功能 | 说明 |
| --- | --- |
| 寻找实词 | 高亮 150 个文言实词，查看与复制释义，导出 TeX |
| 文学常识 | 按篇名、作者、出处和年级筛选 |
| 单词测试 | 选择多个单元或导入自定义词表，设置数量、释义语言和首字母提示，生成打印练习 |
| 错题复习 | 自动记录错题，按掌握度安排复习，支持筛选、导入导出和账户同步 |
| 课文测试 | 选择课文范围与挖空难度，逐句作答并查看结果 |
| 数据与离线管理 | 备份本机设置与学习数据，缓存单词和课文，查看存储用量 |

首次访问可直接开始学习。首页提供可关闭的欢迎卡片和功能导览，个人设置中可重新查看导览或打开个性化设置。

界面语言可在“个人设置 → 界面语言”中切换。页面使用 `/zh-CN/` 和 `/en-US/` 语言前缀，例如 `/zh-CN/vocab`；旧的无前缀地址会根据已保存偏好或浏览器语言跳转。切换界面语言不会翻译学习材料。

## 生产部署

### 运行要求

- Node.js 26 LTS（项目固定为 26.13.0）和 pnpm 12.18.0。版本分别记录在 `.node-version` 与 `package.json` 的 `packageManager`，CI 读取同一声明。
- 可运行 Next.js 服务端的部署环境，支持 Route Handlers、Cookie 和服务端网络请求。当前项目不能按纯静态站点部署。
- 生产域名使用 HTTPS。生产模式下登录 Cookie 带有 `Secure` 标记，离线功能也依赖浏览器安全上下文。
- 开启登录与云同步时，服务端需要能够访问 CubeID 的 OAuth 服务和 Cloudflare R2。

本地学习功能不依赖云端数据库。若不配置 OAuth 和 R2，仍可使用本机学习工具，但登录或云同步不能正常工作。

### 安装与启动

在选定版本的源代码目录中安装锁定依赖：

```bash
pnpm install --frozen-lockfile
```

pnpm 按 `devEngines.runtime` 获取项目固定的 Node 运行时，并用于项目脚本；首次安装可能访问 Node.js 官方下载源。使用 `pnpm exec node --version` 和 `pnpm --version` 确认项目版本，部署环境也应选择 Node 26。项目级 pnpm 配置位于 `pnpm-workspace.yaml`。

根据下文配置环境变量。自托管时可以复制 [`.env.example`](.env.example) 为 `.env.local`；托管平台则通过其环境变量管理功能配置。示例中的 OAuth 地址和会话密钥都是占位值，不能直接用于生产。

```bash
pnpm run build
pnpm start
```

默认端口为 `3000`，需要时可指定：

```bash
pnpm start --port 3001
```

使用反向代理时，将应用请求转发到 Next.js 服务，并确保登录流程使用同一生产域名。账户、登录和同步接口不应使用共享缓存；学习数据接口由应用自身的离线策略管理。生产服务使用 `pnpm start`，不要使用开发服务器 `pnpm dev`。

构建会执行字体一致性检查，因此构建阶段需要安装开发依赖。环境变量变更后应重新启动应用；云端密钥和会话密钥仅供服务端使用，不要添加 `NEXT_PUBLIC_` 前缀。

### 环境变量

| 变量 | 用途与要求 |
| --- | --- |
| `OAUTH_AUTHORIZE_URL` | CubeID 授权地址；启用登录时必填 |
| `OAUTH_TOKEN_URL` | 授权码交换地址；启用登录时必填 |
| `OAUTH_USERINFO_URL` | 用户信息地址；启用登录时必填 |
| `OAUTH_CLIENT_ID` | 登录应用的客户端 ID；启用登录时必填 |
| `OAUTH_CLIENT_SECRET` | 按登录应用类型配置；公开客户端可不填 |
| `OAUTH_CLIENT_AUTH_METHOD` | 可选：`none`、`post` 或 `basic`；未指定时，有客户端密钥默认 `post`，否则默认 `none` |
| `OAUTH_REDIRECT_URI` | 生产环境应显式设为 `https://你的域名/api/auth/callback`，并与登录服务登记的回调地址完全一致 |
| `OAUTH_SCOPE` | 可选，默认 `openid profile email` |
| `SESSION_SECRET` | 启用登录时必填；使用独立、足够长的随机值，用于签名会话 |
| `R2_ACCOUNT_ID` | 云同步使用的 R2 账户 ID |
| `R2_ACCESS_KEY_ID` | 云同步使用的 R2 访问密钥 ID |
| `R2_SECRET_ACCESS_KEY` | 云同步使用的 R2 访问密钥 |
| `R2_BUCKET_NAME` | 云同步使用的存储桶名称 |

OAuth 使用授权码流程和 PKCE S256。多实例部署应使用一致的 `SESSION_SECRET`；更换该值会使已有登录会话失效。请将生产密钥保存在部署环境的密钥管理中，不要提交到仓库。

`.env.example` 中的 `R2_TEST_*` 仅用于隔离联调，不是生产配置，不能指向正式存储桶。

### R2 与同步

生产同步通过服务端访问 R2。为应用准备专用的私有存储桶和能够读写该桶对象的凭据；无需向浏览器公开这些凭据或开放存储桶的公共访问。

| 对象路径 | 内容 |
| --- | --- |
| `wrongbooks/{userId}/current.json` | 账户错题本与掌握度快照 |
| `wrongbooks/{userId}/backups/{timestamp}.json` | 学习数据修改前或候选快照的备份 |
| `settings/{userId}/current.json` | 用户主动同步的设置 |

默认同步由浏览器请求本站服务端，再由服务端访问 R2，不需要为此开放浏览器跨域访问。开发者模式中的自定义 R2 同步源不同：它由浏览器直接访问，需配置对应 CORS，且凭据保存在本机浏览器，仅适合自行管理的个人或测试环境。

### 上线检查

在准备发布的部署环境中确认：

1. 简体中文和英语页面均能打开，主要学习工具可使用。
2. CubeID 登录、回调和退出正常，回调始终回到生产域名。
3. 使用测试账户验证错题合并同步和设置同步，确认 R2 中出现对应对象。
4. 缓存学习材料后断网，确认本地工具仍可用、云同步显示离线；恢复网络后可继续同步。
5. 更新部署后确认出现刷新更新提示，并能加载新版本。

需要运行 R2 联调脚本时，使用独立测试桶与虚构账户，按[隔离联调说明](docs/vocab-cloud-sync-integration.md)操作，不要在正式桶执行测试。

## 数据保存与维护

错题本和掌握度优先保存在本机，并按账户分别保存。登录账户默认开启自动合并同步，可在同步面板关闭；设备设置和开发者自定义同步源始终需要手动同步。访客数据需确认后才会转入账户，转入后可能随账户自动同步到云端。

- 自动同步依赖页面运行和网络连接，关闭页面前应确认同步完成。
- 云端写入使用版本条件保护；覆盖前会备份，备份失败则不执行覆盖。掌握度按较新完整记录合并，多设备同时复习的进度不会累加。
- 主动退出或切换账户时，仅移除已成功上传且之后未修改的本机学习数据；未同步修改保留在原账户。会话过期或离线不会清理学习数据。
- 完整测试历史、未完成测试和导入的临时自定义词表不在自动同步范围内。
- 旧版未记录明确关闭选择的自动同步设置会在升级时改为开启；升级后主动关闭的选择会保留。

用户可在“个人设置 → 数据与离线管理”导出本机备份或合并导入备份。备份包含设置、学习阶段、向导状态、错题本和掌握度，不包含开发者同步源凭据。清除浏览器站点数据可能丢失未备份、未同步的本机数据；清除离线缓存则不删除错题本、掌握度和设置。

云端学习快照备份不能替代完整备份方案：设置仅有当前快照。维护者应根据需要保留 R2 数据备份，配置与密钥另行安全保存。更新或回滚应用时也应考虑已有用户数据格式，避免用旧版本覆盖新数据。

离线功能由自定义 Service Worker 提供，仅在生产模式启用。它缓存页面、静态资源和学习材料，不缓存登录、账户和学习同步请求。用户首次离线使用某份材料前，需要先联网打开或缓存；浏览器也可能因存储空间限制清理离线内容。

同步细节见[学习数据同步](docs/vocab-cloud-sync-phase-1.md)、[自动同步](docs/vocab-cloud-sync-auto.md)和[错题本交互](docs/wrongbook-interactions.md)。

## 开发与验证

```bash
pnpm install --frozen-lockfile
pnpm dev
```

提交前执行与 CI 相同的检查：

```bash
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run build
```

Material Symbols 使用本地子集字体。新增图标后更新 `config/material-symbols.json`，再执行：

```bash
pnpm run fonts:build
pnpm run fonts:check
```

字体生成不访问网络，生产构建会检查图标清单与生成文件是否一致。

界面规范、主题、HCT 选色器和组件约定见 [Material 3 Expressive 文档](docs/material-3-expressive.md)。翻译位于 `src/i18n/locales/`；新增文案需同时维护简体中文和英语，键集合由 TypeScript 检查。开发者模式可显示翻译键名，便于审核。

## 分支与发布

| 分支 | 用途 |
| --- | --- |
| `main` | 发布主线；具体版本以 [GitHub Releases](https://github.com/LSCube7/henguren_toolbox/releases) 为准 |
| `dev` | 日常开发与集成，功能和修复 PR 的目标分支 |
| `v2` | 历史 Vue 版本 |

PR 由仓库所有者手动 Review，CI 会执行测试、lint、类型检查和生产构建。发布时更新 `package.json` 中的版本，从 `dev` 向 `main` 创建发布 PR，并使用 Merge commit 合并。

`main` 的发布工作流在检查通过后按 `package.json` 的版本创建 `v<version>` 标签和 GitHub Release；标签已存在时会停止。该流程不负责部署站点，运行环境的部署需另行配置。v3.2.2 的变化与升级说明见[发布说明](docs/releases/v3.2.2.md)。

## 许可

[MIT License](LICENSE)
