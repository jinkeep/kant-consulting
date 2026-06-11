import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getDefaults, resolveModel } from "@/lib/providers";
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

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;
  const defaults = getDefaults();
  const providerName = body.provider ?? defaults.provider;
  const modelId = body.model ?? defaults.model;
  const state = isValidConversationState(body.state) ? body.state : DEFAULT_STATE;

  const model = resolveModel(providerName, modelId);

  let buffered = "";

  const result = streamText({
    model,
    system: buildSystemPrompt(state.nodeId, state.facts),
    messages: await convertToModelMessages(body.messages),
    onChunk({ chunk }) {
      if (chunk.type === "text-delta") buffered += chunk.text;
    },
    onError({ error }) {
      console.error("[/api/chat] streamText error:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }): ChatMessageMetadata | undefined => {
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
}
