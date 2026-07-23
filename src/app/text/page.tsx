import { PageHeader } from "../components/PageHeader";
import { TextClient } from "./TextClient";

export default function TextPage() {
  return (
    <>
      <PageHeader current="nav.text" title="nav.text" description="page.text.description" />
      <TextClient />
    </>
  );
}
