import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Personal event categories
  await knex.schema.createTable('personal_event_categories', (t) => {
    t.bigint('id').primary();
    t.bigint('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('name', 100).notNullable();
    t.string('color', 7).notNullable().defaultTo('#5865f2');
    t.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    t.index(['user_id']);
  });

  // Add category_id to personal_events
  await knex.schema.alterTable('personal_events', (t) => {
    t.bigint('category_id')
      .nullable()
      .references('id')
      .inTable('personal_event_categories')
      .onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('personal_events', (t) => {
    t.dropForeign(['category_id']);
    t.dropColumn('category_id');
  });
  await knex.schema.dropTableIfExists('personal_event_categories');
}
