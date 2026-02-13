import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add 'forum' to channels.type enum (preserving existing data)
  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum') NOT NULL DEFAULT 'text'"
  );
  // Add is_public column
  await knex.schema.alterTable('channels', (t) => {
    t.boolean('is_public').notNullable().defaultTo(false);
  });

  // Create forum_threads table
  await knex.schema.createTable('forum_threads', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('channel_id').notNullable();
    t.string('title', 200).notNullable();
    t.bigInteger('author_id').notNullable();
    t.boolean('is_pinned').notNullable().defaultTo(false);
    t.boolean('is_locked').notNullable().defaultTo(false);
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    t.foreign('author_id').references('id').inTable('users');
    t.index(['channel_id', 'id'], 'idx_forum_threads_channel');
    t.index(['channel_id', 'is_pinned', 'id'], 'idx_forum_threads_pinned');
  });

  // Add thread_id to messages
  await knex.schema.alterTable('messages', (t) => {
    t.bigInteger('thread_id').nullable();
    t.foreign('thread_id').references('id').inTable('forum_threads').onDelete('CASCADE');
    t.index(['thread_id', 'id'], 'idx_messages_thread');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove thread_id from messages
  await knex.schema.alterTable('messages', (t) => {
    t.dropForeign(['thread_id']);
    t.dropIndex(['thread_id', 'id'], 'idx_messages_thread');
    t.dropColumn('thread_id');
  });

  // Drop forum_threads
  await knex.schema.dropTableIfExists('forum_threads');

  // Remove is_public and revert type enum
  await knex.schema.alterTable('channels', (t) => {
    t.dropColumn('is_public');
  });
  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only') NOT NULL DEFAULT 'text'"
  );
}
