import { PageHeader } from "../components/PageHeader";
import { TextClient } from "./TextClient";

export default function TextPage() {
  return (
    <>
      <PageHeader current="课文测试" title="课文测试" description="选择课文范围和难度，使用合理的随机挖空练习原文，并查看逐句反馈与测试结果。" />
      <TextClient />
    </>
  );
}
