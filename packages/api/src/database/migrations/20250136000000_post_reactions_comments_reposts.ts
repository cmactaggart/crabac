import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Post reactions (mirrors message_reactions)
  await knex.schema.createTable('user_post_reactions', (t) => {
    t.bigInteger('post_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.string('emoji', 64).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.primary(['post_id', 'user_id', 'emoji']);
    t.foreign('post_id').references('id').inTable('user_posts').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // Post comments
  await knex.schema.createTable('user_post_comments', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('post_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.text('body').notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('post_id').references('id').inTable('user_posts').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.index(['post_id', 'id']);
  });

  // Comment reactions (mirrors message_reactions)
  await knex.schema.createTable('user_post_comment_reactions', (t) => {
    t.bigInteger('comment_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.string('emoji', 64).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.primary(['comment_id', 'user_id', 'emoji']);
    t.foreign('comment_id').references('id').inTable('user_post_comments').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // Repost column on user_posts
  await knex.schema.alterTable('user_posts', (t) => {
    t.bigInteger('repost_of_id').nullable();
    t.foreign('repost_of_id').references('id').inTable('user_posts').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user_posts', (t) => {
    t.dropForeign(['repost_of_id']);
    t.dropColumn('repost_of_id');
  });
  await knex.schema.dropTableIfExists('user_post_comment_reactions');
  await knex.schema.dropTableIfExists('user_post_comments');
  await knex.schema.dropTableIfExists('user_post_reactions');
}
