import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-kant-line px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-kant-fg" aria-hidden />
          <span className="font-mono text-sm tracking-[0.2em] uppercase">
            Kant Consulting
          </span>
        </div>
        <span className="font-mono text-xs text-kant-muted tracking-widest uppercase">
          Reason · Automation · ROI
        </span>
      </header>

      <section className="flex flex-1 flex-col justify-center px-8 py-24 max-w-5xl mx-auto w-full">
        <div className="font-mono text-xs tracking-widest text-kant-muted uppercase mb-8">
          AI Pre-Sales Agent · v0.1
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-8">
          用理性
          <br />
          <span className="inline-flex items-center gap-4">
            重构业务效率
            <span className="h-3 w-3 rounded-full bg-kant-accent" aria-hidden />
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-kant-muted leading-relaxed mb-12">
          5 分钟对话，识别企业自动化瓶颈，生成 ROI 优先的诊断报告。
          没有套话、没有 PPT，只有可执行的第一步。
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/chat"
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-kant-fg text-kant-bg font-medium hover:bg-kant-accent transition-colors"
          >
            开始诊断
            <span aria-hidden className="font-mono">
              →
            </span>
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center px-8 py-4 border border-kant-line hover:border-kant-fg transition-colors"
          >
            它如何工作
          </a>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-kant-line px-8 py-20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-xs tracking-widest text-kant-muted uppercase mb-12">
            ── How it works
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-kant-line">
            {[
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
            ].map((step) => (
              <div key={step.n} className="bg-kant-bg p-8">
                <div className="font-mono text-xs text-kant-muted mb-4">
                  {step.n}
                </div>
                <div className="text-xl font-medium mb-2">{step.title}</div>
                <div className="text-sm text-kant-muted leading-relaxed">
                  {step.body}
                </div>
              </div>
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
