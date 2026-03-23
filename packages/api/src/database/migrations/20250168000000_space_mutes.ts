import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('space_mutes', (table) => {
    table.bigInteger('space_id').notNullable().references('id').inTable('spaces').onDelete('CASCADE');
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.primary(['space_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('space_mutes');
}
