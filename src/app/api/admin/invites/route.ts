import { getDb } from "@/lib/db/client";
import { inviteCodes, users } from "@/lib/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const session = await verifySession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "无权限" }, { status: 403 });
  }

  const db = getDb();
  const list = await db.select().from(inviteCodes);
  return Response.json({ invites: list });
}

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const { code, role } = body;

  if (!code || !role) {
    return Response.json({ error: "参数缺失" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1);
  if (existing) {
    return Response.json({ error: "邀请码已存在" }, { status: 409 });
  }

  const [user] = await db.select().from(users).where(eq(users.phone, session.phone)).limit(1);

  const [invite] = await db
    .insert(inviteCodes)
    .values({
      id: randomUUID(),
      code,
      role,
      isActive: true,
      createdBy: user?.id ?? null,
    })
    .$returningId()
    .then(() => db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1));

  return Response.json({ invite });
}
