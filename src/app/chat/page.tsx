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
import { UserMenu } from "@/components/UserMenu";
import { FadeUp } from "@/components/motion-bits";

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

const REPORT_STORAGE_KEY = "kant.lastReport";
const MESSAGES_STORAGE_KEY = "kant.chat.messages";
const STATE_STORAGE_KEY = "kant.chat.state";

function messageText(m: ChatUIMessage): string {
  return m.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    if (!text) return;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      // fall through to legacy fallback
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="复制内容"
      className="inline-flex items-center gap-1.5 h-7 px-2 -ml-2 font-mono text-[10px] tracking-widest uppercase text-kant-muted hover:text-kant-fg transition-colors"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden
      >
        <rect x="9" y="9" width="13" height="13" rx="0" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span aria-live="polite">{copied ? "已复制" : "复制"}</span>
    </button>
  );
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

function StatusLine({
  status,
  nodeId,
}: {
  status: string;
  nodeId: NodeId;
}) {
  const visible = status === "submitted" || status === "streaming";
  const isReport = nodeId === "report";
  const label = isReport
    ? status === "submitted"
      ? "正在生成最终诊断报告……"
      : "正在撰写报告，请勿离开页面……"
    : status === "submitted"
    ? "正在思考……"
    : "正在输出……";
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!visible) {
      startRef.current = null;
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      if (startRef.current === null) return;
      setElapsed((Date.now() - startRef.current) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) {
    return <AnimatePresence />;
  }

  if (isReport) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="border border-kant-fg bg-kant-fg/[0.03] px-5 py-4 flex items-center justify-between gap-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative h-2 w-2 shrink-0">
              <span className="absolute inset-0 rounded-full bg-kant-accent animate-ping opacity-60" />
              <span className="absolute inset-0 rounded-full bg-kant-accent" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-kant-accent mb-1">
                ── Generating Report
              </div>
              <div className="text-[14px] leading-snug">{label}</div>
              <div className="font-mono text-[10px] tracking-widest uppercase text-kant-muted mt-1">
                通常需要 20–60 秒，请保持网络通畅
              </div>
            </div>
          </div>
          <span className="font-mono text-sm tracking-widest uppercase text-kant-fg tabular-nums shrink-0">
            {elapsed.toFixed(1)}s
          </span>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
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
        <span className="font-mono text-[10px] tracking-widest uppercase text-kant-muted tabular-nums">
          {elapsed.toFixed(1)}s
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

function loadInitialState(): ConversationState {
  if (typeof window === "undefined") return { nodeId: "greeting", facts: [] };
  try {
    const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return { nodeId: "greeting", facts: [] };
    const parsed = JSON.parse(raw) as ConversationState;
    if (
      parsed &&
      typeof parsed.nodeId === "string" &&
      Array.isArray(parsed.facts)
    ) {
      return parsed;
    }
  } catch {}
  return { nodeId: "greeting", facts: [] };
}

function loadInitialMessages(): ChatUIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatUIMessage[];
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export default function ChatPage() {
  const router = useRouter();
  const [state, setState] = React.useState<ConversationState>(() =>
    loadInitialState()
  );
  const [model, setModel] = React.useState<ModelSelection | null>(null);
  const [input, setInput] = React.useState("");
  const [initialMessages] = React.useState<ChatUIMessage[]>(() =>
    loadInitialMessages()
  );
  const [user, setUser] = React.useState<{ phone: string; role: "admin" | "user" } | null>(null);
  const stateRef = React.useRef(state);
  const modelRef = React.useRef(model);
  const finalReportRef = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.phone && data.role) {
          setUser({ phone: data.phone, role: data.role });
        }
      })
      .catch(() => {});
  }, []);

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

  const { messages, setMessages, sendMessage, status, error, regenerate } = useChat<ChatUIMessage>({
    transport,
    messages: initialMessages,
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

  React.useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(MESSAGES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          MESSAGES_STORAGE_KEY,
          JSON.stringify(messages)
        );
      }
    } catch {}
  }, [messages, status]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const onResetChat = () => {
    if (status === "submitted" || status === "streaming") return;
    if (!window.confirm("开始新会话会清空当前对话与进度，确定继续？")) return;
    setMessages([]);
    setState({ nodeId: "greeting", facts: [] });
    finalReportRef.current = null;
    try {
      window.localStorage.removeItem(MESSAGES_STORAGE_KEY);
      window.localStorage.removeItem(STATE_STORAGE_KEY);
    } catch {}
  };

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

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [input]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey) &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <main className="flex flex-1 flex-col h-[100dvh]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-kant-line bg-kant-bg px-6 py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-5 w-5 bg-kant-fg transition-colors group-hover:bg-kant-accent" aria-hidden />
          <span className="font-mono text-xs tracking-[0.2em] uppercase">
            Kant Consulting
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {user?.role === "admin" && <ModelPicker value={model} onChange={setModel} />}
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={onResetChat}
              disabled={status === "submitted" || status === "streaming"}
              className="font-mono text-[10px] tracking-widest uppercase text-kant-muted hover:text-kant-fg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              新会话
            </button>
          ) : null}
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
          {user && <UserMenu phone={user.phone} role={user.role} />}
        </div>
      </header>

      <ProgressBar activeId={state.nodeId} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 pt-10 pb-4 space-y-8">
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
                  <div className="flex flex-col items-end max-w-[80%]">
                    <div className="bg-kant-fg text-kant-bg px-4 py-3 leading-relaxed whitespace-pre-wrap text-[15px]">
                      {text}
                    </div>
                    <div className="mt-1">
                      <CopyButton text={text} />
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[92%] w-full">
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-kant-muted mb-2">
                      Kant Agent · {NODE_DEFS[(m.metadata?.nodeId ?? state.nodeId) as NodeId].label}
                    </div>
                    <div className="border-l-2 border-kant-fg pl-5">
                      <Markdown text={text} dense />
                    </div>
                    <div className="mt-1 pl-5">
                      <CopyButton text={text} />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          <StatusLine
            status={status}
            nodeId={
              (messages.length > 0
                ? (messages[messages.length - 1].metadata?.nodeId as
                    | NodeId
                    | undefined) ?? state.nodeId
                : state.nodeId)
            }
          />

          {error ? (
            <div className="border border-kant-accent/60 bg-kant-accent/5 text-kant-accent px-4 py-3 text-sm flex items-start justify-between gap-4">
              <div className="flex-1 leading-relaxed">
                请求出错：{error.message}
              </div>
              <button
                type="button"
                onClick={() => {
                  void regenerate();
                }}
                disabled={status === "submitted" || status === "streaming"}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-kant-accent text-kant-accent font-mono text-[10px] tracking-widest uppercase hover:bg-kant-accent hover:text-kant-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
                  <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                重试
              </button>
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
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                state.nodeId === "report"
                  ? "可以继续追问，或前往右上角查看报告"
                  : "Enter 换行，⌘/Ctrl + Enter 发送"
              }
              className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-relaxed placeholder:text-kant-muted overflow-y-auto"
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
