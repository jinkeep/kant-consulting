import { NextResponse } from "next/server";
import { desc, eq, and, inArray } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db/client";
import { messages, sessions, reports } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const db = getDb();

    // 1. 找该用户最近的报告记录
    const latestReport = await db
      .select()
      .from(reports)
      .where(eq(reports.userPhone, session.phone))
      .orderBy(desc(reports.createdAt))
      .limit(1);

    if (latestReport.length > 0) {
      const report = latestReport[0];

      return NextResponse.json({
        report: report.content,
        generatedAt: report.createdAt.toISOString(),
        reportId: report.id,
        pdfStatus: report.pdfStatus,
        pdfUrl: report.pdfUrl,
      });
    }

    // 2. 兜底：从 messages 表查找（向后兼容）
    const userSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userPhone, session.phone))
      .orderBy(desc(sessions.updatedAt))
      .limit(10);

    if (userSessions.length === 0) {
      return NextResponse.json({ report: null });
    }

    const sessionIds = userSessions.map((s) => s.id);

    const reportMsg = await db
      .select({
        content: messages.content,
        createdAt: messages.createdAt,
        sessionId: messages.sessionId,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.sessionId, sessionIds),
          eq(messages.role, "assistant"),
          eq(messages.nodeId, "report")
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (reportMsg.length === 0) {
      return NextResponse.json({ report: null });
    }

    return NextResponse.json({
      report: reportMsg[0].content,
      generatedAt: reportMsg[0].createdAt.toISOString(),
      sessionId: reportMsg[0].sessionId,
    });
  } catch (err) {
    console.error("[/api/report] query error:", err);
    return NextResponse.json(
      { error: "服务器查询失败" },
      { status: 500 }
    );
  }
}
