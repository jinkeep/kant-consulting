"use client";
import * as React from "react";

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

function parseTableRow(line: string): string[] {
  const t = line.trim();
  return t.slice(1, t.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
}

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      out.push({ type: "h2", text: line.replace(/^##\s+/, "") });
      i++;
      continue;
    }
    if (/^###\s/.test(line)) {
      out.push({ type: "h3", text: line.replace(/^###\s+/, "") });
      i++;
      continue;
    }
    if (/^[-*]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }
    if (/^\|.+\|/.test(line.trim())) {
      const sep = lines[i + 1] ?? "";
      if (/^\|[\s\-:|]+\|/.test(sep.trim())) {
        const head = parseTableRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && /^\|.+\|/.test(lines[i].trim())) {
          rows.push(parseTableRow(lines[i]));
          i++;
        }
        out.push({ type: "table", head, rows });
        continue;
      }
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(##\s|###\s|[-*]\s|\|.+\|)/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push({ type: "p", text: para.join(" ") });
  }
  return out;
}

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code key={key++} className="font-mono text-[0.9em] bg-kant-line/60 px-1 py-[1px] rounded">
          {tok.slice(1, -1)}
        </code>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function Markdown({ text, dense = false }: { text: string; dense?: boolean }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={dense ? "space-y-3" : "space-y-5"}>
      {blocks.map((b, i) => {
        if (b.type === "h2") {
          return (
            <h2 key={i} className="font-display text-2xl md:text-3xl font-semibold tracking-tight mt-6 first:mt-0">
              <Inline text={b.text} />
            </h2>
          );
        }
        if (b.type === "h3") {
          return (
            <h3 key={i} className="font-medium text-lg mt-4 first:mt-0">
              <Inline text={b.text} />
            </h3>
          );
        }
        if (b.type === "p") {
          return (
            <p key={i} className="leading-relaxed text-[15px] text-kant-fg/90">
              <Inline text={b.text} />
            </p>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="space-y-2 text-[15px]">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-[10px] h-[5px] w-[5px] flex-none bg-kant-fg" aria-hidden />
                  <span className="leading-relaxed text-kant-fg/90">
                    <Inline text={it} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div key={i} className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-kant-fg">
                  {b.head.map((h, j) => (
                    <th key={j} className="text-left font-medium py-2 px-3 font-mono text-xs uppercase tracking-wider text-kant-muted">
                      <Inline text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-b border-kant-line">
                    {r.map((c, k) => (
                      <td key={k} className="py-3 px-3 align-top">
                        <Inline text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
