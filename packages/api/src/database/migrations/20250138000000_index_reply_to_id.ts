import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('messages', (t) => {
    t.index(['reply_to_id'], 'idx_messages_reply_to');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('messages', (t) => {
    t.dropIndex(['reply_to_id'], 'idx_messages_reply_to');
  });
}
