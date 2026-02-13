import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (t) => {
    t.json('metadata').nullable().after('url');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (t) => {
    t.dropColumn('metadata');
  });
}
