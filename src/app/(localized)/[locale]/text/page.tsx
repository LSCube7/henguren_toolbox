import { PageHeader } from "@/app/components/PageHeader";
import { TextClient } from "@/app/text/TextClient";

export default function TextPage() {
  return (
    <>
      <PageHeader current="nav.text" title="nav.text" description="page.text.description" />
      <TextClient />
    </>
  );
}
