# Material 3 Expressive 界面约定

本项目使用第三方 `@m3e/react` 和必要时的 `@m3e/web` 组件构建 Material 3 Expressive 界面。M3E 是独立的第三方实现，不代表 Google 官方组件或产品。

## 组件引入

- 按组件从 `@m3e/react/...` 子路径导入，便于 Next.js 按路由打包和 tree shaking；不要在全站入口导入整套组件。
- 仅当 React binding 缺少所需能力时，才按需从 `@m3e/web/...` 使用 Web Component。避免重复注册自定义元素或在整个应用中无条件加载组件。
- 根据交互语义选择组件：相关动作适合 Button Group 时使用分组；主动作加附属菜单适合 Split Button 时再使用拆分按钮。导航链接保留原生 `Link` / `<a>` 语义，不为组件覆盖率改成按钮。
- 卡片、导航和 Henguren 特有的信息层级可保留项目自己的结构，使用 M3E 的主题 token、形状、排版、尺寸层级和交互状态来呈现。
- Snackbar 等已有稳定业务 API 可以继续负责消息队列和生命周期，由组件层承载 M3E 外观。

普通自定义 `.md-card` 与 M3E Outlined Card 统一使用 `surface` 背景和 `outline-variant` 边框；明确采用 Elevated 的内部卡片使用 `surface-container-low`，不将两种外观混合。

## 主题

`M3eTheme` 是 Material 主题的唯一核心来源，负责 Dynamic Color 与 Material 主题 token。主题设置层只处理用户偏好及兼容：preset、seed color、light / dark / system、localStorage、主题预览和 Pride Colors。旧设置中的 `system` 映射到 M3E 的 `auto`，读取和迁移时保留用户已有的主题、种子色和模式。

优先使用 M3E 的 Dynamic Color、2025 color spec、`DynamicScheme`、contrast、density、theme variant 和 expressive motion 能力。不要再维护第二套完整 palette generator 或手工推导 surface container 色阶。Pride Colors 若超出标准 DynamicScheme 表达范围，只在 `M3eTheme` 输出上集中覆盖少量语义 token。

主题首屏应在水合前应用已保存的模式和 seed color，避免先显示默认配色再切换。light / dark / auto 均应跟随同一套用户设置与预览流程。

当前使用 M3E 2.9.1。首屏缓存只保存 `M3eTheme` 已生成的色彩 token；缓存不匹配时等待原生主题就绪，不自行生成配色。2.9 的顶层 `auto` 会优先读取 inline `color-scheme`，因此设置层在切换到系统模式时将其恢复为 `light dark`，再请求原生主题更新。

该版本的 Button Group 会在初始化时设置 radio 状态，而后续选中变化可能只更新 pressed 状态。主题模式按钮集中显式绑定字符串 `aria-checked="true/false"`，避免 React 19 对自定义元素的布尔属性写入空值；多选 FilterChip 也显式使用 checkbox 语义。Snackbar 的 React 导出是命令式服务，现有通知 API 使用按需注册的 `m3e-snackbar` 保持受控生命周期。Option 暂无辅助文本槽，课文难度菜单保留说明，并通过 `value` 槽单独显示所选名称。

单选 Button Group 通过 `button-group-keyboard.ts` 补齐方向键、Home/End 与单一 Tab 入口；打印释义语言使用 `multi` 模式和原生 toggle button 的 `aria-pressed`，避免组件初始化时将 checkbox role 改写为 button 后再被 React 覆盖。

单选按钮和 chip 的 `beforeinput` 阻止再次点击已选项而取消选中，避免受控状态与组件内部状态分离。M3E Snackbar 是单例呈现；PWA 更新提示在普通通知活动期间暂停呈现，通知结束后恢复，更新业务状态不变。

表单 Dialog 使用稳定的受控实例，移除旧组件的重建 key 和重开定时器。M3E 2.9 的 focus trap 无法完整发现跨嵌套槽的原生输入，集中式 `Dialog` 适配器等待原生 `show()` 并用 `focusWhenReady` 进入首个控件，补齐首尾 Tab 环绕；浏览器原生模态仍使背景不可交互，Escape 与回焦沿用 M3E 生命周期。无表单 Dialog 保留原生 focus trap。

移动导航中的账户菜单和同步面板位于 Dialog 内。M3E 2.9 的 Escape 会继续向父 Dialog 冒泡，因此局部捕获处理只关闭当前弹层并回焦，避免一次 Escape 同时关闭菜单与导航。同步设置改为居中的 M3E Dialog，保留现有业务 API；移动导航打开同步设置后收起，关闭时焦点返回导航按钮。

形状、强调排版和弹簧动画遵循 [Material 官方 Expressive 介绍](https://m3.material.io/blog/building-with-m3-expressive)与[Motion 规范](https://m3.material.io/styles/motion)，Web 实现由第三方 M3E 提供。

## 表单与可访问性

M3E NavItem 的伪链接会在普通 React 点击监听前激活，导致整页导航。Shell 在点击捕获阶段阻止该默认行为并调用 Next router，保留带修饰键的链接操作和页面布局实例。

桌面使用 compact `M3eNavRail`，移动端使用 expanded rail 放在原生模态 `M3eDialog` 中。评估过 `M3eDrawerContainer`：它是管理自身内容滚动和侧边槽的布局原语，未提供 Dialog 的原生 Escape/焦点返回生命周期。这里保留当前页面滚动结构与模态键盘行为，不为换容器改写整个 Shell 布局。

表单优先保留原生 HTML 控件的语义与浏览器行为，并通过 `M3eFormField` 提供标签、辅助说明、错误文本和视觉样式。文本、数字、密码、textarea、radio、checkbox、range 等控件仍使用与其任务匹配的原生 input；关联可见标签、错误状态、键盘操作和触控目标。只有在确有合适 M3E 控件且行为相符时才采用专用组件。

迁移 Dialog 时保留受控开关、取消/确认含义、焦点进入与返回、Escape 行为和屏幕阅读器标题关联。自定义 Navigation 保留既有导航层级与移动端抽屉行为，并确保 `aria-current`、键盘焦点和触控范围清楚。动画遵循 M3E expressive motion token，并尊重 `prefers-reduced-motion`。

## 项目边界

这是 Next.js App Router 的 local-first PWA。UI 迁移不改变 IndexedDB、localStorage、离线缓存、Service Worker、OAuth、云端同步、i18n、onboarding、开发者模式、typed routes 或学习业务逻辑。浏览器 API 仍留在 Client Components 或 client-only 模块；不为换组件库重写 Server / Client Component 边界。

Material Symbols Rounded 继续使用项目生成的本地字体子集，不改用 CDN。新增图标仍按 README 中的生成流程更新配置与产物。
