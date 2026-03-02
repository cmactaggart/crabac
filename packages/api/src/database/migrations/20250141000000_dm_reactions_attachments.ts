import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dm_message_reactions', (table) => {
    table.bigInteger('dm_message_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.string('emoji', 64).notNullable();
    table.primary(['dm_message_id', 'user_id', 'emoji']);
    table.foreign('dm_message_id').references('id').inTable('direct_messages').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  await knex.schema.createTable('dm_attachments', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('dm_message_id').notNullable();
    table.string('filename', 255).notNullable();
    table.string('original_name', 255).notNullable();
    table.string('mime_type', 128).notNullable();
    table.integer('size').unsigned().notNullable();
    table.string('url', 512).notNullable();
    table.json('metadata').nullable();
    table.foreign('dm_message_id').references('id').inTable('direct_messages').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dm_attachments');
  await knex.schema.dropTableIfExists('dm_message_reactions');
}
