import { PageHeader } from "@/app/components/PageHeader";
import { UserClient } from "@/app/user/UserClient";

export default function UserPage() {
  return (
    <>
      <PageHeader current="nav.user" title="nav.user" description="page.user.description" />
      <UserClient />
    </>
  );
}
