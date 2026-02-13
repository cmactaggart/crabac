import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add calendar_enabled to space_settings
  await knex.schema.alterTable('space_settings', (t) => {
    t.boolean('calendar_enabled').notNullable().defaultTo(false);
  });

  // Calendar categories
  await knex.schema.createTable('calendar_categories', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.string('name', 100).notNullable();
    t.string('color', 7).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
  });

  // Calendar events
  await knex.schema.createTable('calendar_events', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.bigInteger('category_id').nullable();
    t.bigInteger('creator_id').notNullable();
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.date('event_date').notNullable();
    t.time('event_time').nullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
    t.foreign('category_id').references('id').inTable('calendar_categories').onDelete('SET NULL');
    t.foreign('creator_id').references('id').inTable('users').onDelete('CASCADE');

    t.index(['space_id', 'event_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('calendar_events');
  await knex.schema.dropTableIfExists('calendar_categories');
  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('calendar_enabled');
  });
}
