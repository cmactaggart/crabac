import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_bot').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_bot');
  });
}
