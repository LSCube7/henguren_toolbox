import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PageHeader } from "../components/PageHeader";

export default async function LicensePage() {
  const license = await readFile(join(process.cwd(), "LICENSE"), "utf8");

  return (
    <div className="stack">
      <PageHeader current="项目许可" title="MIT License" description="恨古人工具箱按 MIT License 开源发布，完整许可文本如下。" />
      <section className="md-card">
        <pre className="license-text">{license}</pre>
      </section>
    </div>
  );
}
