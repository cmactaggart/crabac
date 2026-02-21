import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('reports', (table) => {
    table.bigInteger('gallery_item_id').nullable().defaultTo(null);
    table.bigInteger('route_id').nullable().defaultTo(null);
    table.bigInteger('forum_post_id').nullable().defaultTo(null);
    table.string('content_type', 20).nullable().defaultTo(null);

    table.foreign('gallery_item_id').references('gallery_items.id').onDelete('SET NULL');
    table.foreign('route_id').references('route_items.id').onDelete('SET NULL');
    table.foreign('forum_post_id').references('messages.id').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('reports', (table) => {
    table.dropForeign(['gallery_item_id']);
    table.dropForeign(['route_id']);
    table.dropForeign(['forum_post_id']);
    table.dropColumn('gallery_item_id');
    table.dropColumn('route_id');
    table.dropColumn('forum_post_id');
    table.dropColumn('content_type');
  });
}
