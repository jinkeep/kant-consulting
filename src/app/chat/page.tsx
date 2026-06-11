"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  type UIMessage,
} from "ai";
import {
  NODE_IDS,
  NODE_DEFS,
  cleanStreamingText,
  type ChatMessageMetadata,
  type ConversationState,
  type NodeId,
} from "@/lib/conversation";
import { Markdown } from "@/components/Markdown";
import { ModelPicker, type ModelSelection } from "@/components/ModelPicker";
import { FadeUp } from "@/components/motion-bits";

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

const REPORT_STORAGE_KEY = "kant.lastReport";

function messageText(m: ChatUIMessage): string {
  return m.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

function ProgressBar({ activeId }: { activeId: NodeId }) {
  const reduce = useReducedMotion();
  const activeIndex = NODE_IDS.indexOf(activeId);
  return (
    <div className="border-b border-kant-line bg-kant-bg/95 backdrop-blur">
      <div className="mx-auto max-w-4xl px-6 py-4">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-kant-muted mb-3">
          ── Diagnostic Flow
        </div>
        <ol className="grid grid-cols-5 gap-2">
          {NODE_IDS.map((id, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <li key={id} className="flex flex-col gap-2">
                <div className="relative h-[3px] w-full overflow-hidden bg-kant-line">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-kant-fg"
                    initial={false}
                    animate={{ width: done || active ? "100%" : "0%" }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 220, damping: 30 }
                    }
                  />
                  {active && !reduce ? (
                    <motion.div
                      className="absolute inset-y-0 -left-1/3 w-1/3 bg-kant-accent"
                      animate={{ left: ["-33%", "100%"] }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono text-[10px] tracking-widest ${
                      active ? "text-kant-fg" : "text-kant-muted"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-[11px] ${
                      active
                        ? "text-kant-fg font-medium"
                        : done
                        ? "text-kant-fg/70"
                        : "text-kant-muted"
                    }`}
                  >
                    {NODE_DEFS[id].label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: string }) {
  const visible = status === "submitted" || status === "streaming";
  const label =
    status === "submitted" ? "正在思考……" : "正在输出……";
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 px-1"
        >
          <div className="relative h-[2px] w-16 overflow-hidden bg-kant-line">
            <div className="absolute inset-0 shimmer" />
          </div>
          <span className="font-mono text-[10px] tracking-widest uppercase text-kant-muted">
            {label}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [state, setState] = React.useState<ConversationState>({
    nodeId: "greeting",
    facts: [],
  });
  const [model, setModel] = React.useState<ModelSelection | null>(null);
  const [input, setInput] = React.useState("");
  const stateRef = React.useRef(state);
  const modelRef = React.useRef(model);
  const finalReportRef = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);
  React.useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            state: stateRef.current,
            provider: modelRef.current?.provider,
            model: modelRef.current?.model,
          },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    transport,
    onFinish: ({ message }) => {
      const meta = message.metadata;
      if (!meta) return;
      setState((prev) => {
        const merged = meta.addedFacts && meta.addedFacts.length > 0
          ? [...prev.facts, ...meta.addedFacts]
          : prev.facts;
        const nextId = (meta.nextNodeId ?? prev.nodeId) as NodeId;
        return { nodeId: nextId, facts: merged };
      });
      const finishedNode = meta.nodeId;
      if (finishedNode === "report") {
        const text = cleanStreamingText(messageText(message));
        finalReportRef.current = text;
        try {
          window.localStorage.setItem(REPORT_STORAGE_KEY, text);
        } catch {}
      }
    },
  });

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const reportReady =
    finalReportRef.current !== null && state.nodeId === "report";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (status === "submitted" || status === "streaming") return;
    setInput("");
    void sendMessage({ text });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <main className="flex flex-1 flex-col h-[100dvh]">
      <header className="flex items-center justify-between border-b border-kant-line px-6 py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-5 w-5 bg-kant-fg transition-colors group-hover:bg-kant-accent" aria-hidden />
          <span className="font-mono text-xs tracking-[0.2em] uppercase">
            Kant Consulting
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <ModelPicker value={model} onChange={setModel} />
          {reportReady ? (
            <button
              type="button"
              onClick={() => router.push("/report")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-kant-fg text-kant-bg font-mono text-xs tracking-widest uppercase hover:bg-kant-accent transition-colors"
            >
              查看报告
              <span aria-hidden>→</span>
            </button>
          ) : null}
        </div>
      </header>

      <ProgressBar activeId={state.nodeId} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
          {messages.length === 0 ? (
            <FadeUp className="text-center pt-12">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-kant-muted mb-4">
                ── Session Initialised
              </div>
              <h1 className="font-display text-3xl md:text-4xl tracking-tight mb-4">
                开始一次理性的诊断
              </h1>
              <p className="text-kant-muted max-w-md mx-auto leading-relaxed">
                在下方简短描述你的行业、规模与希望优化的核心业务流程，5 分钟内得到 ROI 优先的建议。
              </p>
            </FadeUp>
          ) : null}

          {messages.map((m) => {
            const text = cleanStreamingText(messageText(m));
            if (!text && m.role === "assistant") return null;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                {m.role === "user" ? (
                  <div className="max-w-[80%] bg-kant-fg text-kant-bg px-4 py-3 leading-relaxed whitespace-pre-wrap text-[15px]">
                    {text}
                  </div>
                ) : (
                  <div className="max-w-[92%] w-full">
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-kant-muted mb-2">
                      Kant Agent · {NODE_DEFS[(m.metadata?.nodeId ?? state.nodeId) as NodeId].label}
                    </div>
                    <div className="border-l-2 border-kant-fg pl-5">
                      <Markdown text={text} dense />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          <StatusLine status={status} />

          {error ? (
            <div className="border border-kant-accent/60 bg-kant-accent/5 text-kant-accent px-4 py-3 text-sm">
              请求出错：{error.message}
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-kant-line bg-kant-bg px-6 py-4"
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 border border-kant-line focus-within:border-kant-fg transition-colors px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                state.nodeId === "report"
                  ? "可以继续追问，或前往右上角查看报告"
                  : "Shift + Enter 换行，Enter 发送"
              }
              className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-relaxed placeholder:text-kant-muted max-h-40"
              disabled={status === "submitted" || status === "streaming"}
            />
            <button
              type="submit"
              disabled={
                !input.trim() || status === "submitted" || status === "streaming"
              }
              className="shrink-0 inline-flex items-center justify-center px-5 py-2 bg-kant-fg text-kant-bg font-mono text-xs tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-kant-accent transition-colors"
            >
              发送
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-widest uppercase text-kant-muted">
            <span>Node · {NODE_DEFS[state.nodeId].label}</span>
            <span>Facts · {state.facts.length}</span>
          </div>
        </div>
      </form>
    </main>
  );
}
