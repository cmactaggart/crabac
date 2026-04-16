import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','follow_request','dm_request','event_cancelled','post_tag','post_comment','reaction','event_rsvp','event_organizer_needed','new_event','new_blog_post') NOT NULL`,
  );

  // Backfill: prior inserts with the unknown enum value were stored as empty strings.
  // The data payload for organizer-needed notifications uniquely carries an activityType field.
  await knex.raw(
    `UPDATE notifications SET type = 'event_organizer_needed'
     WHERE type = '' AND JSON_EXTRACT(data, '$.activityType') IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex('notifications')
    .where('type', 'event_organizer_needed')
    .delete();

  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM('mention','reply','portal_invite','friend_request','follow_request','dm_request','event_cancelled','post_tag','post_comment','reaction','event_rsvp','new_event','new_blog_post') NOT NULL`,
  );
}
