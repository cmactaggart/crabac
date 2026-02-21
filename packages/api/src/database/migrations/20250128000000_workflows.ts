import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Workflows
  await knex.schema.createTable('workflows', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('space_id').notNullable();
    table.string('name', 200).notNullable();
    table.text('description').nullable();
    table.enum('trigger_type', [
      'member_joined', 'message_created', 'image_uploaded',
      'gpx_uploaded', 'slash_command', 'card_interaction',
    ]).notNullable();
    table.json('trigger_config').nullable();
    table.json('conditions').nullable();
    table.json('actions').notNullable();
    table.boolean('enabled').defaultTo(true);
    table.bigInteger('created_by').notNullable();
    table.timestamp('created_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('updated_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.foreign('space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('created_by').references('users.id').onDelete('CASCADE');
    table.index(['space_id', 'trigger_type', 'enabled']);
  });

  // Custom Slash Commands
  await knex.schema.createTable('workflow_custom_commands', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('space_id').notNullable();
    table.string('name', 32).notNullable();
    table.string('description', 200).notNullable();
    table.json('args').nullable();
    table.bigInteger('created_by').notNullable();
    table.timestamp('created_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.foreign('space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('created_by').references('users.id').onDelete('CASCADE');
    table.unique(['space_id', 'name']);
  });

  // Card Templates
  await knex.schema.createTable('workflow_card_templates', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('space_id').notNullable();
    table.string('name', 200).notNullable();
    table.string('title_template', 500).notNullable();
    table.text('body_template').nullable();
    table.string('color', 7).nullable();
    table.json('fields').nullable();
    table.json('buttons').nullable();
    table.bigInteger('created_by').notNullable();
    table.timestamp('created_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.foreign('space_id').references('spaces.id').onDelete('CASCADE');
    table.foreign('created_by').references('users.id').onDelete('CASCADE');
    table.index(['space_id']);
  });

  // Card Instances
  await knex.schema.createTable('workflow_card_instances', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('template_id').notNullable();
    table.bigInteger('channel_id').notNullable();
    table.bigInteger('message_id').nullable();
    table.json('context').nullable();
    table.json('state').nullable();
    table.enum('status', ['active', 'dismissed', 'expired']).defaultTo('active');
    table.bigInteger('interacted_by').nullable();
    table.timestamp('interacted_at', { useTz: false, precision: 3 }).nullable();
    table.timestamp('created_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('updated_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.foreign('template_id').references('workflow_card_templates.id').onDelete('CASCADE');
    table.foreign('channel_id').references('channels.id').onDelete('CASCADE');
    table.foreign('message_id').references('messages.id').onDelete('SET NULL');
    table.foreign('interacted_by').references('users.id').onDelete('SET NULL');
    table.index(['channel_id', 'status']);
    table.index(['message_id']);
  });

  // Execution Logs
  await knex.schema.createTable('workflow_executions', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('workflow_id').notNullable();
    table.bigInteger('space_id').notNullable();
    table.bigInteger('trigger_user_id').nullable();
    table.string('trigger_type', 50).notNullable();
    table.json('trigger_data').nullable();
    table.enum('status', ['success', 'partial', 'error', 'skipped']).notNullable();
    table.tinyint('actions_run').unsigned().defaultTo(0);
    table.tinyint('actions_total').unsigned().defaultTo(0);
    table.text('error_message').nullable();
    table.timestamp('started_at', { useTz: false, precision: 3 }).defaultTo(knex.fn.now(3));
    table.timestamp('finished_at', { useTz: false, precision: 3 }).nullable();
    table.integer('duration_ms').unsigned().nullable();
    table.foreign('workflow_id').references('workflows.id').onDelete('CASCADE');
    table.index(['workflow_id', 'started_at']);
    table.index(['space_id', 'started_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workflow_executions');
  await knex.schema.dropTableIfExists('workflow_card_instances');
  await knex.schema.dropTableIfExists('workflow_card_templates');
  await knex.schema.dropTableIfExists('workflow_custom_commands');
  await knex.schema.dropTableIfExists('workflows');
}
