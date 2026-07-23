import { PageHeader } from "../components/PageHeader";
import { ShiciClient } from "./ShiciClient";

export default function ShiciPage() {
  return (
    <>
      <PageHeader current="nav.shici" title="nav.shici" description="page.shici.description" />
      <ShiciClient />
    </>
  );
}
