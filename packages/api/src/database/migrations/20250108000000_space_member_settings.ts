import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Space member settings (per-space user preferences)
  await knex.schema.createTable('space_member_settings', (table) => {
    table.bigInteger('space_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.boolean('suppress_mentions').notNullable().defaultTo(false);
    table.boolean('suppress_everyone').notNullable().defaultTo(false);
    table.boolean('mute_all').notNullable().defaultTo(false);
    table.primary(['space_id', 'user_id']);
    table.foreign('space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });

  // Track which announcements a user has dismissed
  await knex.schema.alterTable('users', (table) => {
    table.bigInteger('last_seen_announcement_id').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_seen_announcement_id');
  });
  await knex.schema.dropTableIfExists('space_member_settings');
}
