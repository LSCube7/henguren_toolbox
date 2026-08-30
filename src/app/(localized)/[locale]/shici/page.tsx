import { PageHeader } from "@/app/components/PageHeader";
import { ShiciClient } from "@/app/shici/ShiciClient";

export default function ShiciPage() {
  return (
    <>
      <PageHeader current="nav.shici" title="nav.shici" description="page.shici.description" />
      <ShiciClient />
    </>
  );
}
