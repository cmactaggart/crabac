import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { SnowflakeGenerator } from '../../lib/snowflake.js';
import { DEFAULT_MEMBER_PERMISSIONS, ALL_PERMISSIONS } from '@gud/shared';

const sf = new SnowflakeGenerator(1);
const id = () => sf.generate();

export async function seed(knex: Knex): Promise<void> {
  // Clean existing data (reverse FK order)
  await knex('refresh_tokens').del();
  await knex('message_reactions').del();
  await knex('messages').del();
  await knex('channel_members').del();
  await knex('channels').del();
  await knex('member_roles').del();
  await knex('space_members').del();
  await knex('invites').del();
  await knex('roles').del();
  await knex('spaces').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash('password123', 12);

  // --- Users ---
  const alice = id();
  const bob = id();
  const charlie = id();

  await knex('users').insert([
    { id: alice, email: 'alice@example.com', username: 'alice', display_name: 'Alice', password_hash: passwordHash },
    { id: bob, email: 'bob@example.com', username: 'bob', display_name: 'Bob', password_hash: passwordHash },
    { id: charlie, email: 'charlie@example.com', username: 'charlie', display_name: 'Charlie', password_hash: passwordHash },
  ]);

  // --- Space ---
  const spaceId = id();
  await knex('spaces').insert({
    id: spaceId,
    name: 'gud HQ',
    slug: 'gud-hq',
    description: 'The official gud development space',
    owner_id: alice,
  });

  // --- Roles ---
  const ownerRoleId = id();
  const modRoleId = id();
  const defaultRoleId = id();

  await knex('roles').insert([
    { id: ownerRoleId, space_id: spaceId, name: 'Owner', position: 2147483647, permissions: ALL_PERMISSIONS.toString(), is_system: true, is_default: false },
    { id: modRoleId, space_id: spaceId, name: 'Moderator', position: 10, permissions: (DEFAULT_MEMBER_PERMISSIONS | (1n << 2n) | (1n << 7n)).toString(), is_system: false, is_default: false, color: '#3498db' },
    { id: defaultRoleId, space_id: spaceId, name: 'Default', position: 0, permissions: DEFAULT_MEMBER_PERMISSIONS.toString(), is_system: true, is_default: true },
  ]);

  // --- Space Members ---
  await knex('space_members').insert([
    { space_id: spaceId, user_id: alice },
    { space_id: spaceId, user_id: bob },
    { space_id: spaceId, user_id: charlie },
  ]);

  // --- Member Roles ---
  await knex('member_roles').insert([
    { space_id: spaceId, user_id: alice, role_id: ownerRoleId },
    { space_id: spaceId, user_id: alice, role_id: defaultRoleId },
    { space_id: spaceId, user_id: bob, role_id: modRoleId },
    { space_id: spaceId, user_id: bob, role_id: defaultRoleId },
    { space_id: spaceId, user_id: charlie, role_id: defaultRoleId },
  ]);

  // --- Channels ---
  const adminId = id();
  const generalId = id();
  const randomId = id();
  const announcementsId = id();

  await knex('channels').insert([
    { id: adminId, space_id: spaceId, name: 'admin', topic: 'Admin-only channel for system notifications', type: 'text', position: -1, is_admin: true },
    { id: generalId, space_id: spaceId, name: 'general', topic: 'General discussion', type: 'text', position: 0 },
    { id: randomId, space_id: spaceId, name: 'random', topic: 'Off-topic chat', type: 'text', position: 1 },
    { id: announcementsId, space_id: spaceId, name: 'announcements', topic: 'Important updates', type: 'announcement', position: 2 },
  ]);

  // --- Messages in #general ---
  const msg1 = id();
  const msg2 = id();
  const msg3 = id();

  await knex('messages').insert([
    { id: msg1, channel_id: generalId, author_id: alice, content: 'Welcome to gud HQ! 🎉' },
    { id: msg2, channel_id: generalId, author_id: bob, content: 'Hey everyone! Excited to be here.' },
    { id: msg3, channel_id: generalId, author_id: charlie, content: 'Thanks for the invite, Alice!', reply_to_id: msg1 },
  ]);

  // --- Invite ---
  await knex('invites').insert({
    id: id(),
    space_id: spaceId,
    code: 'gudHQ2025',
    created_by: alice,
    max_uses: null,
    expires_at: null,
  });

  console.log('Seed data created successfully');
  console.log(`  Users: alice, bob, charlie (password: password123)`);
  console.log(`  Space: gud HQ (slug: gud-hq)`);
  console.log(`  Invite code: gudHQ2025`);
}
