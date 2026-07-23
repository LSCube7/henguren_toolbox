import { PageHeader } from "../components/PageHeader";
import { WenchangClient } from "./WenchangClient";

export default function WenchangPage() {
  return (
    <>
      <PageHeader current="nav.wenchang" title="nav.wenchang" description="page.wenchang.description" />
      <WenchangClient />
    </>
  );
}
