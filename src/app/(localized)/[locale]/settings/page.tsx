import { PageHeader } from "@/app/components/PageHeader";
import { SettingsClient } from "@/app/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <PageHeader current="nav.settings" title="nav.settings" description="page.settings.description" />
      <SettingsClient />
    </div>
  );
}
