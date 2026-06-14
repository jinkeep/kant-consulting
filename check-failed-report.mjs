import mysql from "mysql2/promise";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
const dbUrlLine = envContent.split("\n").find((line) => line.startsWith("DATABASE_URL="));
const dbUrl = dbUrlLine.split("=")[1];

const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(\w+)/);
const [, user, password, host, port, database] = match;

const connection = await mysql.createConnection({
  host, port: parseInt(port), user, password, database,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
});

console.log("🔍 检查失败的报告...\n");

const [rows] = await connection.execute(`
  SELECT id, pdf_status, created_at 
  FROM reports 
  WHERE pdf_status = 'failed'
  ORDER BY created_at DESC 
  LIMIT 5
`);

console.log(`找到 ${rows.length} 个失败的报告\n`);

for (const row of rows) {
  console.log(`📄 报告 ID: ${row.id}`);
  console.log(`   状态: ${row.pdf_status}`);
  console.log(`   时间: ${row.created_at}`);
  console.log('');
}

await connection.end();
