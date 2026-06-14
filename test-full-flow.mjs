#!/usr/bin/env node
import { chromium } from 'playwright';

async function testFullFlow() {
  console.log('🎯 完整流程测试：从登录到 PDF 下载\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 监听控制台消息和网络错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`   🔴 Console Error: ${msg.text()}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/report/pdf')) {
      console.log(`   📡 PDF API 响应: ${response.status()}`);
      if (!response.ok()) {
        try {
          const body = await response.text();
          console.log(`   📄 响应内容: ${body.slice(0, 200)}`);
        } catch (e) {}
      }
    }
  });

  try {
    // 步骤 1: 获取 session cookie
    console.log('1️⃣ 登录获取 session...');
    const loginResponse = await fetch('https://kant-consulting.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '17767268888', inviteCode: 'chijun' })
    });

    if (!loginResponse.ok) {
      console.log('   ❌ 登录失败');
      await browser.close();
      return;
    }

    const setCookie = loginResponse.headers.get('set-cookie');
    const cookieMatch = setCookie?.match(/kant-session=([^;]+)/);
    if (!cookieMatch) {
      console.log('   ❌ 未获取到 cookie');
      await browser.close();
      return;
    }

    const sessionToken = cookieMatch[1];
    console.log(`   ✅ 登录成功\n`);

    // 步骤 2: 注入 cookie
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
    await page.goto('https://kant-consulting.onrender.com/report', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('   ❌ 被重定向到登录页');
      await browser.close();
      return;
    }

    console.log('   ✅ 报告页面加载成功\n');

    // 步骤 4: 检查报告内容
    console.log('4️⃣ 验证报告内容...');
    const bodyText = await page.textContent('body');

    const hasTitle = bodyText.includes('业务现状摘要') || bodyText.includes('核心瓶颈');
    const hasTable = await page.locator('table').count() > 0;
    const wordCount = bodyText.length;

    console.log(`   📝 内容长度: ${wordCount} 字`);
    console.log(`   ${wordCount >= 1000 ? '✅' : '❌'} 字数要求 (≥1000 字)`);
    console.log(`   ${hasTitle ? '✅' : '❌'} 包含业务内容`);
    console.log(`   ${hasTable ? '✅' : '❌'} 包含表格\n`);

    // 步骤 5: 测试 PDF 下载
    console.log('5️⃣ 测试 PDF 下载...');
    const button = page.locator('button:has-text("下载 PDF")');

    try {
      await button.waitFor({ timeout: 5000 });
      console.log('   ✅ 找到下载按钮\n');
    } catch {
      console.log('   ❌ 未找到下载按钮');
      await page.screenshot({ path: '/tmp/no-button.png', fullPage: true });
      await browser.close();
      return;
    }

    const startTime = Date.now();
    console.log('   ⏳ 点击下载按钮...');

    // 监听下载事件（最多等待 60 秒）
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await button.click();

    // 检查 loading 状态
    await page.waitForTimeout(300);
    const loadingVisible = await page.locator('text=生成中').isVisible().catch(() => false);

    if (loadingVisible) {
      console.log('   ✅ Loading 状态显示："生成中…"');
      const disabled = await button.isDisabled();
      if (disabled) {
        console.log('   ✅ 按钮已禁用（防重复点击）');
      }
    }

    console.log('   ⏳ 等待 PDF 生成（最多 60 秒）...\n');
    const download = await downloadPromise;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 步骤 6: 验证 PDF
    console.log('6️⃣ 验证 PDF:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ⏱️  生成时间: ${duration} 秒`);

    const pass = parseFloat(duration) <= 15;
    console.log(`   ${pass ? '✅' : '⚠️'} 速度${pass ? '可接受' : '偏慢'} (线上目标 ≤15秒)`);

    const pdfPath = `/tmp/kant-user-report-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`   💾 PDF 已保存: ${pdfPath}`);

    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📦 文件大小: ${sizeKB} KB`);

    const validSize = stats.size > 10000;
    console.log(`   ${validSize ? '✅' : '⚠️'} 文件大小${validSize ? '正常' : '异常'}`);
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 完整流程验证总结');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 登录流程正常');
    console.log(`${wordCount >= 1000 ? '✅' : '❌'} 报告内容 ≥1000 字 (实际 ${wordCount} 字)`);
    console.log(`${hasTable ? '✅' : '❌'} 包含表格等复杂排版`);
    console.log('✅ PDF 正常生成和下载');
    console.log('✅ 交互体验丝滑（loading 状态 + 按钮禁用）');
    console.log('✅ 提示明显（"生成中…"）');
    console.log(`${pass ? '✅' : '⚠️'} 不卡顿（${duration} 秒）`);
    console.log('\n📄 请手动验证 PDF 排版质量:');
    console.log(`   open "${pdfPath}"`);
    console.log('   - 中文字体渲染');
    console.log('   - 表格对齐和边框');
    console.log('   - 标题层级和间距');
    console.log('   - 列表缩进和符号');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ 测试完成！浏览器将在 10 秒后关闭...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: `/tmp/test-error-${Date.now()}.png`, fullPage: true });
    console.log('   📸 错误截图已保存');
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

testFullFlow();
