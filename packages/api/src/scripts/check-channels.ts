import { db } from '../database/connection.js';

async function main() {
  const rows = await db('channels').orderBy('id', 'desc').limit(5).select('id', 'name', 'type');
  for (const r of rows) console.log('id:', String(r.id), 'name:', r.name, 'type:', r.type);
  process.exit(0);
}

main();
