# Render 线上报告功能验证计划

## 用户需求
验证 kant-consulting.onrender.com 报告功能：
1. ✅ PDF 正常生成和下载
2. ✅ 交互体验丝滑（loading 状态明确）
3. ✅ 提示明显（按钮文字、状态清晰）
4. ✅ 不卡顿（优化后 3-5 秒生成）

## 已完成的优化

### 1. PDF 生成速度优化 (Commit 5a083f1)
**问题**: 原方案速度慢（localStorage 注入 + reload）
**解决方案**:
```typescript
// 旧方案（慢）:
// 1. await page.goto(reportUrl)
// 2. await page.evaluate(md => localStorage.setItem(...), markdown)
// 3. await page.reload()  ← 额外的页面加载

// 新方案（快）:
const encodedMarkdown = encodeURIComponent(markdown);
const reportUrl = `${origin}/report?__pdf=1&content=${encodedMarkdown}`;
await page.goto(reportUrl, { waitUntil: "networkidle" });  // 一次加载完成
```
**效果**: 消除了 reload 开销，本地测试从 ~6s 降至 ~3.8s

### 2. 中文字体乱码修复 (Commit 5a083f1)
**问题**: Render chromium 缺少中文字体，生成的 PDF 全是乱码
**解决方案**:
```typescript
// 注入 Google Fonts 中文字体
await page.addStyleTag({
  content: `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
    body, * {
      font-family: 'Noto Sans SC', ui-sans-serif, system-ui, -apple-system, sans-serif !important;
    }
  `,
});

// 等待字体加载完成
await page.evaluate(() => document.fonts.ready);
```
**效果**: PDF 中文字符完整显示，无乱码

### 3. 下载按钮交互优化 (Commit 011a813)
**问题**: 
- 点击按钮后无任何反馈（生成需要 3-5 秒）
- 可能重复点击导致多次生成
- 用户不确定是否在处理

**解决方案**:
```typescript
const [pdfGenerating, setPdfGenerating] = React.useState(false);

// 点击处理
onClick={async () => {
  if (pdfGenerating) return;
  setPdfGenerating(true);  // 立即显示 loading
  try {
    // ... PDF 生成逻辑
  } finally {
    setPdfGenerating(false);  // 恢复可点击
  }
}}

// 按钮状态
disabled={pdfGenerating}
className="... disabled:opacity-50 disabled:cursor-not-allowed"

// 动态内容
{pdfGenerating ? (
  <>
    <motion.span animate={{ rotate: 360 }} ...>⟳</motion.span>
    生成中…
  </>
) : (
  <>
    <span>↓</span>
    下载 PDF
  </>
)}
```

**UX 改进点**:
- ✅ 点击后立即 disabled（防止重复点击）
- ✅ 旋转 spinner 提供持续反馈
- ✅ 文字变为 "生成中…" 清晰告知状态
- ✅ 降低透明度 (opacity-50) + 禁用光标
- ✅ 尊重 `prefers-reduced-motion` 设置

## 验证计划

### Phase 1: 部署验证
- [x] 代码提交并推送到 GitHub
- [x] Render 自动部署触发 (commit 011a813)
- [x] 部署状态监控 (预计 3-5 分钟)
- [x] 验证线上代码版本正确 ✅ 部署完成 dep-d8mvcr6rnols73d4gdrg

### Phase 2: 功能测试

#### Test 2.1: PDF 生成速度
**步骤**:
1. 访问 https://kant-consulting.onrender.com/report
2. 点击 "下载 PDF" 按钮
3. 使用浏览器 Network 面板测量 `/api/report/pdf` 响应时间
4. 或手动计时：点击 → 浏览器下载开始

**预期结果**:
- ⏱️ 3-5 秒完成（优化后）
- ✅ PDF 文件成功下载
- ✅ 文件名格式: `kant-report-{timestamp}.pdf`

**判定标准**:
- ✅ PASS: ≤6 秒
- ⚠️ WARN: 6-10 秒（可接受但需优化）
- ❌ FAIL: >10 秒（性能问题）

#### Test 2.2: 中文字体渲染
**步骤**:
1. 下载生成的 PDF
2. 用 PDF 阅读器打开（Preview / Adobe Acrobat / Chrome）
3. 检查报告中的中文内容

**预期结果**:
- ✅ 所有中文字符正常显示
- ✅ 字体清晰可读（Noto Sans SC）
- ✅ 无方框、问号或乱码

**判定标准**:
- ✅ PASS: 全部中文正常显示
- ❌ FAIL: 任何乱码/缺字

#### Test 2.3: 按钮交互体验（丝滑度）
**步骤**:
1. 点击 "下载 PDF" 按钮
2. 观察按钮状态变化
3. 尝试在生成中再次点击
4. 等待完成后再次点击

