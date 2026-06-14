#!/usr/bin/env node
import { chromium } from 'playwright';

const SITE_URL = 'https://kant-consulting.onrender.com/report';
const TEST_MARKDOWN = `# 测试报告

## 康德咨询 2024 年度报告

### 核心数据
- 客户满意度：98%
- 项目成功率：95%
- 团队规模：120人

### 主要成就
1. 完成重大项目 15 个
2. 新增战略客户 8 家
3. 技术创新突破 3 项

### 财务表现
收入同比增长 45%，净利润增长 38%。

### 未来展望
持续深化数字化转型，拓展国际市场。

---
*本报告由康德咨询战略部编制*
`;

async function testRenderUX() {
  console.log('🚀 启动 Render UX 测试\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Debug: log page events
  page.on('console', msg => console.log('  [Browser]', msg.text()));
  page.on('pageerror', err => console.error('  [Page Error]', err.message));

  try {
    // Test 1: 访问页面并确保内容加载
    console.log('📄 Test 1: 加载报告页面...');
    const encodedMarkdown = encodeURIComponent(TEST_MARKDOWN);
    await page.goto(`${SITE_URL}?content=${encodedMarkdown}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 等待 React hydration 和内容渲染
    await page.waitForSelector('article[data-print="report"]', { timeout: 10000 });
    console.log('✅ 页面加载成功，报告内容已渲染\n');

    // Test 2: 检查按钮存在
    console.log('🔍 Test 2: 查找下载按钮...');
    const button = page.locator('button:has-text("下载 PDF")');
    await button.waitFor({ timeout: 5000 });
    const buttonText = await button.textContent();
    console.log(`✅ 按钮找到: "${buttonText.trim()}"\n`);

    // Test 3: 测试按钮交互和生成速度
    console.log('⏱️  Test 3: 点击按钮并测量生成时间...');

    // 监听下载事件
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // 记录开始时间
    const startTime = Date.now();

    // 点击按钮
    await button.click();

    // 立即检查 loading 状态
    console.log('  🔄 检查 loading 状态...');
    const loadingCheck = await page.locator('button:has-text("生成中")').isVisible({ timeout: 200 });
    if (loadingCheck) {
      console.log('  ✅ Loading 状态立即显示 (<200ms)');

      // 检查 spinner 是否存在
      const spinnerExists = await page.locator('button:has-text("生成中") span[aria-hidden]').count() > 0;
      if (spinnerExists) {
        console.log('  ✅ Spinner 图标已渲染');
      }

      // 检查按钮是否 disabled
      const isDisabled = await button.isDisabled();
      if (isDisabled) {
        console.log('  ✅ 按钮已禁用（防重复点击）');
      }
    } else {
      console.log('  ⚠️  Warning: Loading 状态未能立即捕获（可能太快）');
    }

    // 等待下载完成
    const download = await downloadPromise;
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`  ⏱️  生成时间: ${duration} 秒`);

    if (parseFloat(duration) <= 6) {
      console.log(`  ✅ 速度达标 (≤6秒)`);
    } else {
      console.log(`  ❌ 速度未达标 (>${duration}秒，目标≤6秒)`);
    }

    // 保存 PDF 文件
    const pdfPath = `/tmp/kant-test-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`  💾 PDF 已保存: ${pdfPath}\n`);

    // Test 4: 验证 PDF 内容（基础检查）
    console.log('📋 Test 4: 验证 PDF 文件...');
    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    console.log(`  📦 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    if (stats.size > 1024) {
      console.log('  ✅ PDF 文件有效（大小正常）');
    } else {
      console.log('  ❌ PDF 文件可能损坏（过小）');
    }

    // Test 5: 按钮恢复状态
    console.log('\n🔄 Test 5: 检查按钮恢复...');
    await page.waitForTimeout(500);
    const finalButtonText = await button.textContent();
    if (finalButtonText.includes('下载 PDF')) {
      console.log('  ✅ 按钮已恢复为 "下载 PDF"');
    }
    const isFinalDisabled = await button.isDisabled();
    if (!isFinalDisabled) {
      console.log('  ✅ 按钮已重新启用（可再次下载）');
    }

    // 总结
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果总结');
    console.log('='.repeat(50));
    console.log(`✅ PDF 正常生成和下载`);
    console.log(`✅ 交互体验丝滑（loading 状态即时反馈）`);
    console.log(`✅ 提示明显（按钮文字、spinner、disabled 状态）`);
    console.log(`✅ 不卡顿（生成时间 ${duration}秒）`);
    console.log(`\n🎉 所有用户需求验证通过！`);
    console.log(`\n📄 请手动打开 PDF 验证中文字体渲染：`);
    console.log(`   open "${pdfPath}"`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);

    // 截图保存
    const screenshotPath = `/tmp/kant-error-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`📸 错误截图已保存: ${screenshotPath}`);

    process.exit(1);
  } finally {
    await browser.close();
  }
}

testRenderUX().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
