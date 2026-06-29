export function PageHeader({ current, title, description }: { current: string; title: string; description: string }) {
  return (
    <header className="page-header">
      <div className="breadcrumb" aria-label="面包屑">
        <span>恨古人工具箱</span>
        <span aria-hidden="true">/</span>
        <span>{current}</span>
      </div>
      <h1 className="page-title">{title}</h1>
      <p className="page-description">{description}</p>
    </header>
  );
}
