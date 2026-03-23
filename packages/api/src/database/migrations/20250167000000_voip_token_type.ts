import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('device_tokens', (table) => {
    table.string('token_type', 20).notNullable().defaultTo('standard');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('device_tokens', (table) => {
    table.dropColumn('token_type');
  });
}
