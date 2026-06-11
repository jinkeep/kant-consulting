import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { inviteCodes } from "../src/lib/db/schema.ts";
import { randomUUID } from "crypto";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL 未配置");
}

const pool = mysql.createPool({ uri: url, connectionLimit: 1 });
const db = drizzle(pool);

console.log("Seeding invite codes...");

await db.insert(inviteCodes).values([
  {
    id: randomUUID(),
    code: "louis",
    role: "admin",
    isActive: true,
    createdBy: null,
  },
  {
    id: randomUUID(),
    code: "mango",
    role: "user",
    isActive: true,
    createdBy: null,
  },
]);

console.log("✓ Seeded: louis (admin), mango (user)");

await pool.end();
