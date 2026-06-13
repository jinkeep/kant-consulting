import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";

/**
 * 报告 PDF 导出 —— 端到端排版自测。
 *
 * 背景：旧方案用 @react-pdf/renderer 手写 markdown 解析器，中文乱码且排版混乱。
 * 新方案改为浏览器原生打印（window.print + @media print）。这组测试验证：
 *   1. 报告正文（中文 / 表格 / 列表）在屏幕上正常渲染；
 *   2. 切到 print 媒体后，装饰/交互元素被隐藏、正文保留且可见；
 *   3. 真正生成一份 PDF，文件非空、确实分页排版。
 */

// 贴近真实生成结构的报告（含 4 列 ROI 表格、有序/无序列表、加粗与行内代码）
const FIXTURE_MARKDOWN = `## 业务现状摘要

贵公司目前在 **客户跟进** 与 **报价流转** 两个环节存在明显的人工瓶颈，每周约消耗 \`12\` 小时重复性工作。

## 核心瓶颈

- 销售线索散落在邮箱与微信，缺乏统一入口
- 报价单依赖手工 Excel，版本混乱、易出错
- 交付进度无看板，客户频繁询问状态

## 自动化机会

- 线索自动归集与打标
- 报价单模板化 + 一键生成 PDF
- 交付进度自动同步到客户可见看板

## 推荐自动化方案（按 ROI 排序）

| 方案 | 解决什么 | 落地难度 | 预估 ROI |
| --- | --- | --- | --- |
| 线索归集机器人 | 统一线索入口，自动分配 | 低 | 高（≈ 6h/周） |
| 报价单生成器 | 模板化报价，消除版本混乱 | 中 | 高（≈ 4h/周） |
| 交付看板同步 | 客户自助查进度，减少打扰 | 中 | 中（≈ 2h/周） |

## 下一步建议

1. 先上线线索归集机器人，两周内见效
2. 并行梳理报价模板字段
3. 第三周接入交付看板
`;

const STORAGE_KEY = "kant.lastReport";

// 与 src/proxy.ts 保持一致：cookie 名、fallback secret、payload 结构
const COOKIE_NAME = "kant-session";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kant-fallback-secret-change-in-production"
);

async function makeSessionToken(): Promise<string> {
  return new SignJWT({ phone: "13800000000", role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
}

async function seedReport(page: import("@playwright/test").Page) {
  // /report 受 proxy 中间件保护，需要有效 session cookie，否则会重定向到 /login
  const token = await makeSessionToken();
  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      url: "http://localhost:3000",
    },
  ]);

  // /api/report 未登录返回 401，页面会回退 localStorage —— 我们在导航前注入夹具
  await page.addInitScript(
    ([key, md]) => {
      window.localStorage.setItem(key, md);
    },
    [STORAGE_KEY, FIXTURE_MARKDOWN]
  );
  await page.goto("/report");
  // 等正文渲染出来（标题来自夹具）
  await expect(
    page.getByRole("heading", { name: "推荐自动化方案（按 ROI 排序）" })
  ).toBeVisible();
}

test.describe("报告导出 / 打印排版", () => {
  test("屏幕上：中文正文、表格、列表均正常渲染", async ({ page }) => {
    await seedReport(page);

    // 中文段落（加粗内联也应出现）
    await expect(page.getByText("客户跟进", { exact: false })).toBeVisible();

    // 表格：表头 4 列 + 至少 3 行数据
    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    await expect(table.locator("thead th")).toHaveCount(4);
    await expect(table.locator("tbody tr")).toHaveCount(3);
    await expect(table.getByText("线索归集机器人")).toBeVisible();

    // 列表项渲染
    await expect(page.getByText("报价单依赖手工 Excel", { exact: false })).toBeVisible();
  });

  test("打印媒体：隐藏交互/装饰元素，正文保留且可见", async ({ page }) => {
    await seedReport(page);

    // 切换到 print 媒体仿真，验证 @media print 规则生效
    await page.emulateMedia({ media: "print" });

    // 下载按钮 / 表单 / 页脚（data-print="hide"）应被隐藏
    await expect(page.getByRole("button", { name: /下载 PDF/ })).toBeHidden();
    await expect(page.getByText("想要更详细的落地方案", { exact: false })).toBeHidden();

    // 正文（data-print="report"）与表格在打印态下仍可见，没有被 motion 的 opacity:0 吃掉
    await expect(
      page.getByRole("heading", { name: "推荐自动化方案（按 ROI 排序）" })
    ).toBeVisible();
    await expect(page.locator('[data-print="report"] table').first()).toBeVisible();
    await expect(page.locator('[data-print="report"]').first()).toBeVisible();
  });

  test("生成 PDF：文件非空且完成排版", async ({ page }, testInfo) => {
    await seedReport(page);

    const outPath = testInfo.outputPath("report.pdf");
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });

    const stat = fs.statSync(outPath);
    // 一份带中文与表格的 A4 报告，正常应远大于 10KB；空白页通常只有几 KB
    expect(stat.size).toBeGreaterThan(10_000);

    // PDF 魔数校验，确认确实是 PDF 而非空文件
    const head = fs.readFileSync(outPath).subarray(0, 5).toString("latin1");
    expect(head).toBe("%PDF-");

    // 附到测试报告里，方便人工抽查
    await testInfo.attach("report.pdf", {
      path: outPath,
      contentType: "application/pdf",
    });

    // eslint-disable-next-line no-console
    console.log(`[pdf] generated ${path.basename(outPath)} — ${stat.size} bytes`);
  });
});
