import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add meeting room fields to personal_events (end_time already exists)
  const hasCol = await knex.schema.hasColumn('personal_events', 'meeting_room_enabled');
  if (!hasCol) {
    await knex.schema.alterTable('personal_events', (table) => {
      table.boolean('meeting_room_enabled').notNullable().defaultTo(false);
      table.integer('meeting_room_early_entry').notNullable().defaultTo(0);
    });
  }

  // Add personal_event_id to event_meeting_rooms if not already present
  const hasPersonalCol = await knex.schema.hasColumn('event_meeting_rooms', 'personal_event_id');
  if (!hasPersonalCol) {
    await knex.schema.alterTable('event_meeting_rooms', (table) => {
      table.bigInteger('personal_event_id').nullable().references('id').inTable('personal_events').onDelete('CASCADE');
    });
  }

  // Restructure PK: event_id is currently the PK but we need to support rows
  // where event_id is null (personal events). Add an auto-increment id as PK.
  await knex.raw('ALTER TABLE `event_meeting_rooms` DROP PRIMARY KEY');
  await knex.raw('ALTER TABLE `event_meeting_rooms` ADD `id` bigint NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
  await knex.raw('ALTER TABLE `event_meeting_rooms` ADD UNIQUE INDEX `idx_emr_event_id` (`event_id`)');
  await knex.raw('ALTER TABLE `event_meeting_rooms` ADD UNIQUE INDEX `idx_emr_personal_event_id` (`personal_event_id`)');
  await knex.raw('ALTER TABLE `event_meeting_rooms` MODIFY `event_id` bigint NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE `event_meeting_rooms` MODIFY `event_id` bigint NOT NULL');
  await knex.raw('ALTER TABLE `event_meeting_rooms` DROP INDEX `idx_emr_personal_event_id`');
  await knex.raw('ALTER TABLE `event_meeting_rooms` DROP INDEX `idx_emr_event_id`');
  await knex.raw('ALTER TABLE `event_meeting_rooms` DROP COLUMN `id`');
  await knex.raw('ALTER TABLE `event_meeting_rooms` ADD PRIMARY KEY (`event_id`)');
  await knex.schema.alterTable('event_meeting_rooms', (table) => {
    table.dropColumn('personal_event_id');
  });
  await knex.schema.alterTable('personal_events', (table) => {
    table.dropColumn('meeting_room_enabled');
    table.dropColumn('meeting_room_early_entry');
  });
}
