import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 255).unique().notNullable();
    t.timestamp('expires_at').notNullable();
    t.boolean('used').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('password_reset_tokens');
}
