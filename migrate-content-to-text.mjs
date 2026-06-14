import mysql from "mysql2/promise";
import { readFileSync } from "fs";

// Parse .env.local manually
const envContent = readFileSync(".env.local", "utf-8");
const dbUrlLine = envContent.split("\n").find((line) => line.startsWith("DATABASE_URL="));
const dbUrl = dbUrlLine.split("=")[1];

// Parse DATABASE_URL
const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(\w+)/);
if (!match) {
  throw new Error("Invalid DATABASE_URL format");
}

const [, user, password, host, port, database] = match;

const connection = await mysql.createConnection({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  },
});

console.log("Connected to TiDB");

// 1. Change content column from JSON to TEXT
console.log("\n1️⃣ Converting content column from JSON to TEXT...");
await connection.execute(`
  ALTER TABLE reports MODIFY COLUMN content TEXT NOT NULL
`);
console.log("✅ Column type changed");

// 2. Fix existing malformed records (if any)
console.log("\n2️⃣ Checking for malformed content...");
const [rows] = await connection.execute(
  "SELECT id, content FROM reports"
);

for (const row of rows) {
  const content = row.content;

  // If content looks like it was stringified wrong, try to clean it
  if (typeof content === 'string' && content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      // If it parsed as an object with numeric keys (character array), it's malformed
      const keys = Object.keys(parsed);
      if (keys.length > 0 && keys.every(k => !isNaN(k))) {
        console.log(`  ⚠️  Found malformed content in report ${row.id}`);
        // Reconstruct the string from character array
        const fixed = keys.sort((a, b) => parseInt(a) - parseInt(b))
          .map(k => parsed[k])
          .join('');

        await connection.execute(
          "UPDATE reports SET content = ? WHERE id = ?",
          [fixed, row.id]
        );
        console.log(`  ✅ Fixed report ${row.id}`);
      }
    } catch (e) {
      // Not JSON, probably already correct
    }
  }
}

await connection.end();
console.log("\n🎉 Migration complete!");
