import { PageHeader } from "../components/PageHeader";

const entries = [
  {
    version: "v3.0.0-alpha",
    title: "Next.js 与 Material Web 重构",
    items: ["切换到 Next.js App Router 与 TypeScript。", "使用 Material Web 与 Material Symbols 构建新的学习工具箱界面。", "加入 LSCube OAuth、R2 错题本同步和设置同步接口。"]
  },
  {
    version: "v3 UI",
    title: "Navigation Rail 与学习阶段",
    items: ["侧边导航改为 M3 navigation rail。", "新增初中版/高中版切换，首页工具卡片跟随筛选。", "底部加入云同步状态、设置、更新记录和用户入口。"]
  },
  {
    version: "v2 compatibility",
    title: "单词测试迁移",
    items: ["恢复单元多选、自定义词表、结果页和错题本导入导出。", "保留本地 IndexedDB 错题本，并提供显式云同步操作。", "课文测试保留为 Alpha 预览入口。"]
  }
];

export default function ChangelogPage() {
  return (
    <div className="stack-lg">
      <PageHeader current="更新记录" title="更新记录" description="记录恨古人工具箱 v3 alpha 的迁移重点和近期 UI 调整。" />
      <section className="stack" aria-label="更新列表">
        {entries.map((entry) => (
          <article className="md-card stack" key={entry.version}>
            <div className="spread">
              <div>
                <p className="helper-text">{entry.version}</p>
                <h2 className="section-title">{entry.title}</h2>
              </div>
              <span className="badge">Alpha</span>
            </div>
            <ul className="clean-list">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
