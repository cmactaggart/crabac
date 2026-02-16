import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('blog_posts', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable().references('id').inTable('spaces').onDelete('CASCADE');
    t.bigInteger('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('title', 500).notNullable();
    t.string('summary', 140).nullable();
    t.text('content').notNullable();
    t.enum('status', ['draft', 'published']).notNullable().defaultTo('draft');
    t.boolean('is_public').notNullable().defaultTo(false);
    t.timestamp('published_at', { useTz: false }).nullable();
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());

    t.index(['space_id', 'status', 'published_at']);
    t.index(['space_id', 'is_public', 'published_at']);
  });

  await knex.schema.alterTable('space_settings', (t) => {
    t.boolean('blog_enabled').notNullable().defaultTo(false);
    t.boolean('allow_public_blog').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('blog_enabled');
    t.dropColumn('allow_public_blog');
  });

  await knex.schema.dropTableIfExists('blog_posts');
}
