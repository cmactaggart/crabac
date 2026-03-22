import { db } from '../database/connection.js';

async function main() {
  // Clean stale calls
  const calls = await db('calls').whereIn('status', ['ringing', 'active']).select('*');
  console.log('Active calls:', calls.length);
  for (const c of calls) console.log('  id:', String(c.id), 'status:', c.status);

  if (calls.length > 0) {
    await db('call_participants').whereIn('call_id', calls.map((c: any) => c.id)).delete();
    await db('calls').whereIn('status', ['ringing', 'active']).update({ status: 'ended', ended_at: db.fn.now(3) });
    console.log('Cleaned up calls');
  }

  // Fix broken voice channel
  const fixed = await db('channels').where('type', '').update({ type: 'voice' });
  if (fixed) console.log('Fixed', fixed, 'channel(s) with empty type → voice');

  // Delete old ended voice channel calls (they block unique room_name)
  const endedVc = await db('calls').where({ type: 'voice_channel', status: 'ended' }).select('id');
  if (endedVc.length > 0) {
    await db('call_participants').whereIn('call_id', endedVc.map((c: any) => c.id)).delete();
    await db('calls').where({ type: 'voice_channel', status: 'ended' }).delete();
    console.log('Deleted', endedVc.length, 'ended voice channel call(s)');
  }

  process.exit(0);
}

main();
