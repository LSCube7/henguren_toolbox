import { PageHeader } from "../components/PageHeader";

const entries = [
  {
    title: "v3.0.0",
    label: "正式重构版",
    groups: [
      {
        title: "体验与界面",
        items: [
          "切换到 Next.js App Router 与 TypeScript，保留本地优先的学习工具体验。",
          "使用官方 Material Web 与 Material Design 3 视觉语言，加入动态主题、Pride Color 和自定义 HCT 颜色。",
          "新增首次使用向导，可设置学习阶段、主题、登录选择和同步偏好。",
          "加入 PWA 与离线支持，已缓存页面和词表可在离线时继续使用。"
        ]
      },
      {
        title: "学习工具",
        items: [
          "寻找实词支持安全高亮、点击义项浮层和 TeX 导出。",
          "文学常识支持篇名、作者、出处和年级筛选，并优化了表格分隔与可读性。",
          "单词测试恢复单元多选、自定义词表、答题反馈、结果页、打印版和本地错题本。",
          "课文测试保留章节选择与内容预览入口，后续会继续补齐测试流程。"
        ]
      },
      {
        title: "同步与账号",
        items: [
          "错题本继续优先保存在本机 IndexedDB，登录后可手动拉取、上传覆盖或合并上传。",
          "设置同步采用显式操作，不会在完成向导或登录后自动覆盖本机设置。",
          "LSCube OAuth 登录支持 PKCE S256，并支持从向导返回原页面。",
          "开发者模式可配置自定义 R2 同步源，适合个人开发桶或测试环境。"
        ]
      },
      {
        title: "文档与合规",
        items: [
          "隐私政策与用户协议补充未登录、登录、云同步、离线缓存和自定义同步源场景。",
          "项目许可页面直接展示完整 MIT License 文本。",
          "环境变量命名改为通用 OAuth 配置，减少与具体身份服务的耦合。"
        ]
      }
    ]
  }
];

export default function ChangelogPage() {
  return (
    <div className="stack-lg">
      <PageHeader current="更新记录" title="更新记录" description="这里记录恨古人工具箱 v3.0.0 的主要变化，以及后续使用时需要关注的能力边界。" />
      <section className="stack" aria-label="更新列表">
        {entries.map((entry) => (
          <article className="md-card stack" key={entry.title}>
            <div className="spread">
              <div>
                <p className="helper-text">{entry.label}</p>
                <h2 className="section-title">{entry.title}</h2>
              </div>
              <span className="badge">{entry.title === "v3.0.0" ? "当前版本" : "说明"}</span>
            </div>
            {entry.groups.map((group) => (
              <section className="stack" key={group.title}>
                <h3 className="card-title">{group.title}</h3>
                <ul className="clean-list">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}
