"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

type UserMenuProps = {
  phone: string;
  role: "admin" | "user";
};

export function UserMenu({ phone, role }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const maskedPhone = phone.slice(0, -4) + "****";

  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="用户菜单"
        className="flex h-8 w-8 items-center justify-center border border-kant-line hover:border-kant-fg transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 border border-kant-line bg-kant-bg shadow-lg z-50"
          >
            <div className="border-b border-kant-line px-4 py-3">
              <div className="text-xs text-kant-muted mb-1">手机号</div>
              <div className="font-mono text-sm">{maskedPhone}</div>
              {role === "admin" && (
                <div className="mt-2 inline-block rounded-full bg-kant-accent/10 px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase text-kant-accent">
                  Admin
                </div>
              )}
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/report");
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-kant-line transition-colors"
              >
                查看报告
              </button>
              {role === "admin" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/admin");
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-kant-line transition-colors"
                >
                  管理后台
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-kant-line transition-colors"
              >
                退出登录
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
