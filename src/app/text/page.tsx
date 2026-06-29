import { PageHeader } from "../components/PageHeader";
import { TextClient } from "./TextClient";

export default function TextPage() {
  return (
    <>
      <PageHeader current="课文测试" title="课文测试" description="本轮保留课文选择与预览，完整挖空测试将在后续 Alpha 中继续完善。" />
      <TextClient />
    </>
  );
}
