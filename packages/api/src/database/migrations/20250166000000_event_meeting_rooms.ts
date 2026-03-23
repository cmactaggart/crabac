import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add end_time and meeting room fields to calendar_events (idempotent)
  const ceColumns = await knex.raw("SHOW COLUMNS FROM calendar_events LIKE 'end_time'");
  if (ceColumns[0].length === 0) {
    await knex.schema.alterTable('calendar_events', (t) => {
      t.time('end_time').nullable().after('event_time');
      t.boolean('meeting_room_enabled').notNullable().defaultTo(false).after('is_cancelled');
      t.integer('meeting_room_early_entry').nullable().after('meeting_room_enabled');
    });
  }

  // Add same fields to event_series (idempotent)
  const esColumns = await knex.raw("SHOW COLUMNS FROM event_series LIKE 'end_time'");
  if (esColumns[0].length === 0) {
    await knex.schema.alterTable('event_series', (t) => {
      t.time('end_time').nullable().after('event_time');
      t.boolean('meeting_room_enabled').notNullable().defaultTo(false).after('is_public');
      t.integer('meeting_room_early_entry').nullable().after('meeting_room_enabled');
    });
  }

  // Create event_meeting_rooms table
  const tableExists = await knex.schema.hasTable('event_meeting_rooms');
  if (!tableExists) {
    await knex.schema.createTable('event_meeting_rooms', (t) => {
      t.bigInteger('event_id').primary();
      t.bigInteger('call_id').nullable();
      t.bigInteger('channel_id').nullable();
      t.enum('status', ['pending', 'open', 'active', 'closed']).notNullable().defaultTo('pending');
      t.timestamp('opened_at', { precision: 3 }).nullable();
      t.timestamp('closed_at', { precision: 3 }).nullable();

      t.foreign('event_id').references('id').inTable('calendar_events').onDelete('CASCADE');
      t.foreign('call_id').references('id').inTable('calls').onDelete('SET NULL');
      t.foreign('channel_id').references('id').inTable('channels').onDelete('SET NULL');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_meeting_rooms');

  await knex.schema.alterTable('event_series', (t) => {
    t.dropColumn('meeting_room_early_entry');
    t.dropColumn('meeting_room_enabled');
    t.dropColumn('end_time');
  });

  await knex.schema.alterTable('calendar_events', (t) => {
    t.dropColumn('meeting_room_early_entry');
    t.dropColumn('meeting_room_enabled');
    t.dropColumn('end_time');
  });
}
