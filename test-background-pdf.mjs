import { chromium } from "playwright";

const TEST_PHONE = "17767268888";
const TEST_CODE = "chijun";
const BASE_URL = "https://kant-consulting.onrender.com";

console.log("🧪 测试后台 PDF 生成流程\n");

// 1. API 登录获取 session cookie
console.log("1️⃣ 登录获取 session...");
const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: TEST_PHONE, inviteCode: TEST_CODE }),
});

if (!loginRes.ok) {
  console.error("❌ 登录失败:", loginRes.status);
  process.exit(1);
}

const loginData = await loginRes.json();
console.log("✅ 登录成功:", loginData.role);

const sessionCookie = loginRes.headers.getSetCookie().find((c) => c.startsWith("kant-session="));
if (!sessionCookie) {
  console.error("❌ 未获取到 session cookie");
  process.exit(1);
}

const sessionToken = sessionCookie.split(";")[0].split("=")[1];

// 2. 创建测试报告 (触发后台 PDF 生成)
console.log("\n2️⃣ 创建测试报告 (应触发后台 PDF 生成)...");

const testContent = `# 业务自动化诊断报告

## 执行摘要

本报告通过深度访谈与业务流程分析,识别出贵司在客户管理、订单处理和库存同步三大核心环节的自动化潜力。

## 🎯 核心发现

### 1. 客户关系管理(CRM)低效
- **现状**: 销售团队每天花费 2-3 小时手工录入客户信息至 Excel
- **影响**: 数据滞后导致销售机会响应慢,客户流失率达 15%
- **自动化机会**: 集成在线表单 + CRM 自动同步,预计节省 80% 录入时间

### 2. 订单处理流程断层
- **现状**: 订单需在 3 个系统间人工复制粘贴(邮箱 → ERP → 物流)
- **影响**: 错误率 8%,平均处理时长 25 分钟/单
- **自动化机会**: API 打通系统,实现订单自动流转,错误率降至 <1%

### 3. 库存数据不一致
- **现状**: 仓库 Excel 与线上系统库存每周手工对账
- **影响**: 超卖/缺货频发,客户投诉增加
- **自动化机会**: 实时库存同步,预警机制自动触发补货

## 💡 推荐自动化机会

| 编号 | 场景 | 优先级 | 预期ROI |
|------|------|--------|---------|
| 1 | CRM 自动录入 | 高 | 150% |
| 2 | 订单自动流转 | 高 | 200% |
| 3 | 库存实时同步 | 中 | 120% |
| 4 | 客户邮件自动回复 | 中 | 80% |
| 5 | 财务对账自动化 | 低 | 60% |

## 📊 投资回报分析

### 成本估算
- **初期投资**: 8-12 万元 (含开发、集成、培训)
- **年运维成本**: 1.5-2 万元

### 预期收益
- **人力节省**: 每年节省 3,600 工时 (约 2 个全职员工工作量)
- **错误减少**: 降低 90% 手工错误,减少客诉成本
- **响应提速**: 订单处理时间缩短 70%,客户满意度提升

**投资回报期**: 6-9 个月

## 🚀 实施路线图

### 第一阶段 (1-2 个月)
- [ ] CRM 表单自动化上线
- [ ] 订单 API 打通开发
- [ ] 库存同步测试环境搭建

### 第二阶段 (2-3 个月)
- [ ] 订单自动流转正式上线
- [ ] 库存实时同步部署
- [ ] 团队培训与流程优化

### 第三阶段 (3-4 个月)
- [ ] 客户邮件自动回复上线
- [ ] 数据看板搭建
- [ ] 持续优化与监控

## ⚠️ 风险与注意事项

- **数据安全**: 需建立访问控制,防止敏感信息泄露
- **系统兼容**: 现有 ERP 系统 API 能力有限,可能需升级
- **团队适应**: 需提前培训,避免上线后业务中断

## 📞 下一步行动

1. **技术评估**: 安排 IT 团队评估现有系统 API 对接能力
2. **预算审批**: 向管理层提交投资方案,争取 Q2 启动
3. **供应商对接**: 联系 Kant Consulting 团队获取详细实施方案

---

**报告生成时间**: ${new Date().toLocaleString("zh-CN")}
**有效期**: 本报告基于当前业务状态,建议 3 个月内启动实施以保持时效性`;

const createRes = await fetch(`${BASE_URL}/api/reports`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `kant-session=${sessionToken}`,
  },
  body: JSON.stringify({
    content: testContent,
  }),
});

if (!createRes.ok) {
  console.error("❌ 创建报告失败:", createRes.status);
  process.exit(1);
}

const { id: reportId } = await createRes.json();
console.log("✅ 报告已创建:", reportId);
console.log("   (后台 PDF 生成任务应已触发)");

// 3. 轮询检查 PDF 状态
console.log("\n3️⃣ 轮询检查 PDF 生成状态...");

let pdfStatus = "pending";
let pdfUrl = null;
let attempts = 0;
const maxAttempts = 30; // 最多等待 30 * 5秒 = 2.5分钟

while (attempts < maxAttempts && pdfStatus !== "completed" && pdfStatus !== "failed") {
  attempts++;
  await new Promise((r) => setTimeout(r, 5000)); // 每5秒检查一次

  const statusRes = await fetch(`${BASE_URL}/api/report`, {
    headers: { Cookie: `kant-session=${sessionToken}` },
  });

  if (statusRes.ok) {
    const data = await statusRes.json();
    pdfStatus = data.pdfStatus;
    pdfUrl = data.pdfUrl;
    console.log(`   [尝试 ${attempts}/${maxAttempts}] PDF 状态: ${pdfStatus}`);
  }
}

if (pdfStatus === "completed" && pdfUrl) {
  console.log("\n✅ PDF 生成完成!");
  console.log("   PDF URL:", pdfUrl);

  // 4. 测试浏览器下载
  console.log("\n4️⃣ 测试浏览器下载...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.context().addCookies([
    {
      name: "kant-session",
      value: sessionToken,
      domain: "kant-consulting.onrender.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto(`${BASE_URL}/report`, { waitUntil: "domcontentloaded" });
  console.log("   页面已加载");

  // 等待按钮可用
  await page.waitForSelector('button:has-text("下载 PDF")', { timeout: 10000 });
  console.log("   ✅ 下载按钮已显示 (状态: completed)");

  await browser.close();

  console.log("\n🎉 测试完成! 后台 PDF 生成流程正常工作");
} else if (pdfStatus === "failed") {
  console.error("\n❌ PDF 生成失败");
  process.exit(1);
} else {
  console.error("\n⏱️ PDF 生成超时 (2.5分钟内未完成)");
  console.error("   当前状态:", pdfStatus);
  process.exit(1);
}
