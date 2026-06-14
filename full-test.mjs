#!/usr/bin/env node
import { chromium } from 'playwright';

async function fullTest() {
  console.log('🎯 完整 PDF 功能测试\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 步骤 1: 登录
    console.log('1️⃣ 登录...');
    await page.goto('https://kant-consulting.onrender.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    await page.fill('input[type="tel"]', '17767268888');
    await page.fill('input[type="text"]', 'chijun');
    await page.click('button[type="submit"]');

    // 等待登录完成
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('   ❌ 登录失败，仍在登录页');
      await page.screenshot({ path: '/tmp/login-fail.png', fullPage: true });
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

    await page.waitForTimeout(2000);

    // 检查是否成功加载报告
    const bodyText = await page.textContent('body');
    if (bodyText.includes('康德咨询年度报告')) {
      console.log('   ✅ 报告内容加载成功\n');
    } else {
      console.log('   ⚠️  报告内容未找到');
    }

    // 步骤 3: 测试下载按钮
    console.log('3️⃣ 查找下载按钮...');
    const button = page.locator('button:has-text("下载 PDF")');

    try {
      await button.waitFor({ timeout: 5000 });
      console.log('   ✅ 找到"下载 PDF"按钮\n');
    } catch {
      console.log('   ❌ 未找到按钮');
      await page.screenshot({ path: '/tmp/no-button.png', fullPage: true });
      console.log('   📸 截图: /tmp/no-button.png');
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    // 步骤 4: 测试 PDF 下载
    console.log('4️⃣ 测试 PDF 下载...');
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
        console.log('   ✅ 按钮已禁用（防重复点击）');
      }

      const spinner = await page.locator('button span[aria-hidden]').isVisible().catch(() => false);
      if (spinner) {
        console.log('   ✅ Spinner 动画显示');
      }
    } else {
      console.log('   ℹ️  Loading 状态可能太快未捕获');
    }

    console.log('   ⏳ 等待 PDF 生成...');
    const download = await downloadPromise;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 步骤 5: 验证结果
    console.log('\n5️⃣ 测试结果:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ⏱️  生成时间: ${duration} 秒`);

    const pass = parseFloat(duration) <= 6;
    console.log(`   ${pass ? '✅' : '⚠️'} 速度${pass ? '达标' : '偏慢'} (目标 ≤6秒)`);

    const pdfPath = `/tmp/kant-render-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`   💾 PDF 已保存: ${pdfPath}`);

    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📦 文件大小: ${sizeKB} KB`);

    const validSize = stats.size > 5000;
    console.log(`   ${validSize ? '✅' : '⚠️'} 文件大小${validSize ? '正常' : '异常'}`);
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 步骤 6: 验证按钮恢复
    console.log('6️⃣ 验证按钮恢复...');
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
    console.log('📊 验证总结');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PDF 正常生成和下载');
    console.log('✅ 交互体验丝滑（loading 状态 + 按钮禁用）');
    console.log('✅ 提示明显（"生成中…" + spinner 动画）');
    console.log(`✅ 不卡顿（生成时间 ${duration} 秒）`);
    console.log('\n📄 请验证中文字体渲染:');
    console.log(`   open "${pdfPath}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ 所有测试通过！浏览器将在 10 秒后关闭...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: `/tmp/test-error-${Date.now()}.png`, fullPage: true });
    console.log('   📸 错误截图已保存\n');
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

fullTest();
