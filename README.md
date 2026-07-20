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
| 课文测试 | 占位预览 | 已迁移课文选择与预览，挖空测试待继续完善 |
| 设置页 | 已迁移 | 本地设置、主题种子色、颜色模式、测试偏好、云端同步 API |
| 用户页 | 已迁移 | LSCube OAuth 登录入口、退出与同步说明 |
| 云端错题本 | 已初始化 | R2 整包同步、覆盖上传与合并上传 |

## 开发

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

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
- 合并策略按 `sourceName + word` 聚合记录，并合并义项、批次与错误次数。

## License

MIT License
