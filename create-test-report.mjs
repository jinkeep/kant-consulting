#!/usr/bin/env node
import { chromium } from 'playwright';

// 先通过 API 登录获取 session
const loginRes = await fetch('https://kant-consulting.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '17767268888', inviteCode: 'chijun' })
});

const setCookie = loginRes.headers.get('set-cookie');
const sessionToken = setCookie?.match(/kant-session=([^;]+)/)?.[1];

if (!sessionToken) {
  console.log('❌ 登录失败');
  process.exit(1);
}

console.log('✅ 已获取 session\n');

// 创建一个测试报告
console.log('创建测试报告...');
const testMarkdown = `# 业务现状摘要

您的电商企业目前面临订单处理和库存管理两大核心挑战。

## 核心瓶颈分析

| 问题领域 | 当前状况 | 业务影响 | 紧急程度 |
|---------|---------|---------|---------|
| 订单处理 | 人工核对，容易出错 | 客户投诉增加，满意度下降 | 高 |
| 库存管理 | 混乱，缺货与积压并存 | 资金占用，销售机会流失 | 高 |

## 自动化改进方案

### 1. 订单处理自动化

**建议方案**：引入订单管理系统(OMS)

**实施步骤**：
- 第一阶段：自动订单录入和校验
- 第二阶段：智能分单和异常预警
- 第三阶段：与物流系统对接

**预期收益**：
- 订单处理效率提升 60%
- 错误率降低 80%
- 客户投诉减少 50%

### 2. 库存管理优化

**建议方案**：部署库存管理系统(WMS)

**核心功能**：
- 实时库存监控
- 安全库存预警
- 智能补货建议
- 滞销品分析

**技术选型建议**：

考虑到您的团队规模（5人）和预算限制，建议采用：

1. **SaaS 方案**（推荐）
   - 有赞、微盟等成熟平台
   - 月费 500-2000 元
   - 快速上线，无需技术维护

2. **轻量级自建方案**
   - 钉钉 + 简道云
   - 基础费用 < 1000 元/月
   - 灵活定制

## 实施路线图

### 近期目标（1-3个月）

| 时间节点 | 关键任务 | 责任人 | 预算 |
|---------|---------|-------|------|
| Week 1-2 | 需求梳理和方案选型 | 运营主管 | 0 |
| Week 3-4 | 系统试用和培训 | 全员 | 试用期免费 |
| Month 2 | 正式上线OMS | 技术支持 | 1000-3000 |
| Month 3 | 上线WMS并优化 | 仓库主管 | 1000-2000 |

### 中期目标（3-6个月）

- 完成系统磨合，优化流程
- 数据积累，建立分析看板
- 评估 ROI，决定下一步扩展

## 风险提示

⚠️ **需要注意的事项**：

1. **团队适应期**：新系统上线初期效率可能暂时下降
2. **数据迁移**：Excel 历史数据需要整理和导入
3. **流程调整**：需要重新定义操作规范

## 总结

您的问题是典型的电商企业成长痛点，通过合理的自动化工具可以有效解决。关键是：

- ✅ 选择适合当前规模的轻量级方案
- ✅ 分阶段实施，降低风险
- ✅ 重视团队培训和流程优化

建议优先上线订单管理系统，解决客户体验问题，再逐步完善库存管理。`;

const reportRes = await fetch('https://kant-consulting.onrender.com/api/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `kant-session=${sessionToken}`
  },
  body: JSON.stringify({
    content: { report: testMarkdown }
  })
});

if (!reportRes.ok) {
  console.log('❌ 创建报告失败:', await reportRes.text());
  process.exit(1);
}

const { id } = await reportRes.json();
console.log(`✅ 报告已创建: ${id}\n`);

// 现在用浏览器访问并测试 PDF 下载
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await context.addCookies([{
  name: 'kant-session',
  value: sessionToken,
  domain: 'kant-consulting.onrender.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax'
}]);

console.log('访问报告页面...');
await page.goto('https://kant-consulting.onrender.com/report', {
  waitUntil: 'domcontentloaded',
  timeout: 30000
});

await page.waitForTimeout(3000);

const bodyText = await page.textContent('body');
console.log('页面加载成功，内容长度:', bodyText.length);

// 测试 PDF 下载
console.log('\n测试 PDF 下载...');
const downloadButton = page.locator('button:has-text("下载 PDF")');
await downloadButton.waitFor({ timeout: 5000 });

const startTime = Date.now();
const downloadPromise = page.waitForEvent('download', { timeout: 90000 });

await downloadButton.click();

console.log('等待 PDF 生成...');
const download = await downloadPromise;
const duration = ((Date.now() - startTime) / 1000).toFixed(2);

const pdfPath = `/tmp/test-report-${Date.now()}.pdf`;
await download.saveAs(pdfPath);

const fs = await import('fs');
const stats = fs.statSync(pdfPath);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ PDF 下载成功！');
console.log(`⏱️  生成时间: ${duration} 秒`);
console.log(`📦 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📄 文件路径: ${pdfPath}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('查看 PDF: open', pdfPath);

await page.waitForTimeout(10000);
await browser.close();
