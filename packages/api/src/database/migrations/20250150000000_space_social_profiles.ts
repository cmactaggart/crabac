import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add space_id and metadata to user_posts
  await knex.schema.alterTable('user_posts', (table) => {
    table.bigInteger('space_id').nullable().after('user_id');
    table.json('metadata').nullable().after('body');

    table
      .foreign('space_id')
      .references('id')
      .inTable('spaces')
      .onDelete('CASCADE');

    table.index(['space_id', 'id'], 'idx_user_posts_space_id_desc');
  });

  // Add social_enabled to space_settings
  await knex.schema.alterTable('space_settings', (table) => {
    table.boolean('social_enabled').defaultTo(false).after('newsletter_enabled');
  });

  // Add new_event to notifications type enum
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','reaction','portal_invite','friend_request','dm_request','event_cancelled','post_tag','post_comment','new_event') NOT NULL`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_posts', (table) => {
    table.dropForeign(['space_id']);
    table.dropIndex([], 'idx_user_posts_space_id_desc');
    table.dropColumn('space_id');
    table.dropColumn('metadata');
  });

  await knex.schema.alterTable('space_settings', (table) => {
    table.dropColumn('social_enabled');
  });

  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','dm_request','event_cancelled','post_tag','post_comment') NOT NULL`
  );
}
