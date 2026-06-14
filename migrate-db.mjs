import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2RHSTXDBpN45QRJ.root',
  password: 'UlZ1POeXbk8Okdk3',
  database: 'test',
  ssl: { rejectUnauthorized: true }
});

console.log('Adding pdf_status column...');
await conn.execute(`
  ALTER TABLE reports
  ADD COLUMN pdf_status ENUM('pending', 'generating', 'completed', 'failed') NOT NULL DEFAULT 'pending'
`);

console.log('Adding pdf_url column...');
await conn.execute(`
  ALTER TABLE reports
  ADD COLUMN pdf_url TEXT
`);

console.log('✅ Migration complete');
await conn.end();
process.exit(0);
