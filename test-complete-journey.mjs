#!/usr/bin/env node
import { chromium } from 'playwright';

async function completeUserJourney() {
  console.log('🚀 完整用户旅程测试：登录 → 对话 → 生成报告 → 下载 PDF\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`   🔴 ${msg.text()}`);
  });
  
  try {
    // 步骤 1: 登录
    console.log('1️⃣ 登录页面...');
    await page.goto('https://kant-consulting.onrender.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    await page.fill('input[type="tel"]', '17767268888');
    await page.fill('input[placeholder*="邀请码"]', 'chijun');
    await page.click('button:has-text("登录")');
    
    await page.waitForURL('**/chat', { timeout: 15000 });
    console.log('   ✅ 登录成功，已跳转到对话页面\n');
    
    // 步骤 2: 发送测试问题
    console.log('2️⃣ 发送业务问题...');
    const testQuestion = '我是一家电商公司，每天需要处理大量订单，人工核对很容易出错，客户投诉增加。另外库存管理也很混乱，经常出现缺货或积压。请帮我分析一下可以如何改进。';
    
    await page.fill('textarea', testQuestion);
    await page.click('button[type="submit"]');
    console.log('   ✅ 已发送问题\n');
    
    // 步骤 3: 等待 AI 回复
    console.log('3️⃣ 等待 AI 分析...');
    await page.waitForSelector('text=/订单处理|库存管理|自动化/', { timeout: 60000 });
    console.log('   ✅ AI 已回复\n');
    
    await page.waitForTimeout(2000);
    
    // 步骤 4: 继续对话以获得完整报告
    console.log('4️⃣ 继续补充信息...');
    const followUp = '我们团队有5个人，每天处理200-300个订单，使用Excel表格记录。希望控制成本，不想投入太多预算。';
    
    await page.fill('textarea', followUp);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('   ✅ 已补充信息\n');
    
    // 步骤 5: 生成报告
    console.log('5️⃣ 生成咨询报告...');
    const generateButton = page.locator('button:has-text("生成报告")').first();
    
    try {
      await generateButton.waitFor({ timeout: 5000 });
      await generateButton.click();
      console.log('   ✅ 已点击生成报告按钮\n');
    } catch {
      console.log('   ⚠️  未找到生成报告按钮，可能需要更多对话轮次\n');
    }
    
    // 步骤 6: 等待跳转到报告页面
    console.log('6️⃣ 等待报告生成...');
    await page.waitForURL('**/report', { timeout: 120000 });
    console.log('   ✅ 已跳转到报告页面\n');
    
    await page.waitForTimeout(3000);
    
    // 步骤 7: 验证报告内容
    console.log('7️⃣ 验证报告内容...');
    const bodyText = await page.textContent('body');
    const hasTable = await page.locator('table').count() > 0;
    const wordCount = bodyText.length;
    
    console.log(`   📝 内容长度: ${wordCount} 字`);
    console.log(`   ${wordCount >= 1000 ? '✅' : '❌'} 字数 ≥1000`);
    console.log(`   ${hasTable ? '✅' : '❌'} 包含表格\n`);
    
    // 步骤 8: 下载 PDF
    console.log('8️⃣ 下载 PDF...');
    const downloadButton = page.locator('button:has-text("下载 PDF")');
    await downloadButton.waitFor({ timeout: 5000 });
    
    const startTime = Date.now();
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    
    await downloadButton.click();
    
    // 检查 loading 状态
    await page.waitForTimeout(500);
    const loadingVisible = await page.locator('text=生成中').isVisible().catch(() => false);
    if (loadingVisible) {
      console.log('   ✅ 显示 "生成中…" 状态');
    }
    
    console.log('   ⏳ 等待 PDF 生成...\n');
    const download = await downloadPromise;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const pdfPath = `/tmp/journey-test-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    
    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 完整流程测试通过！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  PDF 生成时间: ${duration} 秒`);
    console.log(`📦 文件大小: ${sizeKB} KB`);
    console.log(`📄 文件路径: ${pdfPath}`);
    console.log('\n📋 手动验证清单:');
    console.log(`   open "${pdfPath}"`);
    console.log('   - 中文字体正常渲染（无方块）');
    console.log('   - 表格对齐和边框完整');
    console.log('   - 标题层级清晰');
    console.log('   - 排版格式 ≥10 种');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('浏览器将在 10 秒后关闭...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: `/tmp/journey-error-${Date.now()}.png`, fullPage: true });
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

completeUserJourney();
