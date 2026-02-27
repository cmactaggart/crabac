import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (t) => {
    t.boolean('newsletter_enabled').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (t) => {
    t.dropColumn('newsletter_enabled');
  });
}
