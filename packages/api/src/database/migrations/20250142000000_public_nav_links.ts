import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (t) => {
    t.text('public_nav_links').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('public_nav_links');
  });
}
