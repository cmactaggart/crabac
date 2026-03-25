import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // A) Add allow_public_voice to space_settings
  const ssCol = await knex.raw("SHOW COLUMNS FROM space_settings LIKE 'allow_public_voice'");
  if (ssCol[0].length === 0) {
    await knex.schema.alterTable('space_settings', (t) => {
      t.boolean('allow_public_voice').notNullable().defaultTo(false).after('allow_public_blog');
    });
  }

  // B) Add meeting public access fields to calendar_events
  const ceCol = await knex.raw("SHOW COLUMNS FROM calendar_events LIKE 'meeting_public_access'");
  if (ceCol[0].length === 0) {
    await knex.schema.alterTable('calendar_events', (t) => {
      t.boolean('meeting_public_access').notNullable().defaultTo(false).after('meeting_room_early_entry');
      t.boolean('meeting_public_chat').notNullable().defaultTo(false).after('meeting_public_access');
      t.boolean('meeting_public_participation').notNullable().defaultTo(false).after('meeting_public_chat');
      t.string('meeting_room_password', 255).nullable().after('meeting_public_participation');
      t.enum('meeting_identity_mode', ['anonymous', 'email_verify', 'require_login'])
        .notNullable().defaultTo('anonymous').after('meeting_room_password');
    });
  }

  // C) Add same fields to event_series
  const esCol = await knex.raw("SHOW COLUMNS FROM event_series LIKE 'meeting_public_access'");
  if (esCol[0].length === 0) {
    await knex.schema.alterTable('event_series', (t) => {
      t.boolean('meeting_public_access').notNullable().defaultTo(false).after('meeting_room_early_entry');
      t.boolean('meeting_public_chat').notNullable().defaultTo(false).after('meeting_public_access');
      t.boolean('meeting_public_participation').notNullable().defaultTo(false).after('meeting_public_chat');
      t.string('meeting_room_password', 255).nullable().after('meeting_public_participation');
      t.enum('meeting_identity_mode', ['anonymous', 'email_verify', 'require_login'])
        .notNullable().defaultTo('anonymous').after('meeting_room_password');
    });
  }

  // D) Add voice public access fields to channels
  const chCol = await knex.raw("SHOW COLUMNS FROM channels LIKE 'public_voice_access'");
  if (chCol[0].length === 0) {
    await knex.schema.alterTable('channels', (t) => {
      t.boolean('public_voice_access').notNullable().defaultTo(false);
      t.boolean('public_voice_chat').notNullable().defaultTo(false);
      t.boolean('public_voice_participation').notNullable().defaultTo(false);
      t.string('voice_password', 255).nullable();
      t.enum('voice_identity_mode', ['anonymous', 'email_verify', 'require_login'])
        .notNullable().defaultTo('anonymous');
    });
  }

  // E) Create meeting_room_guests table
  if (!(await knex.schema.hasTable('meeting_room_guests'))) {
    await knex.schema.createTable('meeting_room_guests', (t) => {
      t.bigInteger('id').primary();
      t.bigInteger('event_id').nullable();
      t.bigInteger('channel_id').nullable();
      t.string('session_token', 64).notNullable().unique();
      t.string('display_name', 100).notNullable();
      t.string('email', 255).nullable();
      t.boolean('email_verified').notNullable().defaultTo(false);
      t.bigInteger('user_id').nullable();
      t.string('livekit_identity', 100).notNullable();
      t.enum('status', ['active', 'left', 'kicked']).notNullable().defaultTo('active');
      t.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));
      t.timestamp('left_at', { precision: 3 }).nullable();

      t.foreign('event_id').references('id').inTable('calendar_events').onDelete('CASCADE');
      t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
      t.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');

      t.index('event_id');
      t.index('channel_id');
      t.index('session_token');
    });
  }

  // F) Create meeting_invites table
  if (!(await knex.schema.hasTable('meeting_invites'))) {
    await knex.schema.createTable('meeting_invites', (t) => {
      t.bigInteger('id').primary();
      t.bigInteger('event_id').nullable();
      t.bigInteger('channel_id').nullable();
      t.string('token', 64).notNullable().unique();
      t.string('email', 255).nullable();
      t.bigInteger('created_by').notNullable();
      t.integer('max_uses').nullable();
      t.integer('use_count').notNullable().defaultTo(0);
      t.timestamp('expires_at').nullable();
      t.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

      t.foreign('event_id').references('id').inTable('calendar_events').onDelete('CASCADE');
      t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
      t.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');

      t.index('event_id');
      t.index('channel_id');
      t.index('token');
    });
  }

  // G) Create meeting_email_verifications table
  if (!(await knex.schema.hasTable('meeting_email_verifications'))) {
    await knex.schema.createTable('meeting_email_verifications', (t) => {
      t.bigInteger('id').primary();
      t.bigInteger('event_id').nullable();
      t.bigInteger('channel_id').nullable();
      t.string('email', 255).notNullable();
      t.string('display_name', 100).notNullable();
      t.string('token', 64).notNullable().unique();
      t.boolean('verified').notNullable().defaultTo(false);
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

      t.index('token');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('meeting_email_verifications');
  await knex.schema.dropTableIfExists('meeting_invites');
  await knex.schema.dropTableIfExists('meeting_room_guests');

  await knex.schema.alterTable('channels', (t) => {
    t.dropColumn('voice_identity_mode');
    t.dropColumn('voice_password');
    t.dropColumn('public_voice_participation');
    t.dropColumn('public_voice_chat');
    t.dropColumn('public_voice_access');
  });

  await knex.schema.alterTable('event_series', (t) => {
    t.dropColumn('meeting_identity_mode');
    t.dropColumn('meeting_room_password');
    t.dropColumn('meeting_public_participation');
    t.dropColumn('meeting_public_chat');
    t.dropColumn('meeting_public_access');
  });

  await knex.schema.alterTable('calendar_events', (t) => {
    t.dropColumn('meeting_identity_mode');
    t.dropColumn('meeting_room_password');
    t.dropColumn('meeting_public_participation');
    t.dropColumn('meeting_public_chat');
    t.dropColumn('meeting_public_access');
  });

  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('allow_public_voice');
  });
}
