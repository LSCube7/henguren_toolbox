export function SettingsSection({
  title,
  description,
  control
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <section className="md-card settings-row" aria-labelledby={`${title}-setting`}>
      <div className="stack">
        <h2 className="section-title" id={`${title}-setting`}>
          {title}
        </h2>
        {description ? <p className="helper-text">{description}</p> : null}
      </div>
      <div>{control}</div>
    </section>
  );
}
