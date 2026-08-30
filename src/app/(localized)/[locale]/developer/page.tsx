import { PageHeader } from "@/app/components/PageHeader";
import { DeveloperClient } from "@/app/developer/DeveloperClient";

export default function DeveloperPage() {
  return (
    <>
      <PageHeader current="nav.developer" title="nav.developer" description="page.developer.description" />
      <DeveloperClient />
    </>
  );
}
