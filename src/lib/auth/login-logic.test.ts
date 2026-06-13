import { describe, test, expect } from "vitest";
import { resolveLogin, type LoginStore } from "./login-logic";
import type { User, InviteCode } from "@/lib/db/schema";

// In-memory implementation of the data access the login logic needs.
// Real code wires this to Drizzle; tests wire it to plain arrays so we
// exercise the actual branching logic, not a mock of it.
function makeStore(seed: {
  users?: User[];
  invites?: InviteCode[];
}): LoginStore & { users: User[]; invites: InviteCode[] } {
  const users: User[] = [...(seed.users ?? [])];
  const invites: InviteCode[] = [...(seed.invites ?? [])];
  return {
    users,
    invites,
    async findUserByPhone(phone) {
      return users.find((u) => u.phone === phone) ?? null;
    },
    async findActiveInvite(code) {
      return invites.find((i) => i.code === code && i.isActive) ?? null;
    },
    async createUser(u) {
      const created: User = {
        id: "generated-id",
        phone: u.phone,
        inviteCode: u.inviteCode,
        role: u.role,
        createdAt: new Date(),
      };
      users.push(created);
      return created;
    },
    async deactivateInvite(code) {
      const inv = invites.find((i) => i.code === code);
      if (inv) inv.isActive = false;
    },
  };
}

function invite(code: string, overrides: Partial<InviteCode> = {}): InviteCode {
  return {
    id: `inv-${code}`,
    code,
    role: "user",
    isActive: true,
    createdBy: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function user(phone: string, code: string, overrides: Partial<User> = {}): User {
  return {
    id: `user-${phone}`,
    phone,
    inviteCode: code,
    role: "user",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("resolveLogin", () => {
  test("missing phone or invite code is rejected", async () => {
    const store = makeStore({ invites: [invite("mango")] });
    const result = await resolveLogin(store, { phone: "", inviteCode: "mango" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  test("new user with a valid active invite code registers and the code is consumed", async () => {
    const store = makeStore({ invites: [invite("mango")] });

    const result = await resolveLogin(store, {
      phone: "13800000001",
      inviteCode: "mango",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.phone).toBe("13800000001");
      expect(result.session.role).toBe("user");
      expect(result.session.inviteCode).toBe("mango");
    }
    // user persisted
    expect(store.users.find((u) => u.phone === "13800000001")).toBeTruthy();
    // invite consumed so it cannot be reused by someone else
    expect(store.invites.find((i) => i.code === "mango")?.isActive).toBe(false);
  });

  test("new user inherits the invite code's role (admin invite -> admin user)", async () => {
    const store = makeStore({ invites: [invite("boss", { role: "admin" })] });

    const result = await resolveLogin(store, {
      phone: "13800000002",
      inviteCode: "boss",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.role).toBe("admin");
  });

  test("a second new user CANNOT reuse an already-consumed invite code", async () => {
    const store = makeStore({ invites: [invite("once")] });

    // first user consumes it
    await resolveLogin(store, { phone: "13800000010", inviteCode: "once" });
    // second, different user tries the same code
    const second = await resolveLogin(store, {
      phone: "13800000011",
      inviteCode: "once",
    });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(401);
    // no second account created
    expect(store.users.filter((u) => u.inviteCode === "once")).toHaveLength(1);
  });

  test("new user with an unknown invite code is rejected", async () => {
    const store = makeStore({ invites: [invite("mango")] });
    const result = await resolveLogin(store, {
      phone: "13800000003",
      inviteCode: "does-not-exist",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  test("returning user logs in with their own code EVEN AFTER the code is deactivated", async () => {
    // This is the regression we shipped a bug on: codes are deactivated on
    // first use, so a returning user always presents an inactive code.
    const store = makeStore({
      users: [user("13800000020", "mango")],
      invites: [invite("mango", { isActive: false })],
    });

    const result = await resolveLogin(store, {
      phone: "13800000020",
      inviteCode: "mango",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.phone).toBe("13800000020");
    // no duplicate account
    expect(store.users.filter((u) => u.phone === "13800000020")).toHaveLength(1);
  });

  test("existing user presenting a DIFFERENT invite code is rejected", async () => {
    const store = makeStore({
      users: [user("13800000020", "mango")],
      invites: [invite("mango", { isActive: false }), invite("other")],
    });

    const result = await resolveLogin(store, {
      phone: "13800000020",
      inviteCode: "other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
