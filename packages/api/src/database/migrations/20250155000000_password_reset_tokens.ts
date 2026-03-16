import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('user_id').notNullable();
    t.string('token_hash', 255).unique().notNullable();
    t.timestamp('expires_at').notNullable();
    t.boolean('used').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('password_reset_tokens');
}
