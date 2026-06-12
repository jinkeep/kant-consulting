import { NextResponse } from "next/server";
import { desc, like, eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db/client";
import { sessions, messages } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await verifySession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    const db = getDb();

    // 构建查询条件
    const conditions = search
      ? like(sessions.userPhone, `%${search}%`)
      : undefined;

    // 获取总数
    const totalResult = await db
      .select({ count: sessions.id })
      .from(sessions)
      .where(conditions);
    const total = totalResult.length;

    // 获取会话列表
    const sessionsData = await db
      .select({
        id: sessions.id,
        userPhone: sessions.userPhone,
        currentNode: sessions.currentNode,
        facts: sessions.facts,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .where(conditions)
      .orderBy(desc(sessions.updatedAt))
      .limit(limit)
      .offset(offset);

    // 获取每个会话的消息数量
    const sessionsWithCounts = await Promise.all(
      sessionsData.map(async (s) => {
        const msgCount = await db
          .select({ count: messages.id })
          .from(messages)
          .where(eq(messages.sessionId, s.id));
        return {
          ...s,
          messageCount: msgCount.length,
        };
      })
    );

    return NextResponse.json({
      sessions: sessionsWithCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[/api/admin/sessions] query error:", err);
    return NextResponse.json(
      { error: "服务器查询失败" },
      { status: 500 }
    );
  }
}
