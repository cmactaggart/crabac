import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Space settings for public boards
  await knex.schema.createTable('space_settings', (t) => {
    t.bigInteger('space_id').primary();
    t.boolean('allow_public_boards').notNullable().defaultTo(false);
    t.boolean('allow_anonymous_browsing').notNullable().defaultTo(false);

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
  });

  // Add account_type to users
  await knex.schema.alterTable('users', (t) => {
    t.enum('account_type', ['full', 'board']).notNullable().defaultTo('full');
  });

  // Board registrations (which spaces a board user is registered for)
  await knex.schema.createTable('board_registrations', (t) => {
    t.bigInteger('user_id').notNullable();
    t.bigInteger('space_id').notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.primary(['user_id', 'space_id']);
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_registrations');
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('account_type');
  });
  await knex.schema.dropTableIfExists('space_settings');
}
