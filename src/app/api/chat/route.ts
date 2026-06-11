import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import {
  getDefaults,
  getProviders,
  resolveModel,
  type CustomProvider,
} from "@/lib/providers";
import {
  getNode,
  isValidConversationState,
  nextNode,
  parseStateBlock,
  type ChatMessageMetadata,
  type ConversationState,
  type NodeId,
  type ParsedState,
} from "@/lib/conversation";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  messages: UIMessage[];
  state?: ConversationState;
  provider?: string;
  model?: string;
}

const DEFAULT_STATE: ConversationState = { nodeId: "greeting", facts: [] };

const PER_ATTEMPT_TIMEOUT_MS = 45_000;
const PER_ATTEMPT_FIRST_CHUNK_MS = 12_000;
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
              onChunk({ chunk }) {
                if (chunk.type === "text-delta") {
                  if (!firstChunkSeen) {
                    firstChunkSeen = true;
                    clearTimeout(firstChunkTimer);
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
                  const advance = parsed?.advance === true;
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

            for await (const chunk of uiStream) {
              if (!firstChunkSeen && chunk.type !== "start") {
                throw new Error("stream aborted before first chunk");
              }
              writer.write(chunk);
            }

            clearTimeout(overallTimer);
            clearTimeout(firstChunkTimer);
            recordSuccess(provider.name);
            return;
          } catch (err) {
            clearTimeout(overallTimer);
            clearTimeout(firstChunkTimer);
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
