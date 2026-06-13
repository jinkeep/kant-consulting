import { test, expect } from "@playwright/test";

test.describe("PDF API", () => {
  test("generates valid PDF from markdown", async ({ request }) => {
    const markdown = `# 业务自动化诊断报告

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

    const response = await request.post("http://localhost:3000/api/report/pdf", {
      data: { markdown },
      timeout: 60000,
    });

    if (!response.ok()) {
      const body = await response.text();
      console.error(`API error (${response.status()}):`, body);
      throw new Error(`PDF API returned ${response.status()}: ${body}`);
    }

    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toBe("application/pdf");

    const pdfBuffer = await response.body();
    expect(pdfBuffer.length).toBeGreaterThan(10000);

    // Verify PDF magic number
    const magic = pdfBuffer.toString("ascii", 0, 4);
    expect(magic).toBe("%PDF");

    console.log(`✓ PDF generated successfully: ${pdfBuffer.length} bytes`);
  });
});
