import { PageHeader } from "../../components/PageHeader";
import { VocabPrintClient } from "./VocabPrintClient";

export default function VocabPrintPage() {
  return (
    <>
      <PageHeader current="page.print" title="page.print.title" description="page.print.description" />
      <VocabPrintClient />
    </>
  );
}
