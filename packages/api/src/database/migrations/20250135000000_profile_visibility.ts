import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (table) => {
    table.enum('profile_visibility', ['public', 'private', 'friends', 'spaces'])
      .notNullable()
      .defaultTo('spaces');
    table.boolean('onboarding_completed')
      .notNullable()
      .defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (table) => {
    table.dropColumn('profile_visibility');
    table.dropColumn('onboarding_completed');
  });
}
