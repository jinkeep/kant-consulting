"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type InviteCode = {
  id: string;
  code: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: string;
};

type Report = {
  id: string;
  userPhone: string;
  createdAt: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [invites, setInvites] = React.useState<InviteCode[]>([]);
  const [reports, setReports] = React.useState<Report[]>([]);
  const [newCode, setNewCode] = React.useState("");
  const [newRole, setNewRole] = React.useState<"admin" | "user">("user");

  React.useEffect(() => {
    Promise.all([
      fetch("/api/admin/invites").then(r => r.json()),
      fetch("/api/admin/reports").then(r => r.json()),
    ]).then(([invData, repData]) => {
      setInvites(invData.invites || []);
      setReports(repData.reports || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const onCreate = async () => {
    const code = newCode.trim();
    if (!code) return;
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, role: newRole }),
    });
    if (res.ok) {
      const data = await res.json();
      setInvites([data.invite, ...invites]);
      setNewCode("");
    }
  };

  if (loading) return <div className="p-8">加载中...</div>;

  return (
    <main className="min-h-screen bg-kant-bg">
      <header className="border-b border-kant-line px-6 py-4 flex items-center justify-between">
        <Link href="/chat" className="flex items-center gap-3 group">
          <div className="h-5 w-5 bg-kant-fg transition-colors group-hover:bg-kant-accent" />
          <span className="font-mono text-xs tracking-[0.2em] uppercase">Kant · Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="font-mono text-[10px] tracking-widest uppercase text-kant-muted hover:text-kant-fg"
        >
          返回对话
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        <section>
          <h2 className="font-mono text-sm tracking-widest uppercase mb-6">邀请码管理</h2>
          <div className="border border-kant-line p-6 space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="输入新邀请码"
                className="flex-1 border border-kant-line bg-kant-bg px-3 py-2 outline-none focus:border-kant-fg"
              />
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as "admin" | "user")}
                className="border border-kant-line bg-kant-bg px-3 py-2"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="button"
                onClick={onCreate}
                className="px-6 py-2 bg-kant-fg text-kant-bg font-mono text-xs tracking-widest uppercase hover:bg-kant-accent"
              >
                生成
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kant-line text-left font-mono text-[10px] tracking-widest uppercase text-kant-muted">
                  <th className="py-2">Code</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Active</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id} className="border-b border-kant-line">
                    <td className="py-3 font-mono">{inv.code}</td>
                    <td className="py-3">{inv.role}</td>
                    <td className="py-3">{inv.isActive ? "✓" : "✗"}</td>
                    <td className="py-3 text-kant-muted text-xs">{new Date(inv.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-mono text-sm tracking-widest uppercase mb-6">全部报告</h2>
          <div className="border border-kant-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kant-line text-left font-mono text-[10px] tracking-widest uppercase text-kant-muted">
                  <th className="px-4 py-3">User Phone</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(rep => (
                  <tr key={rep.id} className="border-b border-kant-line">
                    <td className="px-4 py-3 font-mono">{rep.userPhone}</td>
                    <td className="px-4 py-3 text-kant-muted text-xs">{new Date(rep.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/report?id=${rep.id}`)}
                        className="text-kant-accent hover:underline text-xs"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
