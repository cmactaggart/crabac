import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Channel permission overrides (per-role per-channel)
  await knex.schema.createTable('channel_permission_overrides', (table) => {
    table.bigInteger('channel_id').notNullable();
    table.bigInteger('role_id').notNullable();
    table.bigInteger('allow').notNullable().defaultTo(0);
    table.bigInteger('deny').notNullable().defaultTo(0);
    table.primary(['channel_id', 'role_id']);
    table.foreign('channel_id').references('channels.id').onDelete('CASCADE');
    table.foreign('role_id').references('roles.id').onDelete('CASCADE');
  });

  // Channel mutes (per-user per-channel)
  await knex.schema.createTable('channel_mutes', (table) => {
    table.bigInteger('channel_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.primary(['channel_id', 'user_id']);
    table.foreign('channel_id').references('channels.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });

  // Portals (cross-space channel links)
  await knex.schema.createTable('portals', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('channel_id').notNullable();
    table.bigInteger('source_space_id').notNullable();
    table.bigInteger('target_space_id').notNullable();
    table.bigInteger('created_by').notNullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.unique(['channel_id', 'target_space_id']);
    table.foreign('channel_id').references('channels.id').onDelete('CASCADE');
    table.foreign('source_space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('target_space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('created_by').references('users.id').onDelete('CASCADE');
  });

  // Portal invites (pending portal requests)
  await knex.schema.createTable('portal_invites', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('channel_id').notNullable();
    table.bigInteger('source_space_id').notNullable();
    table.bigInteger('target_space_id').notNullable();
    table.bigInteger('requested_by').notNullable();
    table.enum('status', ['pending', 'accepted', 'rejected']).notNullable().defaultTo('pending');
    table.bigInteger('resolved_by').nullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: false }).nullable();
    table.foreign('channel_id').references('channels.id').onDelete('CASCADE');
    table.foreign('source_space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('target_space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('requested_by').references('users.id').onDelete('CASCADE');
    table.foreign('resolved_by').references('users.id').onDelete('SET NULL');
  });

  // Add is_admin column to channels
  await knex.schema.alterTable('channels', (table) => {
    table.boolean('is_admin').notNullable().defaultTo(false);
  });

  // Add message_type and metadata to messages
  await knex.schema.alterTable('messages', (table) => {
    table.string('message_type', 32).notNullable().defaultTo('user');
    table.json('metadata').nullable();
  });

  // Create #admin channel for every existing space
  const spaces = await knex('spaces').select('id');
  if (spaces.length > 0) {
    // Use raw SQL to generate snowflake-like IDs based on timestamp
    const now = Date.now();
    const EPOCH = 1735689600000;
    for (let i = 0; i < spaces.length; i++) {
      const ts = BigInt(now - EPOCH + i);
      const id = (ts << 22n) | BigInt(i + 1);
      await knex('channels').insert({
        id: id.toString(),
        space_id: spaces[i].id,
        name: 'admin',
        topic: 'Admin-only channel for system notifications',
        type: 'text',
        position: -1,
        is_admin: true,
        is_private: false,
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove admin channels
  await knex('channels').where('is_admin', true).delete();

  // Remove added columns
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('message_type');
    table.dropColumn('metadata');
  });

  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('is_admin');
  });

  // Drop new tables (reverse order)
  await knex.schema.dropTableIfExists('portal_invites');
  await knex.schema.dropTableIfExists('portals');
  await knex.schema.dropTableIfExists('channel_mutes');
  await knex.schema.dropTableIfExists('channel_permission_overrides');
}
