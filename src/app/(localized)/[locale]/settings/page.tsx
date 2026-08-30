import { PageHeader } from "@/app/components/PageHeader";
import { SettingsClient } from "@/app/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <PageHeader current="nav.settings" title="nav.settings" description="page.settings.description" />
      <SettingsClient />
    </>
  );
}
