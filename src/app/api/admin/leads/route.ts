import { NextResponse } from "next/server";
import { desc, like, or } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db/client";
import { leads, sessions, messages } from "@/lib/db/schema";

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
      ? or(
          like(leads.email, `%${search}%`),
          like(leads.userPhone, `%${search}%`),
          like(leads.notes, `%${search}%`)
        )
      : undefined;

    // 获取总数
    const totalResult = await db
      .select({ count: leads.id })
      .from(leads)
      .where(conditions);
    const total = totalResult.length;

    // 获取线索列表
    const leadsData = await db
      .select({
        id: leads.id,
        email: leads.email,
        userPhone: leads.userPhone,
        notes: leads.notes,
        sessionId: leads.sessionId,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(conditions)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      leads: leadsData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[/api/admin/leads] query error:", err);
    return NextResponse.json(
      { error: "服务器查询失败" },
      { status: 500 }
    );
  }
}
