import { PageHeader } from "@/app/components/PageHeader";
import { WenchangClient } from "@/app/wenchang/WenchangClient";

export default function WenchangPage() {
  return (
    <>
      <PageHeader current="nav.wenchang" title="nav.wenchang" description="page.wenchang.description" />
      <WenchangClient />
    </>
  );
}
