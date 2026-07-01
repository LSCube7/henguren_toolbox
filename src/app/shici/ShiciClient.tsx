"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import definitions from "@/assets/js/shici/definitions.json";

const definitionMap = definitions as Record<string, string[]>;
const words = Object.keys(definitionMap).sort((a, b) => b.length - a.length);

function buildLatex(foundWords: string[]) {
  return foundWords
    .map((word) => {
      const defs = definitionMap[word] ?? [];
      return `$$\n${word}\\left\\{\\begin{array}{l}\n${defs
        .map((item) => item.replaceAll("&", "\\&"))
        .join(" \\\\\n")}\\end{array}\\right.\n$$`;
    })
    .join("\n");
}

export function ShiciClient() {
  const [text, setText] = useState("");
  const [activeWordKey, setActiveWordKey] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const foundWords = useMemo(() => words.filter((word) => text.includes(word)), [text]);
  const segments = useMemo(() => {
    if (!text) return [];
    const pattern = new RegExp(`(${words.join("|")})`, "g");
    return text.split(pattern).filter(Boolean);
  }, [text]);

  async function copyLatex() {
    await navigator.clipboard.writeText(buildLatex(foundWords));
  }

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!previewRef.current?.contains(event.target as Node)) {
        setActiveWordKey(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveWordKey(null);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function downloadLatex() {
    const content = `%!Tex Program = xelatex\n\\documentclass[twocolumn]{article}\n\\usepackage[fleqn]{amsmath}\n\\usepackage[UTF8]{ctex}\n\\begin{document}\n${buildLatex(foundWords)}\n\\end{document}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/x-tex;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "definitions.tex";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="md-card stack" aria-label="实词查找工具">
      <div className="cluster">
        <span className="badge">已识别 {foundWords.length} 个实词</span>
        <md-outlined-button onClick={() => void copyLatex()} disabled={foundWords.length === 0}>
          复制义项
        </md-outlined-button>
        <md-filled-button onClick={downloadLatex} disabled={foundWords.length === 0}>
          下载 TeX
        </md-filled-button>
      </div>
      <md-outlined-text-field
        label="输入古文"
        value={text}
        rows={6}
        type="textarea"
        onInput={(event) => setText(String((event.currentTarget as HTMLElement & { value?: string }).value ?? ""))}
      />
      <div className="md-card md-card--flat preview-panel" aria-live="polite" ref={previewRef}>
        {segments.length === 0 ? (
          <span className="helper-text">输入文本后会在这里安全高亮实词。</span>
        ) : (
          segments.map((segment, index) =>
            definitionMap[segment] ? (() => {
              const key = `${segment}-${index}`;
              const active = activeWordKey === key;
              return (
                <span className="definition-popover-wrap" key={key}>
                  <button
                    className="highlight-word"
                    type="button"
                    aria-expanded={active}
                    onClick={() => setActiveWordKey(active ? null : key)}
                  >
                    {segment}
                  </button>
                  {active ? (
                    <span className="definition-popover" role="tooltip">
                      <strong>{segment}</strong>
                      {definitionMap[segment].map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </span>
                  ) : null}
                </span>
              );
            })() : (
              <span key={`${segment}-${index}`}>{segment}</span>
            )
          )
        )}
      </div>
    </section>
  );
}
