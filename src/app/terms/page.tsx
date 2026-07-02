import { PageHeader } from "../components/PageHeader";

export default function TermsPage() {
  return (
    <div className="stack-lg">
      <PageHeader current="用户协议" title="用户协议" description="使用恨古人工具箱前，请了解工具定位、数据责任、登录同步和开源许可等基本约定。" />
      <p className="helper-text legal-updated">最后更新：2026 年 7 月 2 日</p>
      <section className="md-card stack">
        <h2 className="section-title">1. 工具定位</h2>
        <p className="helper-text">
          恨古人工具箱是面向语文与英语学习的轻量工具集合，用于辅助查找、练习、记录和复习。工具箱不替代教材、教师指导、考试标准答案或专业学习建议。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">2. 学习内容与用户数据</h2>
        <p className="helper-text">
          项目会尽力保持内置数据准确、清晰和可用，但仍可能存在疏漏。你导入的词表、错题本、打印内容和同步数据应由你自行确认来源、合法性和准确性。
          请勿上传、导入或同步你无权使用的内容。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">3. 登录与 LSCube OAuth 服务</h2>
        <p className="helper-text">
          登录功能由 LSCube OAuth 服务提供。使用登录、授权、账号安全和会话管理能力时，你还需要遵守 LSCube OAuth 的
          <a href="https://auth.lsc7.top/terms" target="_blank" rel="noreferrer"> 用户协议</a>
          和
          <a href="https://auth.lsc7.top/privacy" target="_blank" rel="noreferrer"> 隐私政策</a>。
          如果你不同意这些条款，可以不登录并继续使用本地功能。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">4. 同步责任</h2>
        <p className="helper-text">
          云同步是显式操作。拉取、上传覆盖、合并上传可能改变本机或云端错题本状态，请在操作前确认数据来源。开发者自定义同步源由你自行配置和维护，
          相关密钥、桶权限、CORS 和数据保留规则由你负责。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">5. 禁止行为</h2>
        <p className="helper-text">
          你不得利用本项目或相关服务进行未授权访问、滥用接口、绕过安全限制、攻击系统、批量发送异常请求，或上传、同步违法违规、侵权或恶意内容。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">6. 免责声明</h2>
        <p className="helper-text">
          本项目按“现状”提供。项目维护者会尽合理努力改善可用性与安全性，但不保证服务始终不中断、无错误或完全适合你的特定用途。
          在法律允许范围内，因使用、无法使用、误操作、第三方服务异常或自定义同步源配置不当导致的损失，由使用者自行承担相应风险。
        </p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">7. 开源许可与协议更新</h2>
        <p className="helper-text">
          项目代码按 MIT License 发布，完整许可文本可在项目许可页面查看。本协议可能随功能、法律或安全需要更新；继续使用即表示你接受更新后的约定。
        </p>
      </section>
    </div>
  );
}
