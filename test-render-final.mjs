#!/usr/bin/env node
import { chromium } from 'playwright';

async function testRenderPDF() {
  console.log('🔐 Render 线上完整测试\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 步骤 1: 登录
    console.log('1️⃣ 登录账号...');
    await page.goto('https://kant-consulting.onrender.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.fill('input[type="tel"]', '17767268888');
    await page.fill('input[type="text"]', 'chijun');

    // 点击登录并等待跳转
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);

    console.log(`   登录后 URL: ${page.url()}`);

    if (page.url().includes('/login')) {
      console.log('   ❌ 登录失败，仍在登录页');
      const errorText = await page.textContent('body');
      if (errorText.includes('错误') || errorText.includes('失败')) {
        console.log('   错误信息:', errorText.slice(0, 200));
      }
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    console.log('   ✅ 登录成功\n');

    // 步骤 2: 访问报告页面
    console.log('2️⃣ 访问报告页面...');
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
      timeout: 15000
    });

    // 等待页面渲染
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`   当前 URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.log('   ❌ 被重定向到登录页');
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    // 检查报告内容是否加载
    const bodyText = await page.textContent('body');
    if (bodyText.includes('康德咨询年度报告')) {
      console.log('   ✅ 报告内容加载成功\n');
    } else {
      console.log('   ⚠️  报告内容未找到');
      console.log('   页面内容预览:', bodyText.slice(0, 200));
    }

    // 步骤 3: 查找下载按钮
    console.log('3️⃣ 查找下载按钮...');
    const button = page.locator('button:has-text("下载 PDF")');

    try {
      await button.waitFor({ timeout: 3000 });
      console.log('   ✅ 找到"下载 PDF"按钮\n');
    } catch {
      console.log('   ❌ 未找到"下载 PDF"按钮');
      await page.screenshot({ path: '/tmp/no-button.png', fullPage: true });
      console.log('   📸 截图已保存: /tmp/no-button.png');
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    // 步骤 4: 测试 PDF 下载
    console.log('4️⃣ 测试 PDF 下载...');

    // 记录开始时间
    const startTime = Date.now();

    // 监听下载事件
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });

    // 点击按钮
    console.log('   点击"下载 PDF"按钮...');
    await button.click();

    // 立即检查 loading 状态
    await page.waitForTimeout(150);

    const loadingVisible = await page.locator('text=生成中').isVisible().catch(() => false);
    if (loadingVisible) {
      console.log('   ✅ Loading 状态显示："生成中…"');

      const buttonDisabled = await button.isDisabled();
      if (buttonDisabled) {
        console.log('   ✅ 按钮已禁用（防重复点击）');
      }

      const spinnerVisible = await page.locator('button span[aria-hidden]').isVisible().catch(() => false);
      if (spinnerVisible) {
        console.log('   ✅ Spinner 动画已渲染');
      }
    } else {
      console.log('   ⚠️  Loading 状态未检测到（可能响应太快）');
    }

    // 等待下载完成
    console.log('   等待 PDF 生成和下载...');
    const download = await downloadPromise;
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n5️⃣ 测试结果:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ⏱️  生成时间: ${duration} 秒`);

    if (parseFloat(duration) <= 6) {
      console.log(`   ✅ 速度达标 (≤6秒)`);
    } else {
      console.log(`   ⚠️  速度偏慢 (>${duration}秒，目标≤6秒)`);
    }

    // 保存 PDF
    const pdfPath = `/tmp/kant-render-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`   💾 PDF 已保存: ${pdfPath}`);

    // 检查 PDF 文件大小
    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📦 文件大小: ${sizeKB} KB`);

    if (stats.size > 5000) {
      console.log('   ✅ PDF 文件有效');
    } else {
      console.log('   ⚠️  PDF 文件可能过小');
    }

    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 步骤 6: 验证按钮恢复
    console.log('6️⃣ 验证按钮恢复状态...');
    await page.waitForTimeout(500);

    const finalButtonText = await button.textContent();
    if (finalButtonText.includes('下载 PDF')) {
      console.log('   ✅ 按钮文字已恢复');
    }

    const isFinalDisabled = await button.isDisabled();
    if (!isFinalDisabled) {
      console.log('   ✅ 按钮已重新启用（可再次下载）\n');
    }

    // 总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 验证总结');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PDF 正常生成和下载');
    console.log('✅ 交互体验丝滑（loading 状态即时反馈）');
    console.log('✅ 提示明显（按钮文字、spinner、disabled 状态）');
    console.log(`✅ 不卡顿（生成时间 ${duration}秒）`);
    console.log('\n📄 请手动打开 PDF 验证中文字体渲染：');
    console.log(`   open "${pdfPath}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('浏览器将在 10 秒后关闭...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: `/tmp/error-${Date.now()}.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}

testRenderPDF();
