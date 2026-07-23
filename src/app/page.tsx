import { PageHeader } from "./components/PageHeader";
import { HomeTools } from "./HomeTools";

export default function HomePage() {
  return (
    <div className="stack-lg">
      <PageHeader
        current="nav.overview"
        title="home.title"
        description="home.description"
      />

      <HomeTools />
    </div>
  );
}
