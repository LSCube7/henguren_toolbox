import Link from "next/link";

type ToolHref = "/" | "/shici" | "/wenchang" | "/vocab" | "/text" | "/settings" | "/user" | "/license";

export function ToolCard({
  href,
  title,
  description,
  status,
  icon
}: {
  href: ToolHref;
  title: string;
  description: string;
  status: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="md-card md-card--interactive">
      <div className="spread">
        <span className="app-nav__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="badge">{status}</span>
      </div>
      <div className="stack" style={{ marginTop: 18 }}>
        <h2 className="card-title">{title}</h2>
        <p className="card-description">{description}</p>
      </div>
    </Link>
  );
}
