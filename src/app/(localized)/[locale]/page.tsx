import { PageHeader } from "@/app/components/PageHeader";
import { HomeTools } from "@/app/HomeTools";
import { HomeWelcome } from "@/app/HomeWelcome";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <div className="stack-lg">
      <PageHeader current="nav.overview" title="home.title" description="home.description" />
      <Suspense fallback={null}><HomeWelcome /></Suspense>
      <HomeTools />
    </div>
  );
}
