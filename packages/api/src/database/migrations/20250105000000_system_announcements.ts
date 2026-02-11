import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('system_announcements', (t) => {
    t.bigInteger('id').primary();
    t.string('title', 255).notNullable();
    t.text('content').notNullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_announcements');
}
