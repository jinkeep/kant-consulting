// Quick test: create a report and check if pdfStatus is returned
const BASE_URL = "https://kant-consulting.onrender.com";
const TEST_PHONE = "17767268888";
const TEST_CODE = "chijun";

console.log("🔍 Testing if new deployment is active...\n");

// 1. Login
const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: TEST_PHONE, inviteCode: TEST_CODE }),
});

if (!loginRes.ok) {
  console.log("❌ Login failed, Render may be deploying");
  process.exit(1);
}

const sessionCookie = loginRes.headers.getSetCookie().find((c) => c.startsWith("kant-session="));
const sessionToken = sessionCookie.split(";")[0].split("=")[1];

// 2. Check existing report
const checkRes = await fetch(`${BASE_URL}/api/report`, {
  headers: { Cookie: `kant-session=${sessionToken}` },
});

if (!checkRes.ok) {
  console.log("❌ API error, deployment may be in progress");
  process.exit(1);
}

const data = await checkRes.json();

if (data.pdfStatus !== undefined) {
  console.log("✅ NEW DEPLOYMENT IS LIVE!");
  console.log(`   pdfStatus: ${data.pdfStatus}`);
  console.log(`   reportId: ${data.reportId}`);
  console.log("\n🎉 Ready to test background PDF generation!");
} else {
  console.log("⏳ Old deployment still running (no pdfStatus field)");
  console.log("   Wait 1-2 minutes and try again");
}
