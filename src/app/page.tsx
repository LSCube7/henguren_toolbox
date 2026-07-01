import { PageHeader } from "./components/PageHeader";
import { HomeTools } from "./HomeTools";

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

      <HomeTools />
    </div>
  );
}
