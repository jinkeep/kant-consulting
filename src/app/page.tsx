"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { FadeUp, FadeInView } from "@/components/motion-bits";

const STEPS = [
  {
    n: "01",
    title: "破冰分流",
    body: "识别行业，加载对应评估提示词。",
  },
  {
    n: "02",
    title: "基建探针 + 行业追问",
    body: "围绕 API、流程、数据三个维度提问。",
  },
  {
    n: "03",
    title: "诊断报告",
    body: "输出 ROI 优先级 + 第一阶段 MVP 建议。",
  },
];

export default function Home() {
  const reduce = useReducedMotion();
  return (
    <main className="flex flex-1 flex-col">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between border-b border-kant-line px-8 py-5"
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-kant-fg" aria-hidden />
          <span className="font-mono text-sm tracking-[0.2em] uppercase">
            Kant Consulting
          </span>
        </div>
        <span className="font-mono text-xs text-kant-muted tracking-widest uppercase">
          Reason · Automation · ROI
        </span>
      </motion.header>

      <section className="flex flex-1 flex-col justify-center px-8 py-24 max-w-5xl mx-auto w-full">
        <FadeUp delay={0.05}>
          <div className="font-mono text-xs tracking-widest text-kant-muted uppercase mb-8">
            AI Pre-Sales Agent · v0.1
          </div>
        </FadeUp>
        <FadeUp delay={0.2}>
          <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-8">
            用理性
            <br />
            <span className="inline-flex items-center gap-4">
              重构业务效率
              <motion.span
                className="h-3 w-3 rounded-full bg-kant-accent"
                aria-hidden
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.55,
                  type: "spring",
                  stiffness: 400,
                  damping: 14,
                }}
              />
            </span>
          </h1>
        </FadeUp>
        <FadeUp delay={0.35}>
          <p className="max-w-2xl text-lg text-kant-muted leading-relaxed mb-12">
            5 分钟对话，识别企业自动化瓶颈，生成 ROI 优先的诊断报告。
            没有套话、没有 PPT，只有可执行的第一步。
          </p>
        </FadeUp>
        <FadeUp delay={0.5}>
          <div className="flex flex-col sm:flex-row gap-4">
            <motion.div
              whileHover={
                reduce
                  ? undefined
                  : {
                      scale: 1.02,
                      boxShadow: "0 0 0 4px rgba(255, 59, 48, 0.18)",
                    }
              }
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="inline-block"
            >
              <Link
                href="/chat"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-kant-fg text-kant-bg font-medium hover:bg-kant-accent transition-colors"
              >
                开始诊断
                <motion.span
                  aria-hidden
                  className="font-mono inline-block"
                  initial={false}
                  whileHover={reduce ? undefined : { x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  →
                </motion.span>
              </Link>
            </motion.div>
            <motion.a
              href="#how-it-works"
              whileHover={reduce ? undefined : { scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="inline-flex items-center justify-center px-8 py-4 border border-kant-line hover:border-kant-fg transition-colors"
            >
              它如何工作
            </motion.a>
          </div>
        </FadeUp>
      </section>

      <section
        id="how-it-works"
        className="border-t border-kant-line px-8 py-20"
      >
        <div className="max-w-5xl mx-auto">
          <FadeInView>
            <div className="font-mono text-xs tracking-widest text-kant-muted uppercase mb-12">
              ── How it works
            </div>
          </FadeInView>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-kant-line">
            {STEPS.map((step, i) => (
              <FadeInView
                key={step.n}
                delay={0.05 * i}
                className="bg-kant-bg p-8 group cursor-default"
              >
                <div className="font-mono text-xs text-kant-muted mb-4 transition-colors group-hover:text-kant-accent">
                  {step.n}
                </div>
                <div className="text-xl font-medium mb-2">{step.title}</div>
                <div className="text-sm text-kant-muted leading-relaxed">
                  {step.body}
                </div>
              </FadeInView>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-kant-line px-8 py-6 mt-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-between font-mono text-xs text-kant-muted tracking-widest uppercase">
          <span>© Kant Consulting</span>
          <span>MVP · Beta</span>
        </div>
      </footer>
    </main>
  );
}
