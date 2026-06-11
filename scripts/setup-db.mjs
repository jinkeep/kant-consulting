import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import mysql from "mysql2/promise";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL 未配置");
}

const pool = mysql.createPool({ uri: url, connectionLimit: 1 });

console.log("Creating tables...");

await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id varchar(36) NOT NULL,
  phone varchar(20) NOT NULL,
  invite_code varchar(50) NOT NULL,
  role enum('admin','user') NOT NULL DEFAULT 'user',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_phone_unique (phone)
)
`);

await pool.query(`
CREATE TABLE IF NOT EXISTS invite_codes (
  id varchar(36) NOT NULL,
  code varchar(50) NOT NULL,
  role enum('admin','user') NOT NULL DEFAULT 'user',
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar(36),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY invite_codes_code_unique (code),
  KEY (created_by)
)
`);

await pool.query(`
CREATE TABLE IF NOT EXISTS reports (
  id varchar(36) NOT NULL,
  user_phone varchar(20) NOT NULL,
  session_id varchar(36),
  content json NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY reports_phone_idx (user_phone, created_at)
)
`);

await pool.query(`
CREATE TABLE IF NOT EXISTS app_settings (
  \`key\` varchar(100) NOT NULL,
  value text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`key\`)
)
`);

await pool.query(`
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS user_phone varchar(20)
`);

await pool.query(`
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS user_phone varchar(20)
`);

console.log("✓ Tables created");

console.log("Seeding invite codes...");

await pool.query(`
INSERT IGNORE INTO invite_codes (id, code, role, is_active, created_by)
VALUES
  (UUID(), 'louis', 'admin', true, NULL),
  (UUID(), 'mango', 'user', true, NULL)
`);

console.log("✓ Seeded: louis (admin), mango (user)");

await pool.end();
