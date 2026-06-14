#!/usr/bin/env node
import { chromium } from 'playwright';

async function testWithAuth() {
  console.log('🔐 带登录测试 Render 部署\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 步骤 1: 登录
    console.log('1️⃣ 访问登录页面...');
    await page.goto('https://kant-consulting.onrender.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('   输入手机号和邀请码...');
    await page.fill('input[type="tel"]', '17767268888');
    await page.fill('input[type="text"]', 'chijun');
    await page.click('button[type="submit"]');

    // 等待登录完成
    await page.waitForTimeout(2000);

    // 步骤 2: 访问报告页面（带测试数据）
    console.log('\n2️⃣ 访问报告页面...');
    const testContent = encodeURIComponent('# 康德咨询测试报告\n\n## 机会点\n- 自动化机会 1\n- 优化机会 2\n\n这是测试内容，包含**中文字符**测试。');
    await page.goto(`https://kant-consulting.onrender.com/report?content=${testContent}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`   当前 URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.log('   ⚠️  仍被重定向到登录页 - 需要真实用户账号');
      console.log('   💡 建议：手动登录后在浏览器中测试');
      await page.waitForTimeout(30000); // 保持打开 30 秒供手动登录
      await browser.close();
      return;
    }

    // 检查页面内容
    const bodyText = await page.textContent('body');

    if (bodyText.includes('康德咨询测试报告')) {
      console.log('   ✅ 报告内容加载成功');
    }

    // 步骤 3: 查找并测试下载按钮
    console.log('\n3️⃣ 测试下载按钮...');
    const button = page.locator('button:has-text("下载 PDF")');
    const buttonCount = await button.count();

    if (buttonCount === 0) {
      console.log('   ❌ 未找到"下载 PDF"按钮');
      await page.screenshot({ path: '/tmp/no-button.png', fullPage: true });
      console.log('   📸 截图已保存: /tmp/no-button.png');
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    console.log('   ✅ 找到"下载 PDF"按钮');

    // 记录开始时间
    const startTime = Date.now();

    // 监听下载
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });

    // 点击按钮
    console.log('   点击按钮...');
    await button.click();

    // 检查 loading 状态
    await page.waitForTimeout(200);
    const loadingVisible = await page.locator('text=生成中').isVisible();
    if (loadingVisible) {
      console.log('   ✅ Loading 状态显示："生成中…"');
      const spinnerVisible = await page.locator('button:has-text("生成中") span[aria-hidden]').isVisible();
      if (spinnerVisible) {
        console.log('   ✅ Spinner 动画已渲染');
      }
    }

    // 等待下载
    console.log('   等待 PDF 生成...');
    const download = await downloadPromise;
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n4️⃣ 结果统计:`);
    console.log(`   ⏱️  生成时间: ${duration} 秒`);
    console.log(`   ✅ 目标: ≤6 秒`);
    console.log(`   ${parseFloat(duration) <= 6 ? '✅ PASS' : '❌ FAIL'}`);

    // 保存 PDF
    const pdfPath = `/tmp/kant-render-test-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`\n   💾 PDF 已保存: ${pdfPath}`);
    console.log(`   📖 请打开验证中文字体: open "${pdfPath}"`);

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    await page.screenshot({ path: `/tmp/error-${Date.now()}.png`, fullPage: true });
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testWithAuth();
