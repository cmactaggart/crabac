import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // User posts
  await knex.schema.createTable('user_posts', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.text('body').nullable();
    table.enum('visibility', ['public', 'private', 'friends', 'spaces']).notNullable().defaultTo('private');
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'id']);
    table.index(['user_id', 'visibility']);
  });

  // Post attachments (images, videos, GPX files)
  await knex.schema.createTable('user_post_attachments', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('post_id').notNullable();
    table.enum('type', ['image', 'video', 'gpx']).notNullable();
    table.string('filename', 255).notNullable();
    table.string('original_name', 255).notNullable();
    table.string('mime_type', 127).notNullable();
    table.integer('size').unsigned().notNullable();
    table.string('url', 512).notNullable();
    table.integer('position').defaultTo(0);
    table.bigInteger('personal_gallery_item_id').nullable();
    table.bigInteger('personal_route_item_id').nullable();

    table.foreign('post_id').references('user_posts.id').onDelete('CASCADE');
    table.foreign('personal_gallery_item_id').references('personal_gallery_items.id').onDelete('SET NULL');
    table.foreign('personal_route_item_id').references('personal_route_items.id').onDelete('SET NULL');
  });

  // Friend tags on posts
  await knex.schema.createTable('user_post_tags', (table) => {
    table.bigInteger('post_id').notNullable();
    table.bigInteger('tagged_user_id').notNullable();
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.primary(['post_id', 'tagged_user_id']);
    table.foreign('post_id').references('user_posts.id').onDelete('CASCADE');
    table.foreign('tagged_user_id').references('users.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_post_tags');
  await knex.schema.dropTableIfExists('user_post_attachments');
  await knex.schema.dropTableIfExists('user_posts');
}
