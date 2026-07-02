import { PageHeader } from "../components/PageHeader";

export default function PrivacyPage() {
  return (
    <div className="stack-lg">
      <PageHeader current="隐私政策" title="隐私政策" description="本政策说明恨古人工具箱如何处理本地数据、登录状态、云同步数据和开发者自定义同步源。" />
      <p className="helper-text legal-updated">最后更新：2026 年 7 月 2 日</p>
      <section className="md-card stack">
        <h2 className="section-title">1. 未登录使用</h2>
        <p className="helper-text">
          你可以不登录而使用主要学习工具。未登录时，单词错题本、测试偏好、主题设置、离线缓存和上传的临时词表主要保存在你的浏览器本机，不会主动上传到云端。
          你可以通过浏览器数据管理功能或工具箱提供的导入导出、清除操作管理这些数据。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">2. 登录与 LSCube OAuth 信息</h2>
        <p className="helper-text">
          当你选择 LSCube OAuth 登录时，工具箱会通过登录服务获取必要的身份信息，例如用户 ID、显示名称、邮箱和头像地址。工具箱只使用这些信息建立本地会话、显示登录状态，
          并判断你是否可以使用云同步功能。LSCube OAuth 自身对账号、授权、安全日志等数据的处理，适用其
          <a href="https://auth.lsc7.top/privacy" target="_blank" rel="noreferrer"> 隐私政策</a>
          和
          <a href="https://auth.lsc7.top/terms" target="_blank" rel="noreferrer"> 用户协议</a>。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">3. 云同步数据</h2>
        <p className="helper-text">
          只有当你主动使用错题本或设置同步时，工具箱才会把对应 JSON 快照保存到云端存储。同步内容可能包括错题词条、释义来源、错误次数、批次信息、主题偏好、
          学习阶段和测试偏好。同步采用显式操作，不会在登录或完成向导后自动覆盖本机或云端数据。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">4. 离线缓存与本机存储</h2>
        <p className="helper-text">
          为了让工具箱在离线时继续可用，浏览器可能缓存应用页面、静态资源和你选择缓存的词表 JSON。自定义上传词表默认只在当前页面会话中使用；错题本则保存在本机数据库。
          清除浏览器站点数据可能会删除这些本地数据。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">5. 开发者自定义同步源</h2>
        <p className="helper-text">
          如果你在开发者模式中配置自定义 R2 同步源，访问密钥会长期保存在你的本机浏览器中，并由浏览器直接访问你填写的对象存储。请只使用你自己控制的个人或测试桶，
          不要填写公共密钥或共享生产密钥。自定义同步源的数据处理、权限和保留规则由你配置的存储服务决定。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">6. 第三方服务与数据安全</h2>
        <p className="helper-text">
          工具箱可能依赖托管服务、LSCube OAuth 登录服务、对象存储和浏览器提供的本地存储能力。项目会尽合理努力减少收集范围，并避免在前端暴露默认服务端密钥。
          但互联网服务无法保证任何场景下绝对不中断或零风险，请妥善保管账号和自定义同步源密钥。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">7. 你的选择</h2>
        <p className="helper-text">
          你可以选择不登录、退出登录、导入导出错题本、清除开发者同步源配置，或通过浏览器清除站点数据。若你不希望数据保存到云端，请不要点击同步相关操作。
        </p>
      </section>
    </div>
  );
}
