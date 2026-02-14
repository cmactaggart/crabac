import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add public space columns to space_settings
  await knex.schema.alterTable('space_settings', (t) => {
    t.boolean('is_public').notNullable().defaultTo(false);
    t.boolean('require_verified_email').notNullable().defaultTo(false);
    t.boolean('is_featured').notNullable().defaultTo(false);
  });

  // Add is_guest flag to roles
  await knex.schema.alterTable('roles', (t) => {
    t.boolean('is_guest').notNullable().defaultTo(false);
  });

  // Space tags (hybrid predefined + free-form)
  await knex.schema.createTable('space_tags', (t) => {
    t.bigInteger('space_id').notNullable();
    t.string('tag', 50).notNullable();
    t.string('tag_slug', 50).notNullable();

    t.primary(['space_id', 'tag_slug']);
    t.index(['tag_slug']);
    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
  });

  // Predefined tags managed by super admins
  await knex.schema.createTable('predefined_tags', (t) => {
    t.bigInteger('id').primary();
    t.string('name', 50).notNullable();
    t.string('slug', 50).notNullable().unique();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('predefined_tags');
  await knex.schema.dropTableIfExists('space_tags');
  await knex.schema.alterTable('roles', (t) => {
    t.dropColumn('is_guest');
  });
  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('is_featured');
    t.dropColumn('require_verified_email');
    t.dropColumn('is_public');
  });
}
