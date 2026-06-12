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
  const list = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      role: inviteCodes.role,
      isActive: inviteCodes.isActive,
      createdBy: inviteCodes.createdBy,
      createdAt: inviteCodes.createdAt,
      userPhone: users.phone,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(inviteCodes.code, users.inviteCode))
    .orderBy(inviteCodes.createdAt);

  // Group by invite code, keep only the first user for each code
  const uniqueInvites = list.reduce((acc, item) => {
    if (!acc.find(i => i.code === item.code)) {
      acc.push(item);
    }
    return acc;
  }, [] as typeof list);

  return Response.json({ invites: uniqueInvites });
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
