import { PageHeader } from "../components/PageHeader";

export default function TermsPage() {
  return (
    <div className="stack-lg">
      <PageHeader current="用户协议" title="用户协议" description="使用恨古人工具箱 v3 alpha 前，请了解这些基本约定。" />
      <section className="md-card stack">
        <h2 className="section-title">工具定位</h2>
        <p className="helper-text">恨古人工具箱是面向语文与英语学习的轻量工具集合，当前 v3 仍处于 alpha 阶段，功能和界面可能继续调整。</p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">本地与云端数据</h2>
        <p className="helper-text">请自行确认导入词表、错题本和同步数据的准确性。云同步采用显式操作，不会默认自动覆盖你的本地数据。</p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">开源许可</h2>
        <p className="helper-text">项目代码按 MIT License 发布，具体许可文本可在项目许可页面和 GitHub 仓库中查看。</p>
      </section>
    </div>
  );
}
