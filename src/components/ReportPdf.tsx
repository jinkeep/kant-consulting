"use client";
import * as React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

function parseTableRow(line: string): string[] {
  const t = line.trim();
  return t
    .slice(1, t.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((c) => c.trim());
}

function stripInline(s: string): string {
  return s.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/`([^`\n]+)`/g, "$1");
}

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      out.push({ type: "h2", text: stripInline(line.replace(/^##\s+/, "")) });
      i++;
      continue;
    }
    if (/^###\s/.test(line)) {
      out.push({ type: "h3", text: stripInline(line.replace(/^###\s+/, "")) });
      i++;
      continue;
    }
    if (/^[-*]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(stripInline(lines[i].trim().replace(/^[-*]\s+/, "")));
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }
    if (/^\|.+\|/.test(line.trim())) {
      const sep = lines[i + 1] ?? "";
      if (/^\|[\s\-:|]+\|/.test(sep.trim())) {
        const head = parseTableRow(line).map(stripInline);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && /^\|.+\|/.test(lines[i].trim())) {
          rows.push(parseTableRow(lines[i]).map(stripInline));
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
    out.push({ type: "p", text: stripInline(para.join(" ")) });
  }
  return out;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontSize: 10.5,
    color: "#0a0a0a",
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    lineHeight: 1.55,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  brandSquare: { width: 9, height: 9, backgroundColor: "#0a0a0a" },
  brand: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  meta: {
    fontSize: 8,
    color: "#737373",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  rule: {
    height: 1,
    backgroundColor: "#0a0a0a",
    marginTop: 14,
    marginBottom: 22,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 8,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
  },
  p: { marginBottom: 6 },
  ulItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 2,
  },
  bullet: {
    width: 3,
    height: 3,
    backgroundColor: "#0a0a0a",
    marginTop: 6,
    marginRight: 8,
  },
  ulText: { flex: 1 },
  table: {
    marginTop: 6,
    marginBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#0a0a0a",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  trHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#0a0a0a",
    backgroundColor: "#fafafa",
  },
  th: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#737373",
    fontFamily: "Helvetica-Bold",
  },
  td: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#737373",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});

function BlockNode({ b }: { b: Block }) {
  if (b.type === "h2") return <Text style={styles.h2}>{b.text}</Text>;
  if (b.type === "h3") return <Text style={styles.h3}>{b.text}</Text>;
  if (b.type === "p") return <Text style={styles.p}>{b.text}</Text>;
  if (b.type === "ul") {
    return (
      <View>
        {b.items.map((it, j) => (
          <View key={j} style={styles.ulItem}>
            <View style={styles.bullet} />
            <Text style={styles.ulText}>{it}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        {b.head.map((h, j) => (
          <Text key={j} style={styles.th}>
            {h}
          </Text>
        ))}
      </View>
      {b.rows.map((r, j) => (
        <View key={j} style={styles.tr}>
          {r.map((c, k) => (
            <Text key={k} style={styles.td}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export interface ReportPdfProps {
  markdown: string;
  generatedAt?: Date;
}

export function ReportPdf({ markdown, generatedAt }: ReportPdfProps) {
  const blocks = parseBlocks(markdown);
  const dateStr = (generatedAt ?? new Date()).toISOString().slice(0, 10);
  return (
    <Document
      title="Kant Consulting · 业务自动化诊断报告"
      author="Kant Consulting"
      subject="Business Automation Assessment"
      creator="Kant Consulting Pre-Sales Agent"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.brandRow}>
          <View style={styles.brandSquare} />
          <Text style={styles.brand}>Kant Consulting</Text>
        </View>
        <Text style={styles.meta}>
          AI Pre-Sales Agent · {dateStr}
        </Text>
        <Text style={styles.title}>业务自动化诊断报告</Text>
        <View style={styles.rule} />
        {blocks.map((b, i) => (
          <BlockNode key={i} b={b} />
        ))}
        <View style={styles.footer} fixed>
          <Text>© Kant Consulting</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
