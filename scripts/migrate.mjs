import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "scripts/migrate.mjs: DATABASE_URL 未配置。请确认 .env.local 已写入 TiDB 连接串"
  );
}

const pool = mysql.createPool({ uri: url, connectionLimit: 1 });
const db = drizzle(pool);

console.log("Running migrations from ./drizzle ...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✓ Migrations applied.");

await pool.end();
