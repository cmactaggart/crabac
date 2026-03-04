/**
 * Backfill Typesense with existing messages from MySQL.
 * Usage: pnpm search:backfill
 */
import 'dotenv/config';
import { db } from '../database/connection.js';
import { initTypesense, getTypesenseClient } from '../lib/typesense.js';
import { ensureCollections } from '../modules/search/search.service.js';

const BATCH_SIZE = 1000;
const EPOCH = 1735689600000n;

function snowflakeToTimestamp(id: string): number {
  try {
    return Number((BigInt(id) >> 22n) + EPOCH);
  } catch {
    return Date.now();
  }
}

async function backfillSpaceMessages() {
  const client = getTypesenseClient();
  if (!client) return;

  console.log('Backfilling space messages...');
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    let query = db('messages')
      .join('channels', 'messages.channel_id', 'channels.id')
      .join('users', 'messages.author_id', 'users.id')
      .select(
        'messages.id',
        'messages.content',
        'messages.channel_id',
        'channels.name as channel_name',
        'channels.space_id',
        'messages.author_id',
        'users.username as author_username',
      )
      .orderBy('messages.id', 'asc')
      .limit(BATCH_SIZE);

    if (cursor) {
      query = query.where('messages.id', '>', cursor);
    }

    const rows = await query;
    if (rows.length === 0) break;

    const documents = rows.map((r: any) => ({
      id: String(r.id),
      content: r.content || '',
      channel_id: String(r.channel_id),
      channel_name: r.channel_name,
      space_id: String(r.space_id),
      author_id: String(r.author_id),
      author_username: r.author_username,
      created_at: snowflakeToTimestamp(String(r.id)),
    }));

    try {
      await client.collections('space_messages').documents().import(documents, { action: 'upsert' });
    } catch (err: any) {
      // import returns per-doc results; log failures
      console.error(`Batch error at cursor ${cursor}:`, err.message || err);
    }

    total += rows.length;
    cursor = String(rows[rows.length - 1].id);
    process.stdout.write(`\r  Space messages indexed: ${total}`);
  }

  console.log(`\n  Done: ${total} space messages indexed.`);
}

async function backfillDirectMessages() {
  const client = getTypesenseClient();
  if (!client) return;

  console.log('Backfilling direct messages...');
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    let query = db('direct_messages')
      .join('users', 'direct_messages.author_id', 'users.id')
      .select(
        'direct_messages.id',
        'direct_messages.content',
        'direct_messages.conversation_id',
        'direct_messages.author_id',
        'users.username as author_username',
      )
      .orderBy('direct_messages.id', 'asc')
      .limit(BATCH_SIZE);

    if (cursor) {
      query = query.where('direct_messages.id', '>', cursor);
    }

    const rows = await query;
    if (rows.length === 0) break;

    const documents = rows.map((r: any) => ({
      id: String(r.id),
      content: r.content || '',
      conversation_id: String(r.conversation_id),
      author_id: String(r.author_id),
      author_username: r.author_username,
      created_at: snowflakeToTimestamp(String(r.id)),
    }));

    try {
      await client.collections('direct_messages').documents().import(documents, { action: 'upsert' });
    } catch (err: any) {
      console.error(`Batch error at cursor ${cursor}:`, err.message || err);
    }

    total += rows.length;
    cursor = String(rows[rows.length - 1].id);
    process.stdout.write(`\r  Direct messages indexed: ${total}`);
  }

  console.log(`\n  Done: ${total} direct messages indexed.`);
}

async function main() {
  console.log('=== Typesense Backfill ===\n');

  initTypesense();
  const client = getTypesenseClient();
  if (!client) {
    console.error('Typesense not configured. Set TYPESENSE_API_KEY in .env');
    process.exit(1);
  }

  await ensureCollections();
  await backfillSpaceMessages();
  await backfillDirectMessages();

  console.log('\nBackfill complete.');
  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
