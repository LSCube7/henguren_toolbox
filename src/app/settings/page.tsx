import { PageHeader } from "../components/PageHeader";
import { SettingsClient } from "./SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <PageHeader current="nav.settings" title="nav.settings" description="page.settings.description" />
      <SettingsClient />
    </>
  );
}
