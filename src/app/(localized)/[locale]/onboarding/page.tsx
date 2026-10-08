import { Suspense } from "react";
import { OnboardingClient } from "@/app/onboarding/OnboardingClient";

export default function OnboardingPage() {
  return <Suspense fallback={null}><OnboardingClient /></Suspense>;
}
