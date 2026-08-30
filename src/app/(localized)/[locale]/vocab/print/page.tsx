import { PageHeader } from "@/app/components/PageHeader";
import { VocabPrintClient } from "@/app/vocab/print/VocabPrintClient";

export default function VocabPrintPage() {
  return (
    <>
      <PageHeader current="page.print" title="page.print.title" description="page.print.description" />
      <VocabPrintClient />
    </>
  );
}
