import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_post_comments', (table) => {
    table.bigInteger('parent_comment_id').nullable().after('post_id');
    table.index('parent_comment_id');

    table
      .foreign('parent_comment_id')
      .references('id')
      .inTable('user_post_comments')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_post_comments', (table) => {
    table.dropForeign(['parent_comment_id']);
    table.dropColumn('parent_comment_id');
  });
}
