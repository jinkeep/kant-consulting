import { NextResponse } from "next/server";
import { desc, eq, and, like } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db/client";
import { messages, sessions } from "@/lib/db/schema";

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

    // 获取所有报告消息（node_id = 'report', role = 'assistant'）
    let query = db
      .select({
        id: messages.id,
        content: messages.content,
        sessionId: messages.sessionId,
        createdAt: messages.createdAt,
        userPhone: sessions.userPhone,
      })
      .from(messages)
      .leftJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(
        and(eq(messages.role, "assistant"), eq(messages.nodeId, "report"))
      )
      .orderBy(desc(messages.createdAt))
      .$dynamic();

    // 如果有搜索条件，加上用户手机号过滤
    if (search) {
      query = query.where(
        and(
          eq(messages.role, "assistant"),
          eq(messages.nodeId, "report"),
          like(sessions.userPhone, `%${search}%`)
        )
      );
    }

    const allReports = await query;
    const total = allReports.length;

    // 分页
    const reports = allReports.slice(offset, offset + limit);

    return NextResponse.json({
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[/api/admin/reports] query error:", err);
    return NextResponse.json(
      { error: "服务器查询失败" },
      { status: 500 }
    );
  }
}
