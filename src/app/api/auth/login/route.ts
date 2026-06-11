import { getDb } from "@/lib/db/client";
import { users, inviteCodes } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type LoginRequest = {
  phone: string;
  inviteCode: string;
};

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = (await req.json()) as LoginRequest;
    const { phone, inviteCode } = body;

    if (!phone || !inviteCode) {
      return Response.json({ error: "手机号和邀请码不能为空" }, { status: 400 });
    }

    const [invite] = await db
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, inviteCode), eq(inviteCodes.isActive, true)))
      .limit(1);

    if (!invite) {
      return Response.json({ error: "邀请码无效或已停用" }, { status: 401 });
    }

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (user) {
      if (user.inviteCode !== inviteCode) {
        return Response.json({ error: "手机号已绑定其他邀请码" }, { status: 403 });
      }
    } else {
      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        phone,
        inviteCode,
        role: invite.role,
      });
      user = { id: userId, phone, inviteCode, role: invite.role, createdAt: new Date() };
    }

    await createSession({ phone: user.phone, role: user.role, inviteCode: user.inviteCode });

    return Response.json({ success: true, role: user.role, redirect: "/chat" });
  } catch (err) {
    console.error("[/api/auth/login]", err);
    return Response.json({ error: "登录失败" }, { status: 500 });
  }
}
