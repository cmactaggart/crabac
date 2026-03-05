import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_post_comments', (table) => {
    table.bigInteger('space_id').nullable().after('user_id');
    table.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_post_comments', (table) => {
    table.dropForeign(['space_id']);
    table.dropColumn('space_id');
  });
}
