import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add post_id to reports table
  await knex.schema.alterTable('reports', (table) => {
    table.bigInteger('post_id').nullable().after('forum_post_id');
    table.foreign('post_id').references('id').inTable('user_posts').onDelete('SET NULL');
  });

  // 2. Add is_pinned to user_posts table
  await knex.schema.alterTable('user_posts', (table) => {
    table.boolean('is_pinned').defaultTo(false).after('visibility');
    table.index(['user_id', 'is_pinned']);
  });

  // 3. Add bio to users table
  await knex.schema.alterTable('users', (table) => {
    table.string('bio', 255).nullable().after('display_name');
  });

  // 4. Create user_profile_links table
  await knex.schema.createTable('user_profile_links', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('label', 100).notNullable();
    table.string('url', 512).notNullable();
    table.integer('position').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_profile_links');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('bio');
  });

  await knex.schema.alterTable('user_posts', (table) => {
    table.dropIndex(['user_id', 'is_pinned']);
    table.dropColumn('is_pinned');
  });

  await knex.schema.alterTable('reports', (table) => {
    table.dropForeign(['post_id']);
    table.dropColumn('post_id');
  });
}
