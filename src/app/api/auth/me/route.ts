import { verifySession } from "@/lib/auth/dal";

export const runtime = "nodejs";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  return Response.json({ phone: session.phone, role: session.role });
}
