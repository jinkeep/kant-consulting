import { getDb } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type CreateReportRequest = {
  sessionId?: string;
  content: string | Record<string, unknown>;
};

export async function POST(req: Request) {
  try {
    const session = await verifySession();
    if (!session) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const body = (await req.json()) as CreateReportRequest;
    const db = getDb();

    const reportId = randomUUID();

    // Normalize content to string
    const contentString = typeof body.content === "string"
      ? body.content
      : JSON.stringify(body.content);

    const [report] = await db
      .insert(reports)
      .values({
        id: reportId,
        userPhone: session.phone,
        sessionId: body.sessionId ?? null,
        content: contentString,
        pdfStatus: "pending",
      })
      .$returningId()
      .then(() =>
        db
          .select()
          .from(reports)
          .where(eq(reports.userPhone, session.phone))
          .orderBy(desc(reports.createdAt))
          .limit(1)
      );

    // Trigger background PDF generation (fire and forget)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/report/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
    }).catch(err => console.error("Failed to trigger PDF generation:", err));

    return Response.json({ id: report.id });
  } catch (err) {
    console.error("[POST /api/reports]", err);
    return Response.json({ error: "创建报告失败" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await verifySession();
    if (!session) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const db = getDb();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (session.role === "admin" && phone) {
      const list = await db
        .select()
        .from(reports)
        .where(eq(reports.userPhone, phone))
        .orderBy(desc(reports.createdAt));
      return Response.json({ reports: list });
    }

    const list = await db
      .select()
      .from(reports)
      .where(eq(reports.userPhone, session.phone))
      .orderBy(desc(reports.createdAt));

    return Response.json({ reports: list });
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return Response.json({ error: "获取报告失败" }, { status: 500 });
  }
}
