#!/usr/bin/env node
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://2RHSTXDBpN45QRJ.root:UlZ1POeXbk8Okdk3@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function checkDatabase() {
  console.log('🔍 检查数据库...\n');

  const connection = await mysql.createConnection(DB_URL);

  try {
    // 查询用户
    console.log('📞 查找用户 17767268888...');
    const [users] = await connection.execute('SELECT * FROM users WHERE phone = ?', ['17767268888']);

    if (users.length > 0) {
      console.log('✅ 找到用户:', users[0]);
    } else {
      console.log('❌ 未找到用户 17767268888');
      console.log('\n所有用户:');
      const [allUsers] = await connection.execute('SELECT id, phone, role, inviteCode, createdAt FROM users LIMIT 10');
      console.table(allUsers);
    }

    // 查询邀请码
    console.log('\n🎫 查找邀请码 chijun...');
    const [codes] = await connection.execute('SELECT * FROM invite_codes WHERE code = ?', ['chijun']);

    if (codes.length > 0) {
      console.log('✅ 找到邀请码:', codes[0]);
    } else {
      console.log('❌ 未找到邀请码 chijun');
      console.log('\n所有邀请码:');
      const [allCodes] = await connection.execute('SELECT code, role, isActive, createdAt FROM invite_codes LIMIT 10');
      console.table(allCodes);
    }

    // 如果用户不存在但邀请码存在，说明需要注册
    if (users.length === 0 && codes.length > 0) {
      console.log('\n💡 提示: 用户不存在但邀请码有效');
      console.log('   首次登录会自动注册新用户');
    }

  } finally {
    await connection.end();
  }
}

checkDatabase().catch(console.error);
