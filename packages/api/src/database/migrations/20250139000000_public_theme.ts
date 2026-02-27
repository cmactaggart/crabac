import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (table) => {
    table.string('public_theme', 50).nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (table) => {
    table.dropColumn('public_theme');
  });
}
