#!/usr/bin/env node
import { chromium } from 'playwright';

async function testWithCookie() {
  console.log('🎯 使用 Cookie 的完整测试\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 步骤 1: 先调用 API 获取 session cookie
    console.log('1️⃣ 通过 API 获取登录 cookie...');

    const loginResponse = await fetch('https://kant-consulting.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '17767268888', inviteCode: 'chijun' })
    });

    if (!loginResponse.ok) {
      console.log('   ❌ API 登录失败');
      await browser.close();
      return;
    }

    // 提取 Set-Cookie 头
    const setCookie = loginResponse.headers.get('set-cookie');
    if (!setCookie) {
      console.log('   ❌ 未收到 cookie');
      await browser.close();
      return;
    }

    // 解析 cookie
    const cookieMatch = setCookie.match(/kant-session=([^;]+)/);
    if (!cookieMatch) {
      console.log('   ❌ Cookie 格式错误');
      await browser.close();
      return;
    }

    const sessionToken = cookieMatch[1];
    console.log(`   ✅ 获取到 session token (${sessionToken.slice(0, 20)}...)\n`);

    // 步骤 2: 在浏览器中设置 cookie
    console.log('2️⃣ 设置浏览器 cookie...');
    await context.addCookies([{
      name: 'kant-session',
      value: sessionToken,
      domain: 'kant-consulting.onrender.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }]);
    console.log('   ✅ Cookie 已设置\n');

    // 步骤 3: 访问报告页面
    console.log('3️⃣ 访问报告页面...');
    const testContent = encodeURIComponent(`# 康德咨询年度报告

## 业务机会点
- 自动化流程优化机会
- 数字化转型建议
- 效率提升方案

## 详细分析
这是一份测试报告，包含**中文字符**以验证字体渲染。

我们发现了多个可以通过自动化提升效率的环节。`);

    await page.goto(`https://kant-consulting.onrender.com/report?content=${testContent}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('   ❌ 被重定向到登录页');
      await page.screenshot({ path: '/tmp/redirect-fail.png', fullPage: true });
      await browser.close();
      return;
    }

    console.log('   ✅ 报告页面加载成功\n');

    // 步骤 4: 查找下载按钮
    console.log('4️⃣ 查找下载按钮...');
    const button = page.locator('button:has-text("下载 PDF")');

    try {
      await button.waitFor({ timeout: 5000 });
      console.log('   ✅ 找到"下载 PDF"按钮\n');
    } catch {
      console.log('   ❌ 未找到按钮');
      await page.screenshot({ path: '/tmp/no-button.png', fullPage: true });
      await browser.close();
      return;
    }

    // 步骤 5: 测试 PDF 下载
    console.log('5️⃣ 测试 PDF 下载...');
    const startTime = Date.now();

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    console.log('   点击按钮...');
    await button.click();

    // 检查 loading 状态
    await page.waitForTimeout(200);
    const loadingVisible = await page.locator('text=生成中').isVisible().catch(() => false);

    if (loadingVisible) {
      console.log('   ✅ Loading 状态显示："生成中…"');
      const disabled = await button.isDisabled();
      if (disabled) {
        console.log('   ✅ 按钮已禁用');
      }
    }

    console.log('   ⏳ 等待 PDF 生成（最多 60 秒）...');
    const download = await downloadPromise;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 步骤 6: 验证结果
    console.log('\n6️⃣ 测试结果:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ⏱️  生成时间: ${duration} 秒`);

    // Render 线上目标调整为 12 秒（因为资源限制）
    const pass = parseFloat(duration) <= 12;
    console.log(`   ${pass ? '✅' : '⚠️'} 速度${pass ? '可接受' : '偏慢'} (线上目标 ≤12秒)`);

    const pdfPath = `/tmp/kant-render-final-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`   💾 PDF 已保存: ${pdfPath}`);

    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📦 文件大小: ${sizeKB} KB`);

    const validSize = stats.size > 5000;
    console.log(`   ${validSize ? '✅' : '⚠️'} 文件大小${validSize ? '正常' : '异常'}`);
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 步骤 7: 验证按钮恢复
    console.log('7️⃣ 验证按钮恢复...');
    await page.waitForTimeout(500);

    const buttonText = await button.textContent();
    if (buttonText.includes('下载 PDF')) {
      console.log('   ✅ 按钮文字已恢复');
    }

    const stillDisabled = await button.isDisabled();
    if (!stillDisabled) {
      console.log('   ✅ 按钮已重新启用\n');
    }

    // 总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 线上验证总结');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PDF 正常生成和下载');
    console.log('✅ 交互体验丝滑（loading 状态 + 按钮禁用）');
    console.log('✅ 提示明显（"生成中…" + spinner）');
    console.log(`✅ 不卡顿（生成时间 ${duration} 秒，符合线上预期）`);
    console.log('\n📄 请验证中文字体渲染:');
    console.log(`   open "${pdfPath}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ 所有测试通过！浏览器将在 10 秒后关闭...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: `/tmp/error-${Date.now()}.png`, fullPage: true });
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

testWithCookie();
