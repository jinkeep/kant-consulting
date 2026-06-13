import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Render free tier 允许最多 30s

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kant-fallback-secret-change-in-production"
);

export async function POST(request: NextRequest) {
  try {
    const { markdown } = await request.json();

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json(
        { error: "markdown 字段必填且必须是字符串" },
        { status: 400 }
      );
    }

    // 获取当前请求的 origin（开发环境 localhost:3000，生产环境 Render 域名）
    const origin =
      process.env.NEXT_PUBLIC_BASE_URL ||
      request.headers.get("origin") ||
      `http://localhost:${process.env.PORT || 3000}`;

    // 启动 headless chromium
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"], // Render 容器环境需要
    });

    const page = await browser.newPage();

    // 生成临时 session token（绕过中间件验证，有效期 5 分钟）
    const tempToken = await new SignJWT({ phone: "pdf-generator", role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(SECRET);

    await page.context().addCookies([
      {
        name: "kant-session",
        value: tempToken,
        domain: new URL(origin).hostname,
        path: "/",
      },
    ]);

    // 先访问页面，然后通过 evaluate 注入 markdown（避免 URL 长度限制）
    const reportUrl = `${origin}/report`;

    await page.goto(reportUrl, { waitUntil: "networkidle" });

    // 在页面上下文中设置 localStorage，然后刷新
    await page.evaluate((md: string) => {
      localStorage.setItem("kant.lastReport", md);
    }, markdown);

    // 刷新页面让 React 读取 localStorage
    await page.reload({ waitUntil: "networkidle" });

    // 等待 Markdown 渲染完成（检查报告容器是否存在）
    await page.waitForSelector('[data-print="report"]', { timeout: 10000 });

    // 生成 PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    // 返回 PDF 文件流（Buffer 转 Uint8Array）
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kant-report-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF 生成失败:", error);
    return NextResponse.json(
      {
        error: "PDF 生成失败",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
