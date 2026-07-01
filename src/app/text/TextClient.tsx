"use client";

import textLists from "@/assets/js/text/list.json";
import { useEffect, useState } from "react";

type Sentence = { id: string; text: string };
type Paragraph = { id: string; title?: string; sentences: Sentence[] };
type Section = { id: string; title: string; paragraphs: Paragraph[] };
type TextBook = { title: string; sections: Section[] };

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

export function TextClient() {
  const [selected, setSelected] = useState(textLists[0]?.name ?? "");
  const [book, setBook] = useState<TextBook | null>(null);
  const [message, setMessage] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const section = book?.sections[sectionIndex];
  const paragraph = section?.paragraphs[paragraphIndex];

  useEffect(() => {
    async function load() {
      try {
        setMessage("");
        const response = await fetch(`/api/data/text/${selected}`);
        if (!response.ok) throw new Error("text_cache_miss");
        setBook((await response.json()) as TextBook);
        setSectionIndex(0);
        setParagraphIndex(0);
      } catch {
        setBook(null);
        setMessage("该课文尚未离线缓存，请联网打开一次后再离线使用。");
      }
    }
    if (selected) void load();
  }, [selected]);

  return (
    <div className="stack">
      <section className="md-card stack" aria-label="课文选择">
        <md-filled-select label="课文列表" value={selected} onInput={(event) => setSelected(valueFrom(event))}>
          {textLists.map((item) => (
            <md-select-option value={item.name} key={item.name}>
              <div slot="headline">{item.title}</div>
            </md-select-option>
          ))}
        </md-filled-select>
        {book ? (
          <>
            <div className="cluster" aria-label="章节列表">
              {book.sections.map((item, index) =>
                index === sectionIndex ? (
                  <md-filled-button key={item.id}>{item.title}</md-filled-button>
                ) : (
                  <md-outlined-button
                    key={item.id}
                    onClick={() => {
                      setSectionIndex(index);
                      setParagraphIndex(0);
                    }}
                  >
                    {item.title}
                  </md-outlined-button>
                )
              )}
            </div>
            <div className="cluster" aria-label="段落列表">
              {section?.paragraphs.map((item, index) =>
                index === paragraphIndex ? (
                  <md-filled-button key={item.id}>段落 {index + 1}</md-filled-button>
                ) : (
                  <md-outlined-button key={item.id} onClick={() => setParagraphIndex(index)}>
                    段落 {index + 1}
                  </md-outlined-button>
                )
              )}
            </div>
          </>
        ) : (
          <p className="helper-text">{message || "正在加载课文。"}</p>
        )}
      </section>
      <section className="md-card stack" aria-label="课文预览">
        {paragraph?.sentences.map((sentence, index) => (
          <p key={sentence.id} className="helper-text" style={{ lineHeight: 1.8 }}>
            <span className="badge badge--neutral" style={{ marginRight: 8 }}>
              {index + 1}
            </span>
            {sentence.text}
          </p>
        ))}
      </section>
    </div>
  );
}
