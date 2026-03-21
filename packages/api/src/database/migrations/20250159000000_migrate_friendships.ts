import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Migrate accepted friendships to mutual follows
  await knex.raw(`
    INSERT IGNORE INTO follows (id, follower_id, following_id, status, created_at)
    SELECT
      FLOOR(RAND() * 9223372036854775807),
      user_id,
      friend_id,
      'accepted',
      created_at
    FROM friendships
    WHERE status = 'accepted'
  `);

  await knex.raw(`
    INSERT IGNORE INTO follows (id, follower_id, following_id, status, created_at)
    SELECT
      FLOOR(RAND() * 9223372036854775807),
      friend_id,
      user_id,
      'accepted',
      created_at
    FROM friendships
    WHERE status = 'accepted'
  `);

  // Migrate pending friend requests as pending follows (sender follows recipient)
  await knex.raw(`
    INSERT IGNORE INTO follows (id, follower_id, following_id, status, created_at)
    SELECT
      FLOOR(RAND() * 9223372036854775807),
      user_id,
      friend_id,
      'pending',
      created_at
    FROM friendships
    WHERE status = 'pending'
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Cannot safely reverse this migration
}
