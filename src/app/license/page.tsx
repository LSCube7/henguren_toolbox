import { PageHeader } from "../components/PageHeader";

export default function LicensePage() {
  return (
    <div className="stack">
      <PageHeader current="项目许可" title="MIT License" description="Henguren Toolbox continues to be released under the MIT License." />
      <section className="md-card">
        <p className="helper-text">Full license text remains available in the repository root.</p>
      </section>
    </div>
  );
}
