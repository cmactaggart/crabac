import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_member_settings', (table) => {
    table.boolean('mute_blog').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_member_settings', (table) => {
    table.dropColumn('mute_blog');
  });
}
