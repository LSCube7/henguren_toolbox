import { PageHeader } from "../components/PageHeader";
import { DeveloperClient } from "./DeveloperClient";

export default function DeveloperPage() {
  return (
    <>
      <PageHeader current="nav.developer" title="nav.developer" description="page.developer.description" />
      <DeveloperClient />
    </>
  );
}
