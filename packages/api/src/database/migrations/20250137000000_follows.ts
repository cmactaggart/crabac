import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('follows', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('follower_id').notNullable();
    t.bigInteger('following_id').notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('follower_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('following_id').references('id').inTable('users').onDelete('CASCADE');
    t.unique(['follower_id', 'following_id']);
    t.index(['follower_id']);
    t.index(['following_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('follows');
}
