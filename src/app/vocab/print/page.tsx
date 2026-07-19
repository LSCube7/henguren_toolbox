import { PageHeader } from "../../components/PageHeader";
import { VocabPrintClient } from "./VocabPrintClient";

export default function VocabPrintPage() {
  return (
    <>
      <PageHeader current="打印版" title="单词测试打印版" description="基于已选择的 Unit 或自定义词表生成纸面默写练习，可在打印前调整显示内容。" />
      <VocabPrintClient />
    </>
  );
}
