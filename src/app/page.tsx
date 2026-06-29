import { PageHeader } from "./components/PageHeader";
import { ToolCard } from "./components/ToolCard";

const tools = [
  { href: "/shici", title: "寻找实词", body: "安全高亮 150 个文言实词", status: "已迁移", icon: "实" },
  { href: "/wenchang", title: "文学常识", body: "篇目、作者、出处筛选", status: "已迁移", icon: "文" },
  { href: "/vocab", title: "单词测试", body: "完整测试流程、本地错题本与云端同步", status: "Alpha", icon: "词" },
  { href: "/text", title: "课文测试", body: "课文选择与预览，本轮暂作占位", status: "预览", icon: "课" },
  { href: "/settings", title: "个人设置", body: "主题、偏好和同步策略", status: "可用", icon: "设" }
] as const;

const metrics = [
  { title: "可用学习工具", value: "4", helper: "课文测试为预览入口" },
  { title: "单词测试迁移", value: "v2", helper: "错题本与导入导出已恢复" },
  { title: "云端错题本", value: "R2", helper: "配置 OAuth 后可同步" }
] as const;

export default function HomePage() {
  return (
    <div className="stack-lg">
      <PageHeader
        current="工具总览"
        title="工具总览"
        description="Material Web 驱动的学习工具箱首页。这里保留卡片入口和侧边导航，但不改变工具箱定位。"
      />

      <section className="md-grid" aria-label="工具箱状态">
        {metrics.map((metric) => (
          <article className="md-card" key={metric.title}>
            <p className="helper-text">{metric.title}</p>
            <div className="metric-value">{metric.value}</div>
            <p className="helper-text">{metric.helper}</p>
          </article>
        ))}
      </section>

      <section className="stack" aria-labelledby="tools-title">
        <div className="cluster">
          <span className="app-nav__icon" aria-hidden="true">
            工
          </span>
          <h2 className="section-title" id="tools-title">
            学习工具
          </h2>
        </div>
        <div className="md-grid">
          {tools.map((tool) => (
            <ToolCard href={tool.href} title={tool.title} description={tool.body} status={tool.status} icon={tool.icon} key={tool.href} />
          ))}
        </div>
      </section>
    </div>
  );
}
