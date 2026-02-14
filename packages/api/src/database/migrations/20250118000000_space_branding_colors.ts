import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (t) => {
    t.string('base_color', 7).nullable().defaultTo(null);
    t.string('accent_color', 7).nullable().defaultTo(null);
    t.string('text_color', 7).nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('text_color');
    t.dropColumn('accent_color');
    t.dropColumn('base_color');
  });
}
