import { PageHeader } from "../components/PageHeader";
import { SettingsClient } from "./SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <PageHeader current="个人设置" title="个人设置" description="管理主题、测试偏好和同步策略。设置会优先保存在本地，登录后可同步到云端。" />
      <SettingsClient />
    </>
  );
}