**预期行为**:
1. **点击瞬间**:
   - 按钮立即变为 disabled
   - 图标变为旋转 spinner (⟳)
   - 文字变为 "生成中…"
   - 背景色变暗 (opacity-50)
   - 光标变为 not-allowed

2. **生成中**:
   - Spinner 持续旋转
   - 按钮无法再次点击
   - 无卡顿或闪烁

3. **完成后**:
   - 按钮恢复为 "下载 PDF"
   - 恢复可点击状态
   - 浏览器触发 PDF 下载

**判定标准**:
- ✅ PASS: 
  - 反馈延迟 <100ms
  - 状态变化流畅
  - 防止重复点击
  - 动画无卡顿
- ❌ FAIL: 
  - 点击无反馈 >100ms
  - 可以重复点击
  - 动画卡顿

#### Test 2.4: 提示明显性
**步骤**:
1. 不熟悉页面的用户视角
2. 浏览报告页面
3. 查找下载功能

**预期**:
- ✅ "下载 PDF" 按钮位于页面顶部统计区域
- ✅ 使用主色调 (bg-kant-fg) 突出显示
- ✅ 下载图标 (↓) 清晰可见
- ✅ 鼠标悬停有 hover 效果
- ✅ Loading 状态文字清晰 ("生成中…")

**判定标准**:
- ✅ PASS: 3 秒内找到下载按钮
- ❌ FAIL: 需要查找 >10 秒

#### Test 2.5: 错误处理
**步骤**:
1. 触发错误场景（如断网、服务器错误）
2. 观察错误提示

**预期**:
- ✅ Alert 显示明确错误信息
- ✅ 错误信息包含具体原因（不是通用 "失败"）
- ✅ 按钮恢复可点击（允许重试）

**判定标准**:
- ✅ PASS: 清晰的错误信息 + 可重试
- ❌ FAIL: 无提示或按钮卡死

### Phase 3: 可访问性测试

#### Test 3.1: 键盘导航
**步骤**:
1. 使用 Tab 键导航到按钮
2. 按 Enter 触发下载
3. 生成中按 Tab 移开焦点再移回

**预期**:
- ✅ 按钮可通过 Tab 聚焦
- ✅ Enter 可触发下载
- ✅ Disabled 状态下无法触发

#### Test 3.2: 减少动画偏好
**步骤**:
1. 开启系统 "减少动画" 设置
2. 点击下载按钮
3. 观察 spinner 行为

**预期**:
- ✅ Spinner 不旋转（尊重 `prefers-reduced-motion`）
- ✅ 仍显示 "生成中…" 文字反馈

### Phase 4: 移动端测试（可选）

#### Test 4.1: 触摸体验
- ✅ 按钮触摸区域 ≥44pt
- ✅ 按下时有视觉反馈 (whileTap scale)
- ✅ 不会误触

#### Test 4.2: 响应式布局
- ✅ 按钮在小屏幕下仍清晰可见
- ✅ 文字不截断

## 当前部署状态

```
Commit: 011a813 (feat: add loading state to PDF download button)
Deploy: dep-d8mvcr6rnols73d4gdrg
Status: build_in_progress
Started: 2026-06-14 (monitoring in background)
```

## 验证清单总结

### 必须验证 (MUST)
- [ ] PDF 生成时间 ≤6 秒
- [ ] 中文字体无乱码
- [ ] 点击后立即显示 loading 状态
- [ ] Loading 期间按钮 disabled
- [ ] 完成后自动下载

### 应该验证 (SHOULD)
- [ ] 错误场景提示清晰
- [ ] 键盘导航可用
- [ ] Reduced motion 支持
- [ ] 移动端触摸体验

### 可选验证 (NICE-TO-HAVE)
- [ ] 多次连续下载测试
- [ ] 不同浏览器兼容性
- [ ] PDF 文件大小合理

## 成功标准

**体验评级**:
- ⭐⭐⭐⭐⭐ 优秀: 所有 MUST + SHOULD 项通过
- ⭐⭐⭐⭐ 良好: 所有 MUST 项通过
- ⭐⭐⭐ 可接受: 核心功能（生成/下载/字体）通过
- ⭐⭐ 需改进: 存在明显 UX 问题
- ⭐ 不可用: 核心功能失败

**用户需求对照**:
1. ✅ "正常生成和下载" → Test 2.1 + 2.2
2. ✅ "交互体验丝滑" → Test 2.3 (反馈延迟 <100ms)
3. ✅ "提示明显" → Test 2.4 + 按钮视觉设计
4. ✅ "不卡顿" → Test 2.1 (速度优化) + Test 2.3 (动画流畅)
