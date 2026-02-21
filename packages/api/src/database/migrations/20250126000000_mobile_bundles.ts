import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('mobile_bundles', (t) => {
    t.bigInteger('id').primary();
    t.enum('platform', ['ios', 'android']).notNullable();
    t.integer('bundle_version').unsigned().notNullable();
    t.string('native_version', 20).notNullable();
    t.string('file_path', 512).notNullable();
    t.string('checksum', 64).notNullable();
    t.bigInteger('file_size').unsigned().notNullable();
    t.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');
    t.boolean('is_required').notNullable().defaultTo(false);
    t.text('release_notes').nullable();
    t.bigInteger('created_by').notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('created_by').references('id').inTable('users');
    t.unique(['platform', 'bundle_version']);
    t.index(['platform', 'status', 'bundle_version'], 'idx_mobile_bundles_lookup');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mobile_bundles');
}
