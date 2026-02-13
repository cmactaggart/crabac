import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_preferences', (t) => {
    t.bigInteger('user_id').primary();
    t.enum('distance_units', ['metric', 'imperial']).notNullable().defaultTo('imperial');

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_preferences');
}
