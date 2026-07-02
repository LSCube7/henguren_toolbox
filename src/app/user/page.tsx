import { PageHeader } from "../components/PageHeader";
import { UserClient } from "./UserClient";

export default function UserPage() {
  return (
    <>
      <PageHeader current="用户与同步" title="用户与同步" description="使用 LSCube OAuth 登录后，可以手动同步错题本和设置；不登录也可以继续使用本地工具。" />
      <UserClient />
    </>
  );
}
