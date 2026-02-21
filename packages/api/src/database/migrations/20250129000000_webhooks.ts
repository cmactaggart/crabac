import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add webhook settings to space_settings
  await knex.schema.alterTable('space_settings', (table) => {
    table.boolean('webhooks_enabled').defaultTo(false);
    table.string('webhook_secret', 64).nullable();
  });

  // Add 'webhook' to workflows.trigger_type enum
  await knex.raw(`ALTER TABLE workflows MODIFY COLUMN trigger_type ENUM(
    'member_joined', 'message_created', 'image_uploaded',
    'gpx_uploaded', 'slash_command', 'card_interaction', 'webhook'
  ) NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
  // Remove webhook workflows first
  await knex('workflows').where('trigger_type', 'webhook').delete();

  // Revert enum
  await knex.raw(`ALTER TABLE workflows MODIFY COLUMN trigger_type ENUM(
    'member_joined', 'message_created', 'image_uploaded',
    'gpx_uploaded', 'slash_command', 'card_interaction'
  ) NOT NULL`);

  // Drop webhook columns from space_settings
  await knex.schema.alterTable('space_settings', (table) => {
    table.dropColumn('webhooks_enabled');
    table.dropColumn('webhook_secret');
  });
}
