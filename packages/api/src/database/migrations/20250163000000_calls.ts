import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('calls', (table) => {
    table.bigInteger('id').unsigned().primary();
    // 'dm' = 1:1 or group DM call, 'voice_channel' = persistent space voice channel
    table.enum('type', ['dm', 'voice_channel']).notNullable();
    // For DM calls: links to conversations table
    table.bigInteger('conversation_id').unsigned().nullable();
    // For voice channel calls: links to channels table
    table.bigInteger('channel_id').unsigned().nullable();
    table.bigInteger('space_id').unsigned().nullable();
    // LiveKit room name (unique per active call)
    table.string('room_name', 255).notNullable().unique();
    table.bigInteger('initiated_by').unsigned().notNullable();
    table.enum('status', ['ringing', 'active', 'ended']).notNullable().defaultTo('ringing');
    table.timestamp('started_at', { precision: 3 }).nullable();
    table.timestamp('ended_at', { precision: 3 }).nullable();
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.index('conversation_id');
    table.index('channel_id');
    table.index('status');
  });

  await knex.schema.createTable('call_participants', (table) => {
    table.bigInteger('call_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable();
    table.enum('status', ['ringing', 'joined', 'declined', 'left', 'missed']).notNullable().defaultTo('ringing');
    table.timestamp('joined_at', { precision: 3 }).nullable();
    table.timestamp('left_at', { precision: 3 }).nullable();
    table.primary(['call_id', 'user_id']);

    table.foreign('call_id').references('calls.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('call_participants');
  await knex.schema.dropTableIfExists('calls');
}
