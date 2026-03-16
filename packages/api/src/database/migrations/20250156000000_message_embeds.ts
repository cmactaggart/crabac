import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.createTable('message_embeds', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('message_id').notNullable();
    t.string('url', 2048).notNullable();
    t.string('title', 500).nullable();
    t.text('description').nullable();
    t.string('image_url', 2048).nullable();
    t.string('favicon_url', 2048).nullable();
    t.string('site_name', 255).nullable();
    t.string('og_type', 100).nullable();
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    t.index('message_id');
    t.foreign('message_id').references('id').inTable('messages').onDelete('CASCADE');
  });

  await knex.schema.createTable('dm_message_embeds', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('dm_message_id').notNullable();
    t.string('url', 2048).notNullable();
    t.string('title', 500).nullable();
    t.text('description').nullable();
    t.string('image_url', 2048).nullable();
    t.string('favicon_url', 2048).nullable();
    t.string('site_name', 255).nullable();
    t.string('og_type', 100).nullable();
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    t.index('dm_message_id');
    t.foreign('dm_message_id').references('id').inTable('direct_messages').onDelete('CASCADE');
  });
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('dm_message_embeds');
  await knex.schema.dropTableIfExists('message_embeds');
}
