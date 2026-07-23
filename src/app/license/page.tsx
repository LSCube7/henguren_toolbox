import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PageHeader } from "../components/PageHeader";

export default async function LicensePage() {
  const license = await readFile(join(process.cwd(), "LICENSE"), "utf8");

  return (
    <div className="stack">
      <PageHeader current="nav.license" title="nav.license" description="page.license.description" />
      <section className="md-card">
        <pre className="license-text">{license}</pre>
      </section>
    </div>
  );
}
