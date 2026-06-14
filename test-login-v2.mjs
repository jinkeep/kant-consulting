#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

try {
  console.log('1. 访问登录页...');
  await page.goto('https://kant-consulting.onrender.com/login', { 
    waitUntil: 'domcontentloaded', 
    timeout: 30000 
  });
  
  await page.waitForTimeout(2000);
  
  console.log('2. 填写表单...');
  await page.fill('input[type="tel"]', '17767268888');
  await page.fill('input#code', 'chijun');
  
  console.log('3. 点击登录...');
  
  // 监听导航事件
  const navigationPromise = page.waitForURL(/\/(chat|report)/, { timeout: 30000 });
  
  await page.click('button[type="submit"]');
  
  console.log('4. 等待跳转...');
  await navigationPromise;
  
  console.log('✅ 登录成功，跳转到:', page.url());
  
  await page.waitForTimeout(3000);
  
  // 检查页面内容
  const hasInput = await page.locator('textarea').count() > 0;
  console.log('页面有输入框:', hasInput);
  
  await page.screenshot({ path: '/tmp/after-login.png', fullPage: true });
  console.log('截图: /tmp/after-login.png');
  
  await page.waitForTimeout(10000);
  
} catch (e) {
  console.error('❌ 错误:', e.message);
  console.log('当前 URL:', page.url());
  
  // 检查是否有错误消息
  const bodyText = await page.textContent('body').catch(() => '');
  if (bodyText.includes('错误') || bodyText.includes('失败')) {
    console.log('错误消息:', bodyText.substring(0, 200));
  }
  
  await page.screenshot({ path: '/tmp/login-fail.png', fullPage: true });
} finally {
  await browser.close();
}
