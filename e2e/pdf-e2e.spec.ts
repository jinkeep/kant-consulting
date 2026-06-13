import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kant-fallback-secret-change-in-production"
);

async function makeSessionToken() {
  return await new SignJWT({ phone: "17767268888", role: "user" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(SECRET);
}

test.describe("PDF Download from Report Page", () => {
  test("full end-to-end: seed report, navigate, download PDF", async ({
    page,
  }) => {
    // Listen for console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || type === 'warning') {
        console.log(`[Browser ${type}]:`, text);
      }
    });

    const token = await makeSessionToken();

    // Set session cookie
    await page.context().addCookies([
      {
        name: "kant-session",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);

    // Seed report via localStorage (simulating chat completion)
    const reportMarkdown = `# 业务自动化诊断报告

## 当前状态分析

### 现有流程
- 手工流程占比：60%
- 系统集成度：中等
- 数据录入效率：低

## 关键改进机会

- 自动化客户跟进流程
- 集成CRM与报表系统
- 优化数据录入环节
- 建立统一数据看板

## 实施路径

### 第一阶段（1-2个月）
客户跟进自动化，减少50%手工操作

### 第二阶段（3-4个月）
系统集成，实现数据自动同步

### 第三阶段（5-6个月）
数据流全面优化，建立实时监控`;

    await page.goto("http://localhost:3000");
    await page.evaluate((markdown) => {
      localStorage.setItem("kant.lastReport", markdown);
    }, reportMarkdown);

    // Navigate to report page
    await page.goto("http://localhost:3000/report");

    // Wait for report content to render
    await page.waitForSelector('[data-print="report"]', { timeout: 10000 });

    // Verify report content rendered (use actual content from server)
    const reportContent = await page.textContent('[data-print="report"]');
    expect(reportContent).toBeTruthy();
    expect(reportContent!.length).toBeGreaterThan(100);

    // Wait a bit for any async operations to settle
    await page.waitForTimeout(1000);

    // Set up download listener BEFORE clicking
    const downloadPromise = page.waitForEvent("download", { timeout: 60000 });

    // Click download PDF button
    console.log('Clicking download button...');
    await page.click('button:has-text("下载 PDF")');

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^kant-report-\d+\.pdf$/);

    // Verify PDF was generated
    const path = await download.path();
    expect(path).toBeTruthy();

    const fs = await import("fs");
    const stats = fs.statSync(path!);

    // PDF should be substantial (at least 10KB for this content)
    expect(stats.size).toBeGreaterThan(10000);

    console.log(`✓ PDF generated successfully: ${stats.size} bytes`);
  });
});
