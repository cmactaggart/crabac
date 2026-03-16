import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.alterTable('channels', (t) => {
    t.string('display_name', 100).nullable().after('name');
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('channels', (t) => {
    t.dropColumn('display_name');
  });
}
