import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.enum('type', ['mention', 'reply', 'portal_invite']).notNullable();
    table.json('data').notNullable();
    table.boolean('read').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'read', 'created_at']);
  });

  // Message mentions table
  await knex.schema.createTable('message_mentions', (table) => {
    table.bigInteger('message_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.enum('mention_type', ['user', 'everyone', 'here']).notNullable().defaultTo('user');
    table.primary(['message_id', 'user_id']);
    table.foreign('message_id').references('messages.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });

  // User mutes table
  await knex.schema.createTable('user_mutes', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('muted_user_id').notNullable();
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    table.primary(['user_id', 'muted_user_id']);
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('muted_user_id').references('users.id').onDelete('CASCADE');
  });

  // Add FULLTEXT index on messages.content for search
  await knex.raw('ALTER TABLE messages ADD FULLTEXT INDEX ft_messages_content (content)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE messages DROP INDEX ft_messages_content');
  await knex.schema.dropTableIfExists('user_mutes');
  await knex.schema.dropTableIfExists('message_mentions');
  await knex.schema.dropTableIfExists('notifications');
}
