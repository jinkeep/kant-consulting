import { getDb } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const session = await verifySession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "无权限" }, { status: 403 });
  }

  const db = getDb();
  const list = await db.select().from(reports).orderBy(desc(reports.createdAt));
  return Response.json({ reports: list });
}
