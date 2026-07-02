import { PageHeader } from "../components/PageHeader";
import { WenchangClient } from "./WenchangClient";

export default function WenchangPage() {
  return (
    <>
      <PageHeader current="文学常识" title="文学常识" description="按篇名、作者、出处和年级筛选常见文学常识。" />
      <WenchangClient />
    </>
  );
}
