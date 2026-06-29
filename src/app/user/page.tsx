import { PageHeader } from "../components/PageHeader";
import { UserClient } from "./UserClient";

export default function UserPage() {
  return (
    <>
      <PageHeader current="用户与同步" title="用户与同步" description="LSCube OAuth 是 v3 云端错题本和设置同步的身份入口。" />
      <UserClient />
    </>
  );
}
