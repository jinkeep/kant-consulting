export {
  NODE_IDS,
  NODE_DEFS,
  getNode,
  nextNode,
  isNodeId,
  type NodeId,
  type NodeDef,
} from "./nodes";

export {
  parseStateBlock,
  stripStateBlock,
  cleanStreamingText,
  isValidConversationState,
  STATE_MARKERS,
  type ParsedState,
  type ConversationState,
} from "./state";

import type { NodeId } from "./nodes";

export interface ChatMessageMetadata {
  nodeId?: NodeId;
  nextNodeId?: NodeId | null;
  addedFacts?: string[];
}
