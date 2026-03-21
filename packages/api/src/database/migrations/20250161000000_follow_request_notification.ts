import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add follow_request to notification type enum
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','follow_request','dm_request','event_cancelled','post_tag','post_comment','reaction','event_rsvp','new_event','new_blog_post') NOT NULL`,
  );

  // Convert existing friend_request notifications to follow_request
  await knex('notifications')
    .where('type', 'friend_request')
    .update({ type: 'follow_request' });
}

export async function down(knex: Knex): Promise<void> {
  await knex('notifications')
    .where('type', 'follow_request')
    .update({ type: 'friend_request' });

  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','dm_request','event_cancelled','post_tag','post_comment','reaction','event_rsvp','new_event','new_blog_post') NOT NULL`,
  );
}
