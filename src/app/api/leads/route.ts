import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email("邮箱格式不正确"),
  sessionId: z.string().trim().min(1).max(36).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message ?? "请求体不合法" : "请求体不合法";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const id = randomUUID();
  try {
    await getDb()
      .insert(leads)
      .values({
        id,
        email: parsed.email,
        sessionId: parsed.sessionId ?? null,
        notes: parsed.notes ?? null,
      });
  } catch (err) {
    console.error("[/api/leads] insert error:", err);
    return NextResponse.json(
      { ok: false, error: "保存失败，请稍后再试" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id });
}
