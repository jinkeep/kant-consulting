#!/usr/bin/env node

const BASE_URL = "https://kant-consulting.onrender.com";

async function checkPdfError() {
  console.log("🔍 检查最新的 PDF 生成失败报告...\n");

  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "17767268888", inviteCode: "chijun" }),
  });

  const loginData = await loginRes.json();
  const sessionCookie = loginRes.headers.get("set-cookie")?.split(";")[0];

  if (!sessionCookie) {
    console.error("❌ 登录失败");
    console.error("响应状态:", loginRes.status);
    console.error("响应内容:", JSON.stringify(loginData, null, 2));
    process.exit(1);
  }

  console.log("✅ 登录成功\n");

  // Get reports
  const reportsRes = await fetch(`${BASE_URL}/api/reports`, {
    headers: { Cookie: sessionCookie },
  });

  const { reports } = await reportsRes.json();
  const failedReports = reports.filter(r => r.pdfStatus === "failed");

  if (failedReports.length === 0) {
    console.log("⚠️ 没有找到失败的报告");
    process.exit(0);
  }

  console.log(`📋 找到 ${failedReports.length} 个失败的报告:\n`);

  failedReports.slice(0, 5).forEach((report, i) => {
    console.log(`报告 ${i + 1}:`);
    console.log(`  ID: ${report.id}`);
    console.log(`  创建时间: ${report.createdAt}`);
    console.log(`  内容长度: ${report.content?.length || 0} 字符`);
    console.log(`  PDF 状态: ${report.pdfStatus}`);
    console.log();
  });

  // Try to manually trigger PDF generation to see the error
  const reportId = failedReports[0].id;
  console.log(`🔄 手动触发 PDF 生成以获取错误详情 (reportId: ${reportId})...\n`);

  const pdfRes = await fetch(`${BASE_URL}/api/report/generate-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": sessionCookie
    },
    body: JSON.stringify({ reportId }),
  });

  const pdfData = await pdfRes.json();

  console.log("📄 响应状态:", pdfRes.status);
  console.log("📄 响应内容:");
  console.log(JSON.stringify(pdfData, null, 2));
}

checkPdfError().catch(console.error);
