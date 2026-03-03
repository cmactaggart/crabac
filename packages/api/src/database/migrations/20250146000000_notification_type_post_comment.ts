import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add post_tag and post_comment to notifications type enum
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','dm_request','event_cancelled','post_tag','post_comment') NOT NULL`
  );

  // Fix existing notifications that were silently stored as '' due to missing enum values.
  // We can identify them by their data contents.
  await knex.raw(
    `UPDATE notifications SET type = 'post_comment' WHERE type = '' AND JSON_EXTRACT(data, '$.commentId') IS NOT NULL`
  );
  await knex.raw(
    `UPDATE notifications SET type = 'post_tag' WHERE type = '' AND JSON_EXTRACT(data, '$.taggedByUserId') IS NOT NULL`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','dm_request','event_cancelled') NOT NULL`
  );
}
