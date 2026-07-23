import { VocabClient } from "./VocabClient";
import { PageHeader } from "../components/PageHeader";

export default function VocabPage() {
  return (
    <>
      <PageHeader
        current="nav.vocab"
        title="nav.vocab"
        description="page.vocab.description"
      />
      <VocabClient />
    </>
  );
}
