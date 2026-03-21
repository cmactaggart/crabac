import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add status column to follows table
  await knex.schema.alterTable('follows', (t) => {
    t.enum('status', ['pending', 'accepted']).notNullable().defaultTo('accepted');
  });
  await knex.raw('ALTER TABLE follows ADD INDEX idx_follows_following_status (following_id, status)');
  await knex.raw('ALTER TABLE follows ADD INDEX idx_follows_follower_status (follower_id, status)');

  // Add new preference columns to user_preferences
  await knex.schema.alterTable('user_preferences', (t) => {
    t.enum('follow_request_policy', ['accept_all', 'accept_mutual_spaces', 'require_approval'])
      .notNullable()
      .defaultTo('accept_all');
    t.enum('msg_privacy_all', ['accept_all', 'require_approval', 'dont_allow'])
      .notNullable()
      .defaultTo('require_approval');
    t.enum('msg_privacy_followed', ['accept_all', 'require_approval', 'dont_allow'])
      .notNullable()
      .defaultTo('accept_all');
    t.enum('msg_privacy_spaces', ['accept_all', 'require_approval', 'dont_allow'])
      .notNullable()
      .defaultTo('accept_all');
    t.enum('msg_privacy_group_dm', ['accept_all', 'require_approval', 'dont_allow'])
      .notNullable()
      .defaultTo('accept_all');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (t) => {
    t.dropColumn('follow_request_policy');
    t.dropColumn('msg_privacy_all');
    t.dropColumn('msg_privacy_followed');
    t.dropColumn('msg_privacy_spaces');
    t.dropColumn('msg_privacy_group_dm');
  });

  await knex.raw('ALTER TABLE follows DROP INDEX idx_follows_following_status');
  await knex.raw('ALTER TABLE follows DROP INDEX idx_follows_follower_status');

  await knex.schema.alterTable('follows', (t) => {
    t.dropColumn('status');
  });
}
