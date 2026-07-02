import { PageHeader } from "./components/PageHeader";
import { HomeTools } from "./HomeTools";

export default function HomePage() {
  return (
    <div className="stack-lg">
      <PageHeader
        current="工具总览"
        title="今天想练什么？"
        description="选择一个工具开始学习。错题本和偏好会优先保存在本机；需要时再手动同步到云端。"
      />

      <HomeTools />
    </div>
  );
}
