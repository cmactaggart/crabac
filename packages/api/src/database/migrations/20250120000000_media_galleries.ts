import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add 'media_gallery' to channels.type enum
  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum','media_gallery') NOT NULL DEFAULT 'text'"
  );

  // Add allow_public_galleries to space_settings
  await knex.schema.alterTable('space_settings', (t) => {
    t.boolean('allow_public_galleries').notNullable().defaultTo(false);
  });

  // Create gallery_items table
  await knex.schema.createTable('gallery_items', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('channel_id').notNullable();
    t.bigInteger('author_id').notNullable();
    t.string('caption', 2000).nullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    t.foreign('author_id').references('id').inTable('users');
    t.index(['channel_id', 'id'], 'idx_gallery_items_channel');
  });

  // Create gallery_item_attachments table
  await knex.schema.createTable('gallery_item_attachments', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('gallery_item_id').notNullable();
    t.string('filename', 255).notNullable();
    t.string('original_name', 255).notNullable();
    t.string('mime_type', 127).notNullable();
    t.integer('size').unsigned().notNullable();
    t.string('url', 512).notNullable();
    t.integer('position').notNullable().defaultTo(0);

    t.foreign('gallery_item_id').references('id').inTable('gallery_items').onDelete('CASCADE');
    t.index(['gallery_item_id', 'position'], 'idx_gallery_attachments_item');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gallery_item_attachments');
  await knex.schema.dropTableIfExists('gallery_items');

  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('allow_public_galleries');
  });

  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum') NOT NULL DEFAULT 'text'"
  );
}
