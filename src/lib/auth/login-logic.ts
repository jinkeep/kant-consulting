import type { User, InviteCode } from "@/lib/db/schema";
import type { SessionPayload } from "./session";

// Data access the login flow needs. Kept as an interface so the branching
// logic can be unit-tested against an in-memory store and wired to Drizzle
// in the route handler.
export interface LoginStore {
  findUserByPhone(phone: string): Promise<User | null>;
  findActiveInvite(code: string): Promise<InviteCode | null>;
  createUser(input: {
    phone: string;
    inviteCode: string;
    role: "admin" | "user";
  }): Promise<User>;
  deactivateInvite(code: string): Promise<void>;
}

export type LoginInput = {
  phone: string;
  inviteCode: string;
};

export type LoginResult =
  | { ok: true; session: SessionPayload; isNewUser: boolean }
  | { ok: false; status: number; error: string };

export async function resolveLogin(
  store: LoginStore,
  input: LoginInput
): Promise<LoginResult> {
  const phone = input.phone?.trim();
  const inviteCode = input.inviteCode?.trim();

  if (!phone || !inviteCode) {
    return { ok: false, status: 400, error: "手机号和邀请码不能为空" };
  }

  // Returning users are resolved by phone first. Their invite code was
  // deactivated on first use, so we must NOT require it to be active here —
  // we only require that it still matches the code they registered with.
  const existing = await store.findUserByPhone(phone);
  if (existing) {
    if (existing.inviteCode !== inviteCode) {
      return { ok: false, status: 403, error: "手机号已绑定其他邀请码" };
    }
    return {
      ok: true,
      isNewUser: false,
      session: {
        phone: existing.phone,
        role: existing.role,
        inviteCode: existing.inviteCode,
      },
    };
  }

  // New user: the invite code must exist and still be active.
  const invite = await store.findActiveInvite(inviteCode);
  if (!invite) {
    return { ok: false, status: 401, error: "邀请码无效或已停用" };
  }

  const created = await store.createUser({
    phone,
    inviteCode,
    role: invite.role,
  });

  // Consume the code so it cannot be reused by a different person.
  await store.deactivateInvite(inviteCode);

  return {
    ok: true,
    isNewUser: true,
    session: {
      phone: created.phone,
      role: created.role,
      inviteCode: created.inviteCode,
    },
  };
}
