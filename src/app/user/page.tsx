import { PageHeader } from "../components/PageHeader";
import { UserClient } from "./UserClient";

export default function UserPage() {
  return (
    <>
      <PageHeader current="nav.user" title="nav.user" description="page.user.description" />
      <UserClient />
    </>
  );
}
