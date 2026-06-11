"use client";

import { useState } from "react";
import { motion } from "motion/react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, inviteCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败");
        setLoading(false);
        return;
      }

      window.location.href = data.redirect ?? "/chat";
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mb-3 inline-block h-8 w-8 bg-kant-fg" />
          <h1 className="text-2xl font-semibold">登录 Kant Consulting</h1>
          <p className="mt-2 text-sm text-kant-muted">
            输入手机号和邀请码以继续
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              手机号
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full border border-kant-line bg-kant-bg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-kant-accent"
              placeholder="请输入手机号"
            />
          </div>

          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
              邀请码
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full border border-kant-line bg-kant-bg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-kant-accent"
              placeholder="请输入邀请码"
            />
          </div>

          {error && (
            <div className="rounded border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kant-fg px-4 py-3 font-medium text-kant-bg transition-colors hover:bg-kant-accent disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
