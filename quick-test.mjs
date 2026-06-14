#!/usr/bin/env node
import { chromium } from 'playwright';

async function quickTest() {
  console.log('🔍 快速诊断 Render 部署状态\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('1️⃣ 访问首页...');
    await page.goto('https://kant-consulting.onrender.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`   状态: ${page.url()}`);

    const title = await page.title();
    console.log(`   标题: ${title}`);

    console.log('\n2️⃣ 访问 /report 页面...');
    await page.goto('https://kant-consulting.onrender.com/report', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log(`   URL: ${page.url()}`);

    // 等待页面内容
    await page.waitForTimeout(3000);

    // 检查页面内容
    const bodyText = await page.textContent('body');
    console.log(`   页面内容长度: ${bodyText.length} 字符`);

    if (bodyText.includes('还没有诊断报告')) {
      console.log('   ✅ 显示"还没有诊断报告"（正常 - 无报告数据）');
    }

    if (bodyText.includes('下载 PDF')) {
      console.log('   ✅ 找到"下载 PDF"按钮');
    } else {
      console.log('   ℹ️  未找到"下载 PDF"按钮（可能需要报告数据）');
    }

    console.log('\n3️⃣ 带参数访问（模拟报告数据）...');
    const testContent = encodeURIComponent('# 测试报告\n\n## 机会点\n- 机会1\n- 机会2\n\n内容测试。');
    await page.goto(`https://kant-consulting.onrender.com/report?content=${testContent}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    const contentWithData = await page.textContent('body');

    if (contentWithData.includes('测试报告')) {
      console.log('   ✅ 参数传递成功 - 看到"测试报告"');
    }

    if (contentWithData.includes('下载 PDF')) {
      console.log('   ✅ 找到"下载 PDF"按钮');

      // 尝试点击按钮
      console.log('\n4️⃣ 测试按钮点击...');
      const button = page.locator('button:has-text("下载 PDF")');
      await button.click();

      console.log('   点击按钮成功，等待状态变化...');
      await page.waitForTimeout(500);

      const loadingVisible = await page.locator('text=生成中').isVisible();
      if (loadingVisible) {
        console.log('   ✅ Loading 状态显示："生成中…"');
      } else {
        console.log('   ⚠️  未检测到 loading 状态（可能太快）');
      }
    } else {
      console.log('   ❌ 未找到"下载 PDF"按钮');
    }

    console.log('\n✅ 诊断完成。浏览器保持打开 10 秒供检查...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    await page.screenshot({ path: `/tmp/debug-${Date.now()}.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}

quickTest();
