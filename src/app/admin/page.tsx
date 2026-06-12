"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Lead {
  id: string;
  email: string;
  userPhone: string | null;
  notes: string | null;
  sessionId: string | null;
  createdAt: string;
}

interface Report {
  id: string;
  content: string;
  sessionId: string;
  userPhone: string | null;
  createdAt: string;
}

interface Session {
  id: string;
  userPhone: string | null;
  currentNode: string;
  facts: string[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface InviteCode {
  id: string;
  code: string;
  role: "admin" | "user";
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  userPhone: string | null;
}

type Tab = "leads" | "reports" | "sessions" | "invites";

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(
    (searchParams.get("tab") as Tab) || "leads"
  );
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [reports, setReports] = React.useState<Report[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [invites, setInvites] = React.useState<InviteCode[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [expandedReport, setExpandedReport] = React.useState<string | null>(
    null
  );
  const [newInviteCode, setNewInviteCode] = React.useState("");
  const [newInviteRole, setNewInviteRole] = React.useState<"admin" | "user">(
    "user"
  );
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [inviteError, setInviteError] = React.useState("");

  const limit = 20;

  React.useEffect(() => {
    fetchData();
  }, [tab, page, search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === "invites") {
        // 邀请码不需要分页
        const res = await fetch("/api/admin/invites");
        if (!res.ok) throw new Error("获取数据失败");
        const data = await res.json();
        setInvites(data.invites);
        setTotal(data.invites.length);
        setTotalPages(1);
      } else {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(search && { search }),
        });

        const endpoint =
          tab === "leads"
            ? "/api/admin/leads"
            : tab === "reports"
              ? "/api/admin/reports"
              : "/api/admin/sessions";

        const res = await fetch(`${endpoint}?${params}`);
        if (!res.ok) throw new Error("获取数据失败");

        const data = await res.json();
        setTotal(data.total);
        setTotalPages(data.totalPages);

        if (tab === "leads") setLeads(data.leads);
        else if (tab === "reports") setReports(data.reports);
        else setSessions(data.sessions);
      }
    } catch (err) {
      console.error("fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteLoading(true);

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newInviteCode, role: newInviteRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "创建失败");
        setInviteLoading(false);
        return;
      }

      setNewInviteCode("");
      setNewInviteRole("user");
      fetchData(); // 刷新列表
    } catch {
      setInviteError("网络错误，请重试");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setPage(1);
    setSearch("");
    router.push(`/admin?tab=${newTab}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <main className="min-h-[100dvh] bg-kant-bg text-kant-fg">
      <header className="border-b border-kant-line">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="h-5 w-5 bg-kant-fg transition-colors group-hover:bg-kant-accent"
              aria-hidden
            />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              Kant Consulting · Admin
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-tight mb-6">
            后台管理<span className="text-kant-accent">.</span>
          </h1>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-kant-line">
            <button
              onClick={() => handleTabChange("leads")}
              className={`px-4 py-2 font-mono text-xs tracking-wider uppercase border-b-2 transition-colors ${
                tab === "leads"
                  ? "border-kant-fg text-kant-fg"
                  : "border-transparent text-kant-muted hover:text-kant-fg"
              }`}
            >
              线索 (Leads)
            </button>
            <button
              onClick={() => handleTabChange("reports")}
              className={`px-4 py-2 font-mono text-xs tracking-wider uppercase border-b-2 transition-colors ${
                tab === "reports"
                  ? "border-kant-fg text-kant-fg"
                  : "border-transparent text-kant-muted hover:text-kant-fg"
              }`}
            >
              报告 (Reports)
            </button>
            <button
              onClick={() => handleTabChange("sessions")}
              className={`px-4 py-2 font-mono text-xs tracking-wider uppercase border-b-2 transition-colors ${
                tab === "sessions"
                  ? "border-kant-fg text-kant-fg"
                  : "border-transparent text-kant-muted hover:text-kant-fg"
              }`}
            >
              会话 (Sessions)
            </button>
            <button
              onClick={() => handleTabChange("invites")}
              className={`px-4 py-2 font-mono text-xs tracking-wider uppercase border-b-2 transition-colors ${
                tab === "invites"
                  ? "border-kant-fg text-kant-fg"
                  : "border-transparent text-kant-muted hover:text-kant-fg"
              }`}
            >
              邀请码 (Invites)
            </button>
          </div>
        </div>

        {/* Search */}
        {tab !== "invites" && (
          <form onSubmit={handleSearch} className="mb-6 flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "leads"
                  ? "搜索邮箱、手机号或备注..."
                  : tab === "reports"
                    ? "搜索用户手机号..."
                    : "搜索用户手机号..."
              }
              className="flex-1 bg-transparent border border-kant-line px-4 py-2 outline-none focus:border-kant-fg transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-kant-fg text-kant-bg font-mono text-xs tracking-wider uppercase hover:bg-kant-accent transition-colors"
            >
              搜索
            </button>
          </form>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-kant-muted font-mono text-xs tracking-widest uppercase">
            加载中...
          </div>
        )}

        {/* Leads Table */}
        {!loading && tab === "leads" && (
          <div className="border border-kant-line overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-kant-line bg-kant-bg">
                <tr>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    邮箱
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    手机号
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    备注
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    提交时间
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-kant-line hover:bg-kant-line/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">{lead.email}</td>
                    <td className="px-4 py-3 text-sm">
                      {lead.userPhone || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-kant-muted max-w-md truncate">
                      {lead.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-kant-muted whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleString("zh-CN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reports Table */}
        {!loading && tab === "reports" && (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border border-kant-line p-6 hover:border-kant-fg transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-mono text-xs tracking-wider uppercase text-kant-muted mb-1">
                      用户手机号
                    </div>
                    <div className="text-lg">{report.userPhone || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs tracking-wider uppercase text-kant-muted mb-1">
                      生成时间
                    </div>
                    <div className="text-sm text-kant-muted">
                      {new Date(report.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
                {expandedReport === report.id ? (
                  <div className="prose prose-sm max-w-none mb-4 whitespace-pre-wrap border-t border-kant-line pt-4">
                    {report.content}
                  </div>
                ) : (
                  <div className="text-sm text-kant-muted mb-4 line-clamp-3">
                    {report.content}
                  </div>
                )}
                <button
                  onClick={() =>
                    setExpandedReport(
                      expandedReport === report.id ? null : report.id
                    )
                  }
                  className="text-kant-fg hover:text-kant-accent font-mono text-xs tracking-wider uppercase transition-colors"
                >
                  {expandedReport === report.id ? "收起 ↑" : "展开完整报告 ↓"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sessions Table */}
        {!loading && tab === "sessions" && (
          <div className="border border-kant-line overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-kant-line bg-kant-bg">
                <tr>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    用户
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    当前节点
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    消息数
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    事实数
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                    更新时间
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-kant-line hover:bg-kant-line/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">
                      {session.userPhone || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block px-2 py-1 bg-kant-line rounded text-xs font-mono">
                        {session.currentNode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {session.messageCount}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {session.facts.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-kant-muted whitespace-nowrap">
                      {new Date(session.updatedAt).toLocaleString("zh-CN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invites Section */}
        {!loading && tab === "invites" && (
          <div className="space-y-6">
            {/* Create Invite Form */}
            <div className="border border-kant-line p-6">
              <h2 className="font-mono text-xs tracking-wider uppercase text-kant-muted mb-4">
                创建新邀请码
              </h2>
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs tracking-wider uppercase text-kant-muted mb-2">
                    邀请码
                  </label>
                  <input
                    type="text"
                    value={newInviteCode}
                    onChange={(e) => setNewInviteCode(e.target.value)}
                    placeholder="输入邀请码（为空则自动生成）"
                    className="w-full bg-transparent border border-kant-line px-4 py-2 outline-none focus:border-kant-fg transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs tracking-wider uppercase text-kant-muted mb-2">
                    角色
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="user"
                        checked={newInviteRole === "user"}
                        onChange={(e) =>
                          setNewInviteRole(e.target.value as "admin" | "user")
                        }
                        className="cursor-pointer"
                      />
                      <span className="text-sm">User</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={newInviteRole === "admin"}
                        onChange={(e) =>
                          setNewInviteRole(e.target.value as "admin" | "user")
                        }
                        className="cursor-pointer"
                      />
                      <span className="text-sm">Admin</span>
                    </label>
                  </div>
                </div>

                {inviteError && (
                  <div className="text-sm text-kant-accent">{inviteError}</div>
                )}

                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-6 py-2 bg-kant-fg text-kant-bg font-mono text-xs tracking-wider uppercase hover:bg-kant-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? "创建中..." : "创建邀请码"}
                </button>
              </form>
            </div>

            {/* Invites Table */}
            <div className="border border-kant-line overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-kant-line bg-kant-bg">
                  <tr>
                    <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                      邀请码
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                      角色
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                      状态
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                      绑定手机号
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                      创建者
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs tracking-wider uppercase text-kant-muted">
                      创建时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr
                      key={invite.id}
                      className="border-b border-kant-line hover:bg-kant-line/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono">
                        {invite.code}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                            invite.role === "admin"
                              ? "bg-kant-accent/20 text-kant-accent"
                              : "bg-kant-line"
                          }`}
                        >
                          {invite.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            invite.isActive
                              ? "bg-green-500/20 text-green-600"
                              : "bg-gray-500/20 text-gray-600"
                          }`}
                        >
                          {invite.isActive ? "激活" : "已用"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {invite.userPhone || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-kant-muted">
                        {invite.createdBy || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-kant-muted whitespace-nowrap">
                        {new Date(invite.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          ((tab === "leads" && leads.length === 0) ||
            (tab === "reports" && reports.length === 0) ||
            (tab === "sessions" && sessions.length === 0) ||
            (tab === "invites" && invites.length === 0)) && (
            <div className="text-center py-12 border border-kant-line">
              <div className="text-kant-muted mb-2">暂无数据</div>
              <div className="text-xs text-kant-muted">
                {search && "未找到匹配的记录"}
              </div>
            </div>
          )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-kant-muted">
              共 {total} 条记录，第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-kant-line font-mono text-xs tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-kant-fg transition-colors"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-kant-line font-mono text-xs tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-kant-fg transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
