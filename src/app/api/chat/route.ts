import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getDefaults,
  getProviders,
  resolveModel,
  type CustomProvider,
} from "@/lib/providers";
import {
  cleanStreamingText,
  getNode,
  isValidConversationState,
  nextNode,
  parseStateBlock,
  type ChatMessageMetadata,
  type ConversationState,
  type NodeId,
  type ParsedState,
} from "@/lib/conversation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { messages as messagesTable, sessions } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatRequest {
  messages: UIMessage[];
  state?: ConversationState;
  provider?: string;
  model?: string;
}

const DEFAULT_STATE: ConversationState = { nodeId: "greeting", facts: [] };

const PER_ATTEMPT_TIMEOUT_MS = 180_000;
const PER_ATTEMPT_FIRST_CHUNK_MS = 60_000;
const MAX_ROUNDS = 3;
const FAILURES_BEFORE_COOLDOWN = 3;
const COOLDOWN_MS = 3 * 60_000;

interface ProviderHealth {
  failures: number;
  cooldownUntil: number;
}

const providerHealth = new Map<string, ProviderHealth>();

function getCooldownRemainingMs(name: string): number {
  const h = providerHealth.get(name);
  if (!h) return 0;
  return Math.max(0, h.cooldownUntil - Date.now());
}

function recordSuccess(name: string): void {
  providerHealth.set(name, { failures: 0, cooldownUntil: 0 });
}

function recordFailure(name: string): void {
  const prev = providerHealth.get(name) ?? { failures: 0, cooldownUntil: 0 };
  const failures = prev.failures + 1;
  if (failures >= FAILURES_BEFORE_COOLDOWN) {
    console.warn(
      `[/api/chat] provider=${name} reached ${FAILURES_BEFORE_COOLDOWN} consecutive failures, cooling down ${
        COOLDOWN_MS / 1000
      }s`
    );
    providerHealth.set(name, {
      failures: 0,
      cooldownUntil: Date.now() + COOLDOWN_MS,
    });
  } else {
    providerHealth.set(name, { failures, cooldownUntil: 0 });
  }
}

function buildSystemPrompt(nodeId: NodeId, facts: string[]): string {
  const node = getNode(nodeId);
  const factsBlock =
    facts.length === 0
      ? "（暂无已确认事实）"
      : facts.map((f, i) => `${i + 1}. ${f}`).join("\n");
  return `${node.prompt}

---
## 已确认事实
${factsBlock}
---`;
}

function pickModel(provider: CustomProvider, requested?: string): string {
  if (requested && provider.models.some((m) => m.id === requested)) {
    return requested;
  }
  return provider.models[0].id;
}

function orderProviders(
  primaryName: string,
  all: CustomProvider[]
): CustomProvider[] {
  const primary = all.find((p) => p.name === primaryName);
  const rest = all.filter((p) => p.name !== primaryName);
  return primary ? [primary, ...rest] : all;
}

function extractUserText(msg: UIMessage | undefined): string {
  if (!msg || msg.role !== "user") return "";
  const parts = (msg as UIMessage).parts ?? [];
  const out: string[] = [];
  for (const p of parts) {
    if (p && typeof p === "object" && "type" in p && p.type === "text") {
      const t = (p as { text?: unknown }).text;
      if (typeof t === "string") out.push(t);
    }
  }
  return out.join("\n").trim();
}

async function ensureSessionRow(
  db: ReturnType<typeof getDb>,
  phone: string,
  state: ConversationState
): Promise<string> {
  const found = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userPhone, phone))
    .orderBy(desc(sessions.updatedAt))
    .limit(1);
  if (found.length > 0) return found[0].id;
  const id = randomUUID();
  await db.insert(sessions).values({
    id,
    userPhone: phone,
    currentNode: state.nodeId,
    facts: state.facts,
  });
  return id;
}

