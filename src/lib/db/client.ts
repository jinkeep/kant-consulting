import "server-only";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";

type DbClient = MySql2Database<typeof schema>;

let cache: { db: DbClient; pool: mysql.Pool } | null = null;

function init(): { db: DbClient; pool: mysql.Pool } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL 未配置。请在 .env.local 设置 TiDB Serverless 连接串"
    );
  }
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 5,
    waitForConnections: true,
  });
  const db = drizzle(pool, { schema, mode: "default" });
  return { db, pool };
}

export function getDb(): DbClient {
  if (!cache) cache = init();
  return cache.db;
}

export function getPool(): mysql.Pool {
  if (!cache) cache = init();
  return cache.pool;
}

export type Db = DbClient;
