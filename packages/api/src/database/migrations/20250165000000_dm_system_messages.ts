import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('direct_messages', (table) => {
    table.enum('type', ['user', 'system']).notNullable().defaultTo('user').after('author_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('direct_messages', (table) => {
    table.dropColumn('type');
  });
}
