import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('event_series', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable().references('id').inTable('spaces').onDelete('CASCADE');
    t.bigInteger('creator_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('category_id').nullable().references('id').inTable('calendar_categories').onDelete('SET NULL');
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.string('location', 500).nullable();
    t.enum('activity_type', ['ride', 'run', 'walk']).nullable();
    t.bigInteger('route_id').nullable().references('id').inTable('route_items').onDelete('SET NULL');
    t.boolean('is_public').notNullable().defaultTo(false);
    t.json('recurrence_rule').notNullable();
    t.string('event_time', 5).nullable();
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('calendar_events', (t) => {
    t.bigInteger('series_id').nullable().references('id').inTable('event_series').onDelete('CASCADE');
    t.boolean('is_override').notNullable().defaultTo(false);
    t.boolean('is_cancelled').notNullable().defaultTo(false);
  });

  // Update notifications type enum to include event_cancelled
  await knex.raw(`ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','dm_request','event_cancelled') NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','dm_request') NOT NULL`);

  await knex.schema.alterTable('calendar_events', (t) => {
    t.dropForeign(['series_id']);
    t.dropColumn('series_id');
    t.dropColumn('is_override');
    t.dropColumn('is_cancelled');
  });

  await knex.schema.dropTableIfExists('event_series');
}
