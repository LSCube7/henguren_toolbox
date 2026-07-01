"use client";

import { ToolCard } from "./components/ToolCard";
import { MaterialIcon } from "./components/MaterialIcon";
import { useEdition } from "@/lib/edition";

const tools = [
  { edition: "junior", href: "/shici", title: "寻找实词", body: "安全高亮 150 个文言实词", status: "已迁移", icon: "search" },
  { edition: "junior", href: "/wenchang", title: "文学常识", body: "篇目、作者、出处筛选", status: "已迁移", icon: "menu_book" },
  { edition: "senior", href: "/vocab", title: "单词测试", body: "完整测试流程、本地错题本与云端同步", status: "Alpha", icon: "spellcheck" },
  { edition: "senior", href: "/text", title: "课文测试", body: "课文选择与预览，本轮暂作占位", status: "预览", icon: "article" }
] as const;

export function HomeTools() {
  const edition = useEdition();
  const visibleTools = tools.filter((tool) => tool.edition === edition);

  return (
    <section className="stack" aria-labelledby="tools-title">
      <div className="spread">
        <div className="cluster">
          <span className="app-nav__icon" aria-hidden="true">
            <MaterialIcon name={edition === "junior" ? "school" : "workspace_premium"} />
          </span>
          <div>
            <h2 className="section-title" id="tools-title">
              {edition === "junior" ? "初中版学习工具" : "高中版学习工具"}
            </h2>
            <p className="helper-text">{edition === "junior" ? "文言实词与文学常识。" : "英语单词测试与课文测试预览。"}</p>
          </div>
        </div>
        <span className="badge">{edition === "junior" ? "初中版" : "高中版"}</span>
      </div>
      <div className="md-grid">
        {visibleTools.map((tool) => (
          <ToolCard href={tool.href} title={tool.title} description={tool.body} status={tool.status} icon={<MaterialIcon name={tool.icon} />} key={tool.href} />
        ))}
      </div>
    </section>
  );
}
