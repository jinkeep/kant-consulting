import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2RHSTXDBpN45QRJ.root',
  password: 'UlZ1POeXbk8Okdk3',
  database: 'test',
  ssl: { rejectUnauthorized: true }
});

const [reports] = await connection.execute(
  'SELECT id, user_phone, created_at FROM reports WHERE user_phone = ? ORDER BY created_at DESC LIMIT 3',
  ['17767268888']
);

console.log('用户 17767268888 的报告:');
reports.forEach(r => console.log(`  ${r.id} - ${r.created_at}`));

if (reports.length > 0) {
  const [full] = await connection.execute('SELECT content FROM reports WHERE id = ?', [reports[0].id]);
  const content = full[0].content;
  
  console.log('\n最新报告 content keys:', Object.keys(content));
  if (content.report) {
    console.log('✅ report 字段存在, 长度:', content.report.length);
    console.log('\n前 200 字符:');
    console.log(content.report.substring(0, 200));
  } else {
    console.log('❌ 没有 report 字段');
  }
}

await connection.end();
