import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Friendships table
  await knex.schema.createTable('friendships', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('friend_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enum('status', ['pending', 'accepted']).notNullable().defaultTo('pending');
    t.timestamp('created_at', { useTz: false, precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { useTz: false, precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.unique(['user_id', 'friend_id']);
    t.index(['user_id', 'status']);
    t.index(['friend_id', 'status']);
  });

  // Add type, name, owner_id to conversations
  await knex.schema.alterTable('conversations', (t) => {
    t.enum('type', ['dm', 'group']).notNullable().defaultTo('dm');
    t.string('name', 100).nullable();
    t.bigInteger('owner_id').nullable().references('id').inTable('users').onDelete('SET NULL');
  });

  // Add status to conversation_members
  await knex.schema.alterTable('conversation_members', (t) => {
    t.enum('status', ['pending', 'accepted']).notNullable().defaultTo('accepted');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('conversation_members', (t) => {
    t.dropColumn('status');
  });
  await knex.schema.alterTable('conversations', (t) => {
    t.dropColumn('type');
    t.dropColumn('name');
    t.dropColumn('owner_id');
  });
  await knex.schema.dropTableIfExists('friendships');
}
