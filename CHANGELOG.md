# 更新日志

## 未发布：Material 3 Expressive

### 优化

- 界面控件迁移到第三方 M3E，按钮加入交互形状变化，外观模式使用关联按钮组，设置采用 M3E 卡片和表单容器。
- 桌面导航采用 M3E Navigation Rail，移动导航与确认窗口使用 M3E Dialog；保留原有学习工具层级。
- 主题颜色由 M3eTheme 的 2025 Dynamic Color 生成，保留已保存的种子色、预设、Pride Colors、HCT 选色和系统明暗模式。
- 减少全站组件加载，保留本地图标字体子集，动画支持减少动态效果偏好。

### 注意事项

- M3E 是社区实现，并非 Google 官方组件库。现有学习数据、登录、显式同步及离线机制继续保留。
- 通知继续支持错误信息复制；由于 M3E 的 React Snackbar 导出为命令式服务，通知展示使用其 Web Component。
