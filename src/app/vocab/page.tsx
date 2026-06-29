import { VocabClient } from "./VocabClient";
import { PageHeader } from "../components/PageHeader";

export default function VocabPage() {
  return (
    <>
      <PageHeader
        current="单词测试"
        title="单词测试"
        description="完整测试流程、本地错题本与云端错题本同步入口已经迁入 v3。"
      />
      <VocabClient />
    </>
  );
}
