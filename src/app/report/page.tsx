"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { Markdown } from "@/components/Markdown";
import { ReportPdf } from "@/components/ReportPdf";
import { FadeUp, FadeInView, CountUp } from "@/components/motion-bits";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <DownloadButton disabled label="加载中…" /> }
);

const REPORT_STORAGE_KEY = "kant.lastReport";

function DownloadButton({
  disabled,
  label,
}: {
  disabled?: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-3 px-6 py-3 bg-kant-fg text-kant-bg font-mono text-xs tracking-[0.2em] uppercase ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <span aria-hidden>↓</span>
      {label}
    </span>
  );
}

function highlightCount(markdown: string): number {
  const m = markdown.match(/##\s*[^\n]*机会[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  if (!m) return 0;
  const lines = m[1]
    .split("\n")
    .filter((l) => /^[-*]\s/.test(l.trim()) || /^\d+[.)]\s/.test(l.trim()));
  return lines.length;
}

function LeadForm({ markdown }: { markdown: string }) {
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || done) return;
    setErr(null);
    setPending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          notes: notes.trim() || markdown.slice(0, 1800),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "提交失败");
      } else {
        setDone(true);
      }
    } catch {
      setErr("网络异常，请稍后重试");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="border border-kant-fg p-6"
      >
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-kant-muted mb-2">
          ── Received
        </div>
        <p className="text-base leading-relaxed">
          已收到你的邮箱，Kant Consulting 团队会在 1–2 个工作日内联系，提供更详细的落地方案。
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-kant-line p-6 space-y-4">
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-kant-muted mb-2">
          ── Follow-Up
        </div>
        <h3 className="font-display text-2xl tracking-tight mb-1">
          想要更详细的落地方案？
        </h3>
        <p className="text-sm text-kant-muted leading-relaxed">
          留下邮箱，我们会基于本次诊断给你定制具体的实施路径与报价。
        </p>
      </div>

      <label className="block">
        <span className="block font-mono text-[10px] tracking-widest uppercase text-kant-muted mb-2">
          Email *
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full bg-transparent border border-kant-line px-3 py-2 outline-none focus:border-kant-fg transition-colors text-[15px]"
        />
      </label>

      <label className="block">
        <span className="block font-mono text-[10px] tracking-widest uppercase text-kant-muted mb-2">
          Notes
        </span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="可选 · 补充说明你的优先级或时间节点"
          className="w-full bg-transparent border border-kant-line px-3 py-2 outline-none focus:border-kant-fg transition-colors text-[15px] resize-none"
        />
      </label>

      {err ? (
        <div className="text-sm text-kant-accent">{err}</div>
      ) : null}

      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="inline-flex items-center gap-3 px-6 py-3 bg-kant-fg text-kant-bg font-mono text-xs tracking-[0.2em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-kant-accent transition-colors"
      >
        {pending ? "提交中…" : "提交"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}

export default function ReportPage() {
  const reduce = useReducedMotion();
  const [markdown, setMarkdown] = React.useState<string | null>(null);
  const [generatedAt] = React.useState(() => new Date());

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REPORT_STORAGE_KEY);
      setMarkdown(stored ?? "");
    } catch {
      setMarkdown("");
    }
  }, []);

  if (markdown === null) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <div className="font-mono text-xs tracking-widest uppercase text-kant-muted">
          Loading…
        </div>
      </main>
    );
  }

  if (markdown === "") {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-kant-muted mb-4">
            ── No Report Yet
          </div>
          <h1 className="font-display text-3xl tracking-tight mb-4">
            还没有诊断报告
          </h1>
          <p className="text-kant-muted mb-8 leading-relaxed">
            完成一次完整的对话之后，报告会自动出现在这里。
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-3 px-5 py-3 bg-kant-fg text-kant-bg font-mono text-xs tracking-[0.2em] uppercase hover:bg-kant-accent transition-colors"
          >
            开始诊断
            <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
    );
  }

  const opportunities = highlightCount(markdown);
  const dateStr = generatedAt.toISOString().slice(0, 10);

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-kant-line">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-5 w-5 bg-kant-fg transition-colors group-hover:bg-kant-accent" aria-hidden />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              Kant Consulting
            </span>
          </Link>
          <Link
            href="/chat"
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-kant-muted hover:text-kant-fg transition-colors"
          >
            ← 返回对话
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl w-full px-6 py-12 flex-1">
        <FadeUp>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-kant-muted mb-3">
            ── Diagnostic Report · {dateStr}
          </div>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-tight mb-6">
            业务自动化诊断报告
            <span className="text-kant-accent">.</span>
          </h1>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-kant-line border border-kant-line mb-12">
            <div className="bg-kant-bg p-5">
              <div className="font-mono text-[10px] tracking-widest uppercase text-kant-muted mb-2">
                Opportunities
              </div>
              <div className="font-display text-3xl tabular-nums">
                {opportunities > 0 ? <CountUp to={opportunities} /> : "—"}
              </div>
            </div>
            <div className="bg-kant-bg p-5">
              <div className="font-mono text-[10px] tracking-widest uppercase text-kant-muted mb-2">
                Word Count
              </div>
              <div className="font-display text-3xl tabular-nums">
                <CountUp to={markdown.length} />
              </div>
            </div>
            <div className="bg-kant-bg p-5 flex items-center">
              <PDFDownloadLink
                document={<ReportPdf markdown={markdown} generatedAt={generatedAt} />}
                fileName={`kant-consulting-diagnostic-${dateStr}.pdf`}
                className="inline-block w-full"
              >
                {({ loading }) => (
                  <motion.span
                    whileHover={reduce ? undefined : { scale: 1.02 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    className="group relative inline-flex items-center gap-3 w-full justify-center px-5 py-3 bg-kant-fg text-kant-bg font-mono text-xs tracking-[0.2em] uppercase overflow-hidden hover:bg-kant-accent transition-colors"
                  >
                    <span aria-hidden className="transition-transform group-hover:-translate-y-0.5">↓</span>
                    {loading ? "生成中…" : "下载 PDF"}
                  </motion.span>
                )}
              </PDFDownloadLink>
            </div>
          </div>
        </FadeUp>

        <FadeInView amount={0.1}>
          <article className="border-l-2 border-kant-fg pl-8 mb-16">
            <Markdown text={markdown} />
          </article>
        </FadeInView>

        <FadeInView amount={0.2}>
          <LeadForm markdown={markdown} />
        </FadeInView>
      </div>

      <footer className="border-t border-kant-line">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase text-kant-muted">
          <span>© Kant Consulting</span>
          <span>MVP · Beta</span>
        </div>
      </footer>
    </main>
  );
}
