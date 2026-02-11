import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dm_reads', (t) => {
    t.bigInteger('conversation_id').notNullable().references('id').inTable('conversations').onDelete('CASCADE');
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('last_read_id').notNullable(); // snowflake ID of last read message
    t.primary(['conversation_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dm_reads');
}
