import { LearningOwnerGate } from "@/app/components/LearningOwnerGate";
import { Suspense } from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { UserClient } from "@/app/user/UserClient";

export default function UserPage() {
  return (
    <>
      <PageHeader current="nav.user" title="nav.user" description="page.user.description" />
      <Suspense fallback={null}>
        <LearningOwnerGate><UserClient /></LearningOwnerGate>
      </Suspense>
    </>
  );
}
