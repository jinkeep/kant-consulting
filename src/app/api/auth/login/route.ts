import { getDb } from "@/lib/db/client";
import { users, inviteCodes } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";
import { resolveLogin, type LoginStore } from "@/lib/auth/login-logic";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type LoginRequest = {
  phone: string;
  inviteCode: string;
};

// Wire the pure login logic to Drizzle. The branching lives in resolveLogin
// (unit-tested); this just provides real data access.
function drizzleStore(db: ReturnType<typeof getDb>): LoginStore {
  return {
    async findUserByPhone(phone) {
      const [u] = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      return u ?? null;
    },
    async findActiveInvite(code) {
      const [inv] = await db
        .select()
        .from(inviteCodes)
        .where(and(eq(inviteCodes.code, code), eq(inviteCodes.isActive, true)))
        .limit(1);
      return inv ?? null;
    },
    async createUser(input) {
      const id = randomUUID();
      await db.insert(users).values({
        id,
        phone: input.phone,
        inviteCode: input.inviteCode,
        role: input.role,
      });
      return {
        id,
        phone: input.phone,
        inviteCode: input.inviteCode,
        role: input.role,
        createdAt: new Date(),
      };
    },
    async deactivateInvite(code) {
      await db
        .update(inviteCodes)
        .set({ isActive: false })
        .where(eq(inviteCodes.code, code));
    },
  };
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = (await req.json()) as LoginRequest;

    const result = await resolveLogin(drizzleStore(db), {
      phone: body.phone,
      inviteCode: body.inviteCode,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    await createSession(result.session);

    return Response.json({
      success: true,
      role: result.session.role,
      redirect: "/chat",
    });
  } catch (err) {
    console.error("[/api/auth/login]", err);
    return Response.json({ error: "登录失败" }, { status: 500 });
  }
}
