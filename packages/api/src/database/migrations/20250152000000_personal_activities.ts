import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create personal_activity_items table
  await knex.schema.createTable('personal_activity_items', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.enum('activity_type', ['run', 'bike', 'walk', 'hike']).notNullable();
    table.enum('visibility', ['public', 'private', 'friends', 'spaces']).notNullable().defaultTo('private');
    table.decimal('distance_km', 10, 3).nullable();
    table.integer('duration_sec').nullable();
    table.decimal('elevation_gain_m', 10, 2).nullable();
    table.decimal('elevation_loss_m', 10, 2).nullable();
    table.json('geojson').nullable();
    table.json('bounds').nullable();
    table.decimal('start_lat', 11, 8).nullable();
    table.decimal('start_lng', 11, 8).nullable();
    table.datetime('started_at').nullable();
    table.string('filename', 500).nullable();
    table.string('original_name', 500).nullable();
    table.integer('file_size').nullable();
    table.string('url', 500).nullable();
    table.string('track_name', 500).nullable();
    table.decimal('flatness', 10, 2).nullable();
    table.bigInteger('user_post_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now(3));
    table.timestamp('updated_at').defaultTo(knex.fn.now(3));

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('user_post_id').references('id').inTable('user_posts').onDelete('SET NULL');
    table.index(['user_id', 'visibility']);
    table.index(['user_id', 'activity_type']);
  });

  // Add personal_activity_item_id to user_post_attachments
  await knex.schema.alterTable('user_post_attachments', (table) => {
    table.bigInteger('personal_activity_item_id').nullable().after('personal_route_item_id');
    table.foreign('personal_activity_item_id').references('id').inTable('personal_activity_items').onDelete('SET NULL');
  });

  // Add activities_visibility to user_preferences
  await knex.schema.alterTable('user_preferences', (table) => {
    table.enum('activities_visibility', ['public', 'private', 'friends', 'spaces']).nullable().after('profile_visibility');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (table) => {
    table.dropColumn('activities_visibility');
  });

  await knex.schema.alterTable('user_post_attachments', (table) => {
    table.dropForeign(['personal_activity_item_id']);
    table.dropColumn('personal_activity_item_id');
  });

  await knex.schema.dropTableIfExists('personal_activity_items');
}
