import { isNodeId, type NodeId } from "./nodes";

export interface ParsedState {
  advance: boolean;
  facts: string[];
}

export interface ConversationState {
  nodeId: NodeId;
  facts: string[];
}

const STATE_OPEN = "[[STATE]]";
const STATE_CLOSE = "[[/STATE]]";

const STATE_REGEX = /\[\[STATE\]+([\s\S]*?)\[\[\/STATE\]+/;
const STATE_OPEN_LOOSE = /\[\[STATE\]+/;

export function parseStateBlock(text: string): ParsedState | null {
  const m = STATE_REGEX.exec(text);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].trim()) as Partial<ParsedState>;
    const advance = obj?.advance === true;
    const facts = Array.isArray(obj?.facts)
      ? obj!.facts!.filter((x): x is string => typeof x === "string")
      : [];
    return { advance, facts };
  } catch {
    return null;
  }
}

export function stripStateBlock(text: string): string {
  return text.replace(STATE_REGEX, "").trimEnd();
}

const PARTIAL_OPEN_TAIL =
  /\[(?:\[(?:S(?:T(?:A(?:T(?:E(?:\](?:\])?)?)?)?)?)?)?)?$/;

export function cleanStreamingText(text: string): string {
  let t = text.replace(STATE_REGEX, "");
  const openMatch = STATE_OPEN_LOOSE.exec(t);
  if (openMatch) t = t.slice(0, openMatch.index);
  t = t.replace(PARTIAL_OPEN_TAIL, "");
  return t.trimEnd();
}

export function isValidConversationState(v: unknown): v is ConversationState {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<ConversationState>;
  if (!isNodeId(s.nodeId)) return false;
  if (!Array.isArray(s.facts)) return false;
  return s.facts.every((f) => typeof f === "string");
}

export const STATE_MARKERS = { open: STATE_OPEN, close: STATE_CLOSE };
