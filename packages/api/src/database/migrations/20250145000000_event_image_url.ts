import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (table) => {
    table.string('image_url', 512).nullable().after('route_id');
  });
  await knex.schema.alterTable('event_series', (table) => {
    table.string('image_url', 512).nullable().after('route_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (table) => {
    table.dropColumn('image_url');
  });
  await knex.schema.alterTable('event_series', (table) => {
    table.dropColumn('image_url');
  });
}
