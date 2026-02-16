import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add 'route_library' to channels.type enum
  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum','media_gallery','route_library') NOT NULL DEFAULT 'text'"
  );

  // Add allow_public_routes to space_settings
  await knex.schema.alterTable('space_settings', (t) => {
    t.boolean('allow_public_routes').notNullable().defaultTo(false);
  });

  // Create route_categories table
  await knex.schema.createTable('route_categories', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.string('name', 100).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
    t.unique(['space_id', 'name']);
  });

  // Create route_items table
  await knex.schema.createTable('route_items', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('channel_id').notNullable();
    t.bigInteger('author_id').notNullable();
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.bigInteger('category_id').nullable();
    t.boolean('is_public').notNullable().defaultTo(false);
    t.string('filename', 255).notNullable();
    t.string('original_name', 255).notNullable();
    t.integer('file_size').unsigned().notNullable();
    t.string('url', 512).notNullable();
    t.decimal('distance_km', 10, 2).notNullable();
    t.integer('elevation_gain_m').nullable();
    t.integer('elevation_loss_m').nullable();
    t.decimal('flatness', 10, 2).nullable();
    t.integer('duration_sec').nullable();
    t.json('bounds').nullable();
    t.json('geojson').nullable();
    t.string('track_name', 255).nullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    t.foreign('author_id').references('id').inTable('users');
    t.foreign('category_id').references('id').inTable('route_categories').onDelete('SET NULL');
    t.index(['channel_id', 'id'], 'idx_route_items_channel');
  });

  // Create route_stars table
  await knex.schema.createTable('route_stars', (t) => {
    t.bigInteger('user_id').notNullable();
    t.bigInteger('route_id').notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.primary(['user_id', 'route_id']);
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('route_id').references('id').inTable('route_items').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('route_stars');
  await knex.schema.dropTableIfExists('route_items');
  await knex.schema.dropTableIfExists('route_categories');

  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('allow_public_routes');
  });

  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum','media_gallery') NOT NULL DEFAULT 'text'"
  );
}
