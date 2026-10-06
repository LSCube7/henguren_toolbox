# 隔离 R2 联调

仅使用独立测试桶和虚构账户，凭据通过本地环境文件提供，不纳入 Git。测试配置：

```dotenv
R2_TEST_ACCOUNT_ID=
R2_TEST_ACCESS_KEY_ID=
R2_TEST_SECRET_ACCESS_KEY=
R2_TEST_BUCKET_NAME=henguren-toolbox-test
```

权限需要覆盖该测试桶的对象读取、写入、删除及按测试前缀列举。桶需事先创建；脚本不自动创建或删除桶，不回退到正式桶。测试桶名不得与配置中的 `R2_BUCKET_NAME` 相同。临时凭据过期后需重新配置。

先按项目现有流程完成生产构建，再运行：

```bash
pnpm run build
node --env-file=.env.test --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-r2-sync.mjs
```

脚本使用已有 AWS SDK、R2 辅助函数与学习快照合并逻辑。每次生成随机 `integration-<uuid>` 账户，仅操作 `wrongbooks/<测试账户>/`。它会启动只监听本机的生产服务，使用独立随机会话签名密钥验证实际 API，不使用真实 OAuth 会话。

验证内容：

- 不存在对象的 GET/HEAD，以及读写后的 ETag 一致性。
- 首次写入 `If-None-Match`，更新 `If-Match`，旧版本拒绝写入。
- 修改前快照与候选快照备份；无内容变化时不写入、不备份。
- 覆盖确认版本过期时拒绝覆盖。
- 分别在旧版本与候选备份阶段触发真实 R2 条件写入拒绝，确认当前对象不变。
- 两台模拟设备同时读到同一版本后合并，确认冲突重读保留两方错题与掌握度。
- 实际 API 的未登录、目标不匹配、版本查询、拉取、合并、覆盖和旧版本保护。

结束时停止本机测试服务，清理本次账户前缀下的对象，保留测试桶。对象删除采用有限重试，之后再次列举该前缀确认无残留。失败只记录测试阶段、错误类型、状态码和必要的测试行号，不记录密钥、签名会话或 SDK 原始响应。清理失败会退出为失败，并报告测试账户 ID，便于针对该前缀处理。不要扩大清理范围。

Cloudflare 官方能力说明：[S3 API 兼容性](https://developers.cloudflare.com/r2/api/s3/api/)。

## 认证失效浏览器回归

本机生产服务启动后，可使用已有 Playwright 运行环境执行：

```bash
pnpm start --port 3016
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-sync-session.mjs
```

可配置 `PLAYWRIGHT_MODULE_PATH` 指向已有 Playwright 模块，`BROWSER_CHANNEL` 默认为 `msedge`，`SYNC_TEST_BASE_URL` 默认为 `http://localhost:3016`。脚本只接受本机地址，使用隔离浏览器上下文并模拟账户、同步请求和学习分区，不读取真实浏览器会话，不写 R2。

覆盖账户查询成功但初次同步概况、手动上传或版本查询返回 401 的情况：清除显示身份、显示重新登录、暂停自动重试、保留本机数据及开关偏好，并在重新登录后恢复。

## 本次验证结果

2026-10-06，在独立 `henguren-toolbox-test` 桶使用 24 小时有效期的测试凭据完成上述 R2 和本机生产 API 联调。最终运行及测试对象清理均通过，正式桶未读写。首次建桶使用既有凭据时返回 403，改用用户提供的测试凭据后创建成功；首次测试桶尚未创建时返回 404，未写入对象。中途测试断言已按 JSON 序列化及 API 规范修正；一次并发清理失败的对象单独清理成功，最终脚本改为顺序删除并保留有限重试及错误类型。

401 浏览器回归、112 项现有测试、lint、类型检查和生产构建通过。测试桶保留，凭据不纳入提交。

## Review 通知回归

本机生产服务与已有 Playwright 环境下运行：

```bash
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-sync-notifications.mjs
```

环境变量沿用认证回归脚本。全部账户、学习分区与自定义 R2 响应均为隔离夹具，浏览器阻止实际外部请求。覆盖同标签页填写完整自定义来源、切换目标期间旧请求晚返回、按当前显示目标手动上传、另一标签页错题本无需导航即更新、访客转入后的自动上传，以及 localStorage 仅拒绝归属通知时的登录/退出。三项 Review 回归、原有同步菜单和 401 回归通过；112 项测试、lint、类型检查与生产构建通过。

账户切换和访客转入均在 IndexedDB 提交成功后才发送通知。localStorage 仅作为跨标签页通知通道；该通道不可用时保留同标签页通知，不把已完成的账户切换报告为失败。IndexedDB 本身的失败仍会正常报告。
