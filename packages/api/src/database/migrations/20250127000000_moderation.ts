import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Space bans
  await knex.schema.createTable('space_bans', (table) => {
    table.bigInteger('space_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.bigInteger('banned_by').notNullable();
    table.text('reason').nullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.primary(['space_id', 'user_id']);
    table.foreign('space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('banned_by').references('users.id').onDelete('CASCADE');
  });

  // Global app bans
  await knex.schema.createTable('user_bans', (table) => {
    table.bigInteger('user_id').primary();
    table.bigInteger('banned_by').notNullable();
    table.text('reason').nullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('banned_by').references('users.id').onDelete('CASCADE');
  });

  // Reports
  await knex.schema.createTable('reports', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('reporter_id').notNullable();
    table.bigInteger('reported_user_id').notNullable();
    table.bigInteger('space_id').nullable();
    table.bigInteger('channel_id').nullable();
    table.bigInteger('message_id').nullable();
    table.bigInteger('dm_message_id').nullable();
    table.bigInteger('conversation_id').nullable();
    table.text('reason').notNullable();
    table.enum('status', ['pending', 'resolved', 'dismissed']).notNullable().defaultTo('pending');
    table.bigInteger('resolved_by').nullable();
    table.timestamp('resolved_at', { useTz: false }).nullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.foreign('reporter_id').references('users.id').onDelete('CASCADE');
    table.foreign('reported_user_id').references('users.id').onDelete('CASCADE');
    table.index(['space_id', 'status']);
    table.index(['status', 'created_at']);
  });

  // User blocks
  await knex.schema.createTable('user_blocks', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('blocked_user_id').notNullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.primary(['user_id', 'blocked_user_id']);
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('blocked_user_id').references('users.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_blocks');
  await knex.schema.dropTableIfExists('reports');
  await knex.schema.dropTableIfExists('user_bans');
  await knex.schema.dropTableIfExists('space_bans');
}
