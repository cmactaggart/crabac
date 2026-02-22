import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (table) => {
    table.enum('default_visibility', ['public', 'private', 'friends', 'spaces'])
      .notNullable()
      .defaultTo('private');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_preferences', (table) => {
    table.dropColumn('default_visibility');
  });
}
