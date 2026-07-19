import Link from "next/link";
import type { Route } from "next";

type ToolHref = "/" | "/shici" | "/wenchang" | "/vocab" | "/text" | "/settings" | "/user" | "/license" | "/changelog";

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
    <Link href={href as Route} className="md-card md-card--interactive">
      <div className="spread">
        <span className="app-nav__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="badge">{status}</span>
      </div>
      <div className="tool-card__content stack">
        <h2 className="card-title">{title}</h2>
        <p className="card-description">{description}</p>
      </div>
    </Link>
  );
}
