import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Conversations (DM pairs)
  await knex.schema.createTable('conversations', (t) => {
    t.bigInteger('id').primary();
    t.timestamp('created_at', { useTz: false, precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { useTz: false, precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  // Conversation members (exactly 2 for a DM)
  await knex.schema.createTable('conversation_members', (t) => {
    t.bigInteger('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['conversation_id', 'user_id']);
    t.index('user_id');
  });

  // Direct messages
  await knex.schema.createTable('direct_messages', (t) => {
    t.bigInteger('id').primary(); // snowflake
    t.bigInteger('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    t.bigInteger('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('content').notNullable();
    t.timestamp('edited_at', { useTz: false, precision: 3 }).nullable();
    t.index(['conversation_id', 'id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('direct_messages');
  await knex.schema.dropTableIfExists('conversation_members');
  await knex.schema.dropTableIfExists('conversations');
}
