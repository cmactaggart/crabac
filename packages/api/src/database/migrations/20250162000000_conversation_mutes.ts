import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('conversation_members', (t) => {
    t.boolean('muted').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('conversation_members', (t) => {
    t.dropColumn('muted');
  });
}
