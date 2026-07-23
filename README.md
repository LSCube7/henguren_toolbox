# 恨古人工具箱 v3

恨古人工具箱 v3 是基于 Next.js App Router 的重构版本。v3 聚焦新的 Material Design 3 风格 UI、LSCube OAuth 登录、云端错题本、设置同步，以及现有学习工具的逐步迁移。

v3 的界面使用官方 Material Web 实现 Material Design 3 风格：无顶栏、侧边导航抽屉、卡片化工具入口、设置面板和状态提示。它仍然是普通学习工具箱，不是云服务控制台。

## 分支说明

| 分支 | 状态 | 说明 |
| --- | --- | --- |
| `main` | v3.0.0 | Next.js + TypeScript 重构主线 |
| `v2` | 冻结归档 | Vue CLI 版本，保留 v2.10.0 状态 |

当前 Vue 版本已归档为 `v2` 分支，并建议与 `v2.10.0` 标签一起作为历史版本保留。

## v3 迁移状态

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 首页与全局布局 | 已迁移 | Material Web 工具箱布局、侧边导航抽屉、卡片入口 |
| 寻找实词 | 已迁移 | 改用安全 React 节点高亮 |
| 文学常识 | 已迁移 | 沿用 v2 JSON 数据 |
| 单词测试 | 已迁移 | 多选单元、自定义词表、测试结果、掌握度复习、错题本、导入导出、云同步 |
| 课文测试 | 已迁移 | 课文范围选择、分级随机挖空、逐句反馈与结果统计 |
| 设置页 | 已迁移 | 本地设置、主题种子色、颜色模式、测试偏好、云端同步 API |
| 用户页 | 已迁移 | LSCube OAuth 登录入口、退出与同步说明 |
| 云端错题本 | 已初始化 | R2 整包同步、覆盖上传与合并上传 |

## 界面语言

界面目前支持简体中文（`zh-CN`）和英语（`en-US`）。用户可以在“个人设置 → 界面语言”中切换；语言偏好保存在现有的 `henguren-v3-settings` 设置对象中，并可随设置显式同步。

- 支持的语言、默认语言和插值逻辑位于 `src/i18n/config.ts`。
- 简体中文词典位于 `src/i18n/locales/zh-CN.ts`。
- 英语词典位于 `src/i18n/locales/en-US.ts`。
- 客户端组件通过 `useI18n()` 获取当前语言和 `t()` 翻译函数。

新增界面文案时，应先使用稳定的语义键补充简体中文词典，再补充其他语言文件。英语词典通过 TypeScript 约束为与简体中文词典具有相同键集合，缺少或多余的键会在类型检查中报错。学习数据本身（例如古文原文、词义和课文内容）不属于界面词典，不应因界面语言切换而改写。

开启“开发者模式”后，可以进一步开启“显示翻译键名”。此时界面和页面标题会直接显示 `nav.settings`、`app.name` 等语言文件键名，便于审核文案是否已纳入词典；关闭开发者模式会立即恢复正常翻译，但保留该审核开关的本机偏好。


## 开发

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

## 持续集成与发布

- 提交到 `dev` 或 `main` 的拉取请求会自动运行 lint、类型检查和生产构建。
- `main` 收到新提交后，发布工作流会再次完成上述检查，并按 `package.json` 中的版本创建 `v<version>` GitHub Release。
- 发布前必须先更新 `package.json` 中的版本。若对应标签已经存在，工作流会停止，不会覆盖已有 Release。
- Release 使用仓库自带的 `GITHUB_TOKEN` 创建，不需要额外配置发布密钥；发布说明包含中文说明和 GitHub 自动生成的变更记录。

Material Symbols 使用本地子集字体。新增图标时，先将名称加入 `config/material-symbols.json`，再重新生成并检查产物：

```bash
pnpm run fonts:build
pnpm run fonts:check
```

生产构建会自动检查图标清单、类型定义和字体文件是否一致，生成过程不访问网络。

## 环境变量

复制 `.env.example` 到 `.env.local` 后填写：

- `OAUTH_AUTHORIZE_URL`
- `OAUTH_TOKEN_URL`
- `OAUTH_USERINFO_URL`
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`（可选；OAuth 流程默认启用 PKCE S256）
- `OAUTH_CLIENT_AUTH_METHOD`（可选：`none`、`post`、`basic`）
- `OAUTH_REDIRECT_URI`
- `OAUTH_SCOPE`
- `SESSION_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## 云端错题本模型

v3 首版采用“本地优先、整包同步”的错题本模型：

- 未登录时，错题本保存在浏览器 IndexedDB。
- 登录后，可通过 API 拉取、上传或合并云端错题本。
- R2 路径使用 `wrongbooks/{userId}/current.json` 和 `wrongbooks/{userId}/backups/{timestamp}.json`。
- 错误事件使用唯一 ID 合并，避免多设备同时新增错误时丢失计数；记录和批次删除会保留删除标记，防止旧云端快照将其恢复。
- v1 错题本快照会在读取或导入时兼容迁移到 v2，批次名称与对应测试编号会作为同一错误事件保存。

## 本地数据与离线管理

- 设置页可以统一导出和合并导入设置、学习阶段、初始向导、错题本与掌握度数据。
- 统一备份不会包含开发者模式的 R2 访问密钥或自定义同步源凭据。
- 可以一键缓存全部单词单元与课文，查看缓存条目、本站占用和浏览器配额，或单独清除离线缓存。

## License

MIT License
