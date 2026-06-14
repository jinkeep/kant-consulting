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

console.log("Checking recent reports...\n");

const [rows] = await connection.execute(`
  SELECT id, user_phone, LEFT(content, 50) as content_preview, pdf_status, pdf_url, created_at 
  FROM reports 
  ORDER BY created_at DESC 
  LIMIT 5
`);

console.table(rows);

await connection.end();
