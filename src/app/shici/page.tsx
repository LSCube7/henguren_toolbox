import { PageHeader } from "../components/PageHeader";
import { ShiciClient } from "./ShiciClient";

export default function ShiciPage() {
  return (
    <>
      <PageHeader current="寻找实词" title="寻找实词" description="安全高亮 150 个文言实词，并支持复制义项与 TeX 下载。" />
      <ShiciClient />
    </>
  );
}
