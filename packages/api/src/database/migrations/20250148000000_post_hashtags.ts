import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_post_hashtags');
  await knex.schema.createTable('user_post_hashtags', (table) => {
    table.bigInteger('post_id').notNullable();
    table.string('hashtag', 100).notNullable();
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.primary(['post_id', 'hashtag']);
    table.index('hashtag');
    table.index('created_at');

    table
      .foreign('post_id')
      .references('id')
      .inTable('user_posts')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_post_hashtags');
}
