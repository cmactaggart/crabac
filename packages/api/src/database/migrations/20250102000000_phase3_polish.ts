import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Attachments on messages
  await knex.schema.createTable('attachments', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('message_id').notNullable();
    t.string('filename', 255).notNullable();
    t.string('original_name', 255).notNullable();
    t.string('mime_type', 128).notNullable();
    t.integer('size').unsigned().notNullable(); // bytes
    t.string('url', 512).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.foreign('message_id').references('messages.id').onDelete('CASCADE');
    t.index('message_id');
  });

  // Channel categories
  await knex.schema.createTable('channel_categories', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.string('name', 100).notNullable();
    t.integer('position').notNullable().defaultTo(0);
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.foreign('space_id').references('spaces.id').onDelete('CASCADE');
    t.unique(['space_id', 'name']);
  });

  // Add category_id to channels
  await knex.schema.alterTable('channels', (t) => {
    t.bigInteger('category_id').nullable().after('space_id');
    t.foreign('category_id').references('channel_categories.id').onDelete('SET NULL');
  });

  // Unread tracking - last read message per user per channel
  await knex.schema.createTable('channel_reads', (t) => {
    t.bigInteger('channel_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.bigInteger('last_read_id').notNullable(); // snowflake ID of last read message
    t.bigInteger('mention_count').notNullable().defaultTo(0);
    t.primary(['channel_id', 'user_id']);
    t.foreign('channel_id').references('channels.id').onDelete('CASCADE');
    t.foreign('user_id').references('users.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('channel_reads');
  await knex.schema.alterTable('channels', (t) => {
    t.dropForeign('category_id');
    t.dropColumn('category_id');
  });
  await knex.schema.dropTableIfExists('channel_categories');
  await knex.schema.dropTableIfExists('attachments');
}
