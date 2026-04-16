import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const ceHas = await knex.raw("SHOW COLUMNS FROM calendar_events LIKE 'organizer_id'");
  if (ceHas[0].length === 0) {
    await knex.schema.alterTable('calendar_events', (t) => {
      t.bigInteger('organizer_id').nullable().after('creator_id');
      t.boolean('organizer_needed').notNullable().defaultTo(false).after('organizer_id');
      t.foreign('organizer_id').references('id').inTable('users').onDelete('SET NULL');
      t.index(['space_id', 'organizer_needed', 'event_date'], 'calendar_events_needed_idx');
    });
    await knex('calendar_events').update({ organizer_id: knex.raw('creator_id') });
  }

  const esHas = await knex.raw("SHOW COLUMNS FROM event_series LIKE 'organizer_id'");
  if (esHas[0].length === 0) {
    await knex.schema.alterTable('event_series', (t) => {
      t.bigInteger('organizer_id').nullable().after('creator_id');
      t.boolean('organizer_needed').notNullable().defaultTo(false).after('organizer_id');
      t.foreign('organizer_id').references('id').inTable('users').onDelete('SET NULL');
    });
    await knex('event_series').update({ organizer_id: knex.raw('creator_id') });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (t) => {
    t.dropIndex([], 'calendar_events_needed_idx');
    t.dropForeign(['organizer_id']);
    t.dropColumn('organizer_needed');
    t.dropColumn('organizer_id');
  });
  await knex.schema.alterTable('event_series', (t) => {
    t.dropForeign(['organizer_id']);
    t.dropColumn('organizer_needed');
    t.dropColumn('organizer_id');
  });
}
