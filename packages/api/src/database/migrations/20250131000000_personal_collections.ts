import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Personal gallery items
  await knex.schema.createTable('personal_gallery_items', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.string('caption', 2000).nullable();
    table.enum('visibility', ['public', 'private', 'friends', 'spaces']).notNullable().defaultTo('private');
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'id']);
    table.index(['user_id', 'visibility']);
  });

  // Personal gallery attachments
  await knex.schema.createTable('personal_gallery_attachments', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('gallery_item_id').notNullable();
    table.string('filename', 255).notNullable();
    table.string('original_name', 255).notNullable();
    table.string('mime_type', 127).notNullable();
    table.integer('size').unsigned().notNullable();
    table.string('url', 512).notNullable();
    table.integer('position').defaultTo(0);

    table.foreign('gallery_item_id').references('personal_gallery_items.id').onDelete('CASCADE');
  });

  // Personal route items
  await knex.schema.createTable('personal_route_items', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.string('name', 200).notNullable();
    table.text('description').nullable();
    table.enum('visibility', ['public', 'private', 'friends', 'spaces']).notNullable().defaultTo('private');
    table.string('filename', 255).notNullable();
    table.string('original_name', 255).notNullable();
    table.integer('file_size').unsigned().notNullable();
    table.string('url', 512).notNullable();
    table.decimal('distance_km', 10, 3).nullable();
    table.integer('elevation_gain_m').nullable();
    table.integer('elevation_loss_m').nullable();
    table.decimal('flatness', 10, 2).nullable();
    table.integer('duration_sec').nullable();
    table.decimal('start_lat', 10, 7).nullable();
    table.decimal('start_lng', 11, 7).nullable();
    table.json('bounds').nullable();
    table.json('geojson').nullable();
    table.string('track_name', 255).nullable();
    table.enum('activity_type', ['ride', 'run', 'walk']).nullable();
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'id']);
    table.index(['user_id', 'visibility']);
  });

  // Personal events
  await knex.schema.createTable('personal_events', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.string('name', 200).notNullable();
    table.text('description').nullable();
    table.date('event_date').notNullable();
    table.time('event_time').nullable();
    table.string('location', 500).nullable();
    table.enum('visibility', ['public', 'private', 'friends', 'spaces']).notNullable().defaultTo('private');
    table.enum('activity_type', ['ride', 'run', 'walk']).nullable();
    table.bigInteger('route_id').nullable();
    table.string('color', 7).nullable();
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('route_id').references('personal_route_items.id').onDelete('SET NULL');
    table.index(['user_id', 'event_date']);
    table.index(['user_id', 'visibility']);
  });

  // Provenance tracking on existing tables
  await knex.schema.alterTable('gallery_items', (table) => {
    table.bigInteger('copied_from_personal_id').nullable();
    table.foreign('copied_from_personal_id').references('personal_gallery_items.id').onDelete('SET NULL');
  });

  await knex.schema.alterTable('route_items', (table) => {
    table.bigInteger('copied_from_personal_id').nullable();
    table.foreign('copied_from_personal_id').references('personal_route_items.id').onDelete('SET NULL');
  });

  await knex.schema.alterTable('calendar_events', (table) => {
    table.bigInteger('copied_from_personal_id').nullable();
    table.foreign('copied_from_personal_id').references('personal_events.id').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove provenance columns
  await knex.schema.alterTable('calendar_events', (table) => {
    table.dropForeign(['copied_from_personal_id']);
    table.dropColumn('copied_from_personal_id');
  });

  await knex.schema.alterTable('route_items', (table) => {
    table.dropForeign(['copied_from_personal_id']);
    table.dropColumn('copied_from_personal_id');
  });

  await knex.schema.alterTable('gallery_items', (table) => {
    table.dropForeign(['copied_from_personal_id']);
    table.dropColumn('copied_from_personal_id');
  });

  // Drop tables in reverse order (dependencies)
  await knex.schema.dropTableIfExists('personal_events');
  await knex.schema.dropTableIfExists('personal_route_items');
  await knex.schema.dropTableIfExists('personal_gallery_attachments');
  await knex.schema.dropTableIfExists('personal_gallery_items');
}
