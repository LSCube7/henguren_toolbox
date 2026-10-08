import { LearningOwnerGate } from "@/app/components/LearningOwnerGate";
import { PageHeader } from "@/app/components/PageHeader";
import { VocabClient } from "@/app/vocab/VocabClient";

export default function VocabPage() {
  return (
    <>
      <PageHeader current="nav.vocab" title="nav.vocab" description="page.vocab.description" />
      <LearningOwnerGate><VocabClient /></LearningOwnerGate>
    </>
  );
}
