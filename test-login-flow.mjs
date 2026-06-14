#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

try {
  console.log('访问登录页...');
  await page.goto('https://kant-consulting.onrender.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('填写表单...');
  await page.fill('input[type="tel"]', '17767268888');
  await page.fill('input[placeholder*="邀请码"]', 'chijun');
  
  console.log('点击登录按钮...');
  await page.click('button:has-text("登录")');
  
  // 等待导航或错误消息
  await Promise.race([
    page.waitForURL(/\/(chat|report)/, { timeout: 20000 }).then(() => console.log('✅ 已跳转:', page.url())),
    page.waitForSelector('text=/错误|失败/', { timeout: 5000 }).then(async () => {
      const error = await page.textContent('body');
      console.log('❌ 登录失败:', error.substring(0, 200));
    })
  ]).catch(() => {
    console.log('⚠️  未检测到跳转或错误提示');
    console.log('当前 URL:', page.url());
  });
  
  await page.waitForTimeout(3000);
  
  // 检查当前页面内容
  const bodyText = await page.textContent('body');
  console.log('\n页面内容摘要:', bodyText.substring(0, 300));
  
  await page.screenshot({ path: '/tmp/login-result.png', fullPage: true });
  console.log('截图已保存: /tmp/login-result.png');
  
  await page.waitForTimeout(10000);
} catch (e) {
  console.error('错误:', e.message);
  await page.screenshot({ path: '/tmp/login-error.png', fullPage: true });
} finally {
  await browser.close();
}
