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

console.log("Fixing JSON-encoded content strings...\n");

const [rows] = await connection.execute("SELECT id, content FROM reports");

for (const row of rows) {
  const content = row.content;
  
  // If content starts with a quote, it's JSON-encoded
  if (content.startsWith('"')) {
    try {
      const decoded = JSON.parse(content);
      await connection.execute(
        "UPDATE reports SET content = ? WHERE id = ?",
        [decoded, row.id]
      );
      console.log(`✅ Fixed report ${row.id}`);
    } catch (e) {
      console.log(`⚠️  Could not parse report ${row.id}: ${e.message}`);
    }
  }
}

await connection.end();
console.log("\n🎉 Done!");
