import { PageHeader } from "../components/PageHeader";
import { WenchangClient } from "./WenchangClient";

export default function WenchangPage() {
  return (
    <>
      <PageHeader current="文学常识" title="文学常识" description="沿用 v2 数据，支持按篇名、作者、出处和年级筛选。" />
      <WenchangClient />
    </>
  );
}
