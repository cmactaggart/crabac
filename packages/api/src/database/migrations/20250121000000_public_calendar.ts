import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (table) => {
    table.boolean('is_public').defaultTo(false).notNullable();
  });

  await knex.schema.alterTable('space_settings', (table) => {
    table.boolean('allow_public_calendar').defaultTo(false).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (table) => {
    table.dropColumn('is_public');
  });

  await knex.schema.alterTable('space_settings', (table) => {
    table.dropColumn('allow_public_calendar');
  });
}
