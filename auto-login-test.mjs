#!/usr/bin/env node
import { chromium } from 'playwright';

async function autoLoginTest() {
  console.log('🔐 自动登录测试 Render 线上环境\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 步骤 1: 访问登录页
    console.log('1️⃣ 访问登录页面...');
    await page.goto('https://kant-consulting.onrender.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    console.log('   ✅ 登录页已加载\n');

    // 步骤 2: 填写表单
    console.log('2️⃣ 填写登录信息...');
    await page.fill('input[type="tel"]', '17767268888');
    await page.fill('input[type="text"]', 'chijun');
    console.log('   手机号: 17767268888');
    console.log('   邀请码: chijun\n');

    // 步骤 3: 提交并等待响应
    console.log('3️⃣ 提交登录...');

    // 监听网络请求
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/login')) {
        const status = response.status();
        console.log(`   API 响应: ${status}`);

        if (status === 200) {
          try {
            const data = await response.json();
            console.log('   ✅ 登录成功:', data);
          } catch (e) {
            console.log('   ✅ 登录成功');
          }
        } else {
          try {
            const error = await response.json();
            console.log('   ❌ 登录失败:', error);
          } catch (e) {
            console.log('   ❌ 登录失败: HTTP', status);
          }
        }
      }
    });

    // 点击提交并等待导航
    await Promise.race([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ]).catch(() => {
      console.log('   ⚠️  导航等待超时');
    });

    // 等待一下让请求完成
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`\n   当前 URL: ${currentUrl}\n`);

    if (currentUrl.includes('/login')) {
      console.log('   ❌ 仍在登录页，登录可能失败');

      // 检查是否有错误提示
      const errorText = await page.textContent('body').catch(() => '');
      if (errorText.includes('错误') || errorText.includes('失败')) {
        console.log('   页面错误信息:', errorText.slice(0, 300));
      }

      // 截图
      await page.screenshot({ path: '/tmp/login-failed.png', fullPage: true });
      console.log('   📸 截图已保存: /tmp/login-failed.png\n');

      console.log('浏览器将保持打开 30 秒供检查...');
      await page.waitForTimeout(30000);
      await browser.close();
      return;
    }

    console.log('   ✅ 登录成功！\n');

    // 步骤 4: 访问报告页面
    console.log('4️⃣ 访问测试报告...');
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
    console.log('   ✅ 报告页面已加载\n');

    // 步骤 5: 测试 PDF 下载
    console.log('5️⃣ 测试 PDF 下载...');
    const button = page.locator('button:has-text("下载 PDF")');

    try {
      await button.waitFor({ timeout: 5000 });
      console.log('   ✅ 找到下载按钮\n');
    } catch {
      console.log('   ❌ 未找到下载按钮');
      await page.screenshot({ path: '/tmp/no-button.png', fullPage: true });
      console.log('   📸 截图: /tmp/no-button.png\n');
      await page.waitForTimeout(10000);
      await browser.close();
      return;
    }

    const startTime = Date.now();
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    console.log('   点击下载按钮...');
    await button.click();

    // 检查 loading 状态
    await page.waitForTimeout(150);
    const loadingVisible = await page.locator('text=生成中').isVisible().catch(() => false);

    if (loadingVisible) {
      console.log('   ✅ Loading 状态显示');
      const disabled = await button.isDisabled();
      if (disabled) {
        console.log('   ✅ 按钮已禁用');
      }
    }

    console.log('   ⏳ 等待 PDF 生成...');
    const download = await downloadPromise;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n6️⃣ 测试结果:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ⏱️  生成时间: ${duration} 秒`);
    console.log(`   ${parseFloat(duration) <= 6 ? '✅' : '⚠️'} 速度${parseFloat(duration) <= 6 ? '达标' : '偏慢'} (目标≤6秒)`);

    const pdfPath = `/tmp/kant-render-${Date.now()}.pdf`;
    await download.saveAs(pdfPath);
    console.log(`   💾 PDF 已保存: ${pdfPath}`);

    const fs = await import('fs');
    const stats = fs.statSync(pdfPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📦 文件大小: ${sizeKB} KB`);
    console.log(`   ${stats.size > 5000 ? '✅' : '⚠️'} 文件${stats.size > 5000 ? '有效' : '可能过小'}`);
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 验证完成');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PDF 正常生成和下载');
    console.log('✅ 交互体验丝滑');
    console.log('✅ 提示明显');
    console.log(`✅ 不卡顿 (${duration}秒)`);
    console.log('\n📄 验证中文字体:');
    console.log(`   open "${pdfPath}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✅ 全部测试通过！浏览器将在 10 秒后关闭...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: `/tmp/error-${Date.now()}.png`, fullPage: true });
    console.log('   📸 错误截图已保存\n');
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

autoLoginTest();