async function persistAssistant(
  dbSessionId: string | null,
  state: ConversationState,
  buffered: string,
  forcedAdvance: boolean
): Promise<void> {
  if (!dbSessionId) return;
  try {
    const db = getDb();
    const parsed: ParsedState | null = parseStateBlock(buffered);
    const advance = parsed?.advance === true || forcedAdvance;
    const next = advance ? nextNode(state.nodeId) : state.nodeId;
    const addedFacts = parsed?.facts ?? [];
    const content = cleanStreamingText(buffered).trim();

    await db.insert(messagesTable).values({
      id: randomUUID(),
      sessionId: dbSessionId,
      role: "assistant",
      content,
      nodeId: state.nodeId,
      metadata: { nodeId: state.nodeId, nextNodeId: next, addedFacts },
    });

    const mergedFacts = addedFacts.length
      ? Array.from(new Set([...state.facts, ...addedFacts]))
      : state.facts;
    await db
      .update(sessions)
      .set({ currentNode: next ?? state.nodeId, facts: mergedFacts })
      .where(eq(sessions.id, dbSessionId));
  } catch (err) {
    console.error("[/api/chat] persist assistant message failed:", err);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;
  const defaults = getDefaults();
  const requestedProvider = body.provider ?? defaults.provider;
  const requestedModel = body.model ?? defaults.model;
  const state = isValidConversationState(body.state) ? body.state : DEFAULT_STATE;

  const providers = orderProviders(requestedProvider, getProviders());
  const messages = await convertToModelMessages(body.messages);
  const system = buildSystemPrompt(state.nodeId, state.facts);

  let buffered = "";
  let activeProviderName = providers[0]?.name ?? requestedProvider;

  const session = await getSession();
  const phone = session?.phone ?? null;

  let dbSessionId: string | null = null;
  if (phone) {
    try {
      const db = getDb();
      dbSessionId = await ensureSessionRow(db, phone, state);
      const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
      const userText = extractUserText(lastUser);
      if (userText) {
        await db.insert(messagesTable).values({
          id: randomUUID(),
          sessionId: dbSessionId,
          role: "user",
          content: userText,
          nodeId: state.nodeId,
        });
      }
    } catch (err) {
      console.error("[/api/chat] persist user message failed:", err);
      dbSessionId = null;
    }
  }

  // 防卡死：若模型在同一节点已连续应答 ≥2 轮仍不肯 advance，则强制推进。
  // 只对会"过度追问"的节点生效（infra_probe / domain_expert）。
  // 这里一次性算出，下面同时用于流式 metadata 与落库，避免前后端状态不一致。
  let forceAdvance = false;
  if (
    dbSessionId &&
    (state.nodeId === "infra_probe" || state.nodeId === "domain_expert")
  ) {
    try {
      const db = getDb();
      const recentMsgs = await db
        .select({ nodeId: messagesTable.nodeId, role: messagesTable.role })
        .from(messagesTable)
        .where(eq(messagesTable.sessionId, dbSessionId))
        .orderBy(desc(messagesTable.createdAt))
        .limit(6);
      const consecutiveTurns = recentMsgs.filter(
        (m) => m.role === "assistant" && m.nodeId === state.nodeId
      ).length;
      if (consecutiveTurns >= 1) {
        console.warn(
          `[/api/chat] forced advance: ${state.nodeId} stuck for ${consecutiveTurns + 1} assistant turns`
        );
        forceAdvance = true;
      }
    } catch (err) {
      console.error("[/api/chat] forceAdvance check failed:", err);
    }
  }

  const allCoolingDown = providers.every(
    (p) => getCooldownRemainingMs(p.name) > 0
  );
  if (allCoolingDown) {
    console.warn(
      `[/api/chat] all providers cooling down, bypassing cooldown for this request and resetting health`
    );
    for (const p of providers) providerHealth.delete(p.name);
  }

  const stream = createUIMessageStream<UIMessage<ChatMessageMetadata>>({
    execute: async ({ writer }) => {
      const errors: string[] = [];
      let attemptIndex = 0;
      let forwardedText = false;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        for (const provider of providers) {
          const cooldownRemaining = getCooldownRemainingMs(provider.name);
          if (cooldownRemaining > 0) {
            console.warn(
              `[/api/chat] provider=${provider.name} skipped (cooldown ${Math.ceil(
                cooldownRemaining / 1000
              )}s remaining)`
            );
            continue;
          }

          const modelId = pickModel(provider, requestedModel);
          const isFirstAttempt = attemptIndex === 0;
          attemptIndex += 1;

          const abortController = new AbortController();
          const overallTimer = setTimeout(
            () =>
              abortController.abort(
                new Error(`overall timeout after ${PER_ATTEMPT_TIMEOUT_MS}ms`)
              ),
            PER_ATTEMPT_TIMEOUT_MS
          );
          const firstChunkTimer = setTimeout(
            () =>
              abortController.abort(
                new Error(
                  `first chunk timeout after ${PER_ATTEMPT_FIRST_CHUNK_MS}ms`
                )
              ),
            PER_ATTEMPT_FIRST_CHUNK_MS
          );
          let firstChunkSeen = false;

          try {
            const model = resolveModel(provider.name, modelId);

            const result = streamText({
              model,
              system,
              messages,
              abortSignal: abortController.signal,
              maxRetries: 0,
              providerOptions: {
                anthropic: {
                  thinking: { type: "disabled" },
                },
              },
              onChunk({ chunk }) {
                if (chunk.type === "text-delta") {
                  if (!firstChunkSeen) {
                    firstChunkSeen = true;
                    clearTimeout(firstChunkTimer);
                    clearTimeout(overallTimer);
                  }
                  buffered += chunk.text;
                }
              },
            });

            activeProviderName = provider.name;

            const uiStream = result.toUIMessageStream({
              sendStart: isFirstAttempt,
              sendFinish: true,
              messageMetadata: ({
                part,
              }): ChatMessageMetadata | undefined => {
                if (part.type === "start") {
                  return { nodeId: state.nodeId };
                }
                if (part.type === "finish") {
                  const parsed: ParsedState | null = parseStateBlock(buffered);
                  const advance = parsed?.advance === true || forceAdvance;
                  const next = advance ? nextNode(state.nodeId) : state.nodeId;
                  return {
                    nodeId: state.nodeId,
                    nextNodeId: next,
                    addedFacts: parsed?.facts ?? [],
                  };
                }
                return undefined;
              },
            });

            let hasText = false;
            type WriterChunk = Parameters<typeof writer.write>[0];
            for await (const chunk of uiStream as AsyncIterable<WriterChunk>) {
              if (chunk.type === "error") {
                const errText = (chunk as { errorText?: unknown }).errorText;
                const errMsg = typeof errText === "string" ? errText : "stream error";
                throw new Error(errMsg);
              }
              if (chunk.type === "abort" && !hasText) {
                throw new Error("stream aborted before first chunk");
              }
              if (chunk.type === "text-delta") {
                hasText = true;
                forwardedText = true;
              }
              writer.write(chunk);
            }

            clearTimeout(overallTimer);
            clearTimeout(firstChunkTimer);
            recordSuccess(provider.name);
            await persistAssistant(dbSessionId, state, buffered, forceAdvance);
            return;
          } catch (err) {
            clearTimeout(overallTimer);
            clearTimeout(firstChunkTimer);
            if (forwardedText) {
              // 已经向客户端写出过文本，再切换 provider 只会把另一份输出
              // 拼接到半截内容后面 → 报告损坏。直接终止本次请求。
              recordFailure(provider.name);
              throw err;
            }
            recordFailure(provider.name);
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${provider.name}#r${round + 1}: ${msg}`);
            console.error(
              `[/api/chat] provider=${provider.name} failed (round ${
                round + 1
              }/${MAX_ROUNDS}, attempt ${attemptIndex}), falling over:`,
              msg
            );
            buffered = "";
          }
        }
      }

      throw new Error(
        `所有 Provider 均不可用（已轮询 ${MAX_ROUNDS} 轮）：${
          errors.join(" | ") || "未知错误"
        }`
      );
    },
    onError(error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[/api/chat] stream failed:", msg);
      return msg;
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-active-provider": activeProviderName },
  });
}
