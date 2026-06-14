#!/usr/bin/env node
import { chromium } from 'playwright';

async function debugLogin() {
  console.log('🔍 调试登录问题\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 监听所有请求和响应
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`📤 请求: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(`📥 响应: ${response.status()} ${response.url()}`);
      try {
        const body = await response.text();
        console.log(`   Body: ${body.slice(0, 200)}`);
      } catch (e) {
        console.log('   (无法读取响应体)');
      }
    }
  });

  // 监听控制台消息
  page.on('console', msg => {
    console.log(`🖥️  Console [${msg.type()}]:`, msg.text());
  });

  try {
    console.log('1️⃣ 访问登录页...');
    await page.goto('https://kant-consulting.onrender.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    await page.waitForTimeout(1000);
    console.log('   ✅ 页面加载完成\n');

    console.log('2️⃣ 填写表单...');
    await page.fill('input[type="tel"]', '17767268888');
    await page.fill('input[type="text"]', 'chijun');
    console.log('   ✅ 表单填写完成\n');

    console.log('3️⃣ 点击提交按钮...');
    await page.click('button[type="submit"]');
    console.log('   ✅ 按钮已点击\n');

    console.log('4️⃣ 等待响应（10秒）...');
    await page.waitForTimeout(10000);

    const url = page.url();
    console.log(`\n5️⃣ 最终 URL: ${url}`);

    if (url.includes('/login')) {
      console.log('   ❌ 仍在登录页\n');

      // 检查页面上是否有错误消息
      const bodyText = await page.textContent('body');
      if (bodyText.includes('错误') || bodyText.includes('失败') || bodyText.includes('无效')) {
        const errorMatch = bodyText.match(/(错误|失败|无效)[^。！\n]{0,50}/);
        if (errorMatch) {
          console.log(`   错误提示: ${errorMatch[0]}`);
        }
      }

      // 检查表单状态
      const phoneValue = await page.inputValue('input[type="tel"]');
      const codeValue = await page.inputValue('input[type="text"]');
      console.log(`   表单值仍为: phone="${phoneValue}", code="${codeValue}"`);

      await page.screenshot({ path: '/tmp/login-debug.png', fullPage: true });
      console.log('   📸 截图: /tmp/login-debug.png');
    } else {
      console.log('   ✅ 登录成功！');
    }

    console.log('\n浏览器保持打开 30 秒...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    await page.screenshot({ path: '/tmp/error-debug.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debugLogin();
