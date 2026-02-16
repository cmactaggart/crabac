import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // route_items: add start coordinates, activity type
  await knex.schema.alterTable('route_items', (t) => {
    t.decimal('start_lat', 10, 7).nullable();
    t.decimal('start_lng', 10, 7).nullable();
    t.enum('activity_type', ['ride', 'run', 'walk']).nullable();
  });

  // calendar_events: add location, activity type, route link
  await knex.schema.alterTable('calendar_events', (t) => {
    t.string('location', 500).nullable();
    t.enum('activity_type', ['ride', 'run', 'walk']).nullable();
    t.bigInteger('route_id').nullable();
    t.foreign('route_id').references('id').inTable('route_items').onDelete('SET NULL');
  });

  // event_rsvps table
  await knex.schema.createTable('event_rsvps', (t) => {
    t.bigInteger('event_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.enum('status', ['going', 'maybe', 'not_going']).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.primary(['event_id', 'user_id']);
    t.foreign('event_id').references('id').inTable('calendar_events').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_rsvps');

  await knex.schema.alterTable('calendar_events', (t) => {
    t.dropForeign(['route_id']);
    t.dropColumn('route_id');
    t.dropColumn('activity_type');
    t.dropColumn('location');
  });

  await knex.schema.alterTable('route_items', (t) => {
    t.dropColumn('activity_type');
    t.dropColumn('start_lng');
    t.dropColumn('start_lat');
  });
}
