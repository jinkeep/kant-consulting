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

console.log("🔍 检查最新报告的状态...\n");

const [rows] = await connection.execute(`
  SELECT id, user_phone, pdf_status, pdf_url, created_at 
  FROM reports 
  ORDER BY created_at DESC 
  LIMIT 3
`);

for (const row of rows) {
  console.log(`📄 报告 ID: ${row.id}`);
  console.log(`   用户: ${row.user_phone}`);
  console.log(`   PDF 状态: ${row.pdf_status}`);
  console.log(`   PDF URL: ${row.pdf_url || '(未生成)'}`);
  console.log(`   创建时间: ${row.created_at}`);
  console.log('');
}

await connection.end();
