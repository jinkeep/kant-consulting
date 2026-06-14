import { getDb } from "./src/lib/db/client.js";
import { users, inviteCodes } from "./src/lib/db/schema.js";

async function check() {
  const db = getDb();

  console.log('📞 查找用户 17767268888...');
  const allUsers = await db.select().from(users);
  console.log('所有用户数:', allUsers.length);
  allUsers.forEach(u => {
    console.log(`  - ${u.phone} (${u.role}, inviteCode: ${u.inviteCode})`);
  });

  const targetUser = allUsers.find(u => u.phone === '17767268888');
  if (targetUser) {
    console.log('✅ 找到目标用户:', targetUser);
  } else {
    console.log('❌ 未找到用户 17767268888');
  }

  console.log('\n🎫 查找邀请码 chijun...');
  const allCodes = await db.select().from(inviteCodes);
  console.log('所有邀请码数:', allCodes.length);
  allCodes.forEach(c => {
    console.log(`  - ${c.code} (${c.isActive ? '活跃' : '已用'}, ${c.role})`);
  });

  const targetCode = allCodes.find(c => c.code === 'chijun');
  if (targetCode) {
    console.log('✅ 找到邀请码 chijun:', targetCode);
  } else {
    console.log('❌ 未找到邀请码 chijun');
  }
}

check().catch(console.error);
