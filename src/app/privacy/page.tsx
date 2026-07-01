import { PageHeader } from "../components/PageHeader";

export default function PrivacyPage() {
  return (
    <div className="stack-lg">
      <PageHeader current="隐私政策" title="隐私政策" description="说明恨古人工具箱 v3 alpha 如何处理本地数据、登录状态与云同步数据。" />
      <section className="md-card stack">
        <h2 className="section-title">数据处理</h2>
        <p className="helper-text">
          未登录时，错题本、测试偏好和离线缓存主要保存在你的浏览器本地。登录并主动使用云同步时，错题本和设置会通过 LSCube OAuth
          身份会话同步到云端存储。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">第三方服务</h2>
        <p className="helper-text">项目可能使用 LSCube OAuth 完成登录，使用 Vercel 托管服务，并使用 Cloudflare R2 保存你主动同步的数据。</p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">你的选择</h2>
        <p className="helper-text">你可以不登录而继续使用本地工具；也可以在用户与同步页面显式拉取、上传或合并云端错题本。</p>
      </section>
    </div>
  );
}
