import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users
  await knex.schema.createTable('users', (t) => {
    t.bigInteger('id').primary();
    t.string('email', 255).notNullable().unique();
    t.string('username', 32).notNullable().unique();
    t.string('display_name', 64).notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('avatar_url', 512).nullable();
    t.enum('status', ['online', 'idle', 'dnd', 'offline']).defaultTo('offline');
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  // Spaces
  await knex.schema.createTable('spaces', (t) => {
    t.bigInteger('id').primary();
    t.string('name', 100).notNullable();
    t.string('slug', 100).notNullable().unique();
    t.text('description').nullable();
    t.string('icon_url', 512).nullable();
    t.bigInteger('owner_id').notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('owner_id').references('id').inTable('users');
  });

  // Roles
  await knex.schema.createTable('roles', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.string('name', 64).notNullable();
    t.string('color', 7).nullable();
    t.integer('position').notNullable().defaultTo(0);
    t.bigInteger('permissions').notNullable().defaultTo(0);
    t.boolean('is_system').notNullable().defaultTo(false);
    t.boolean('is_default').notNullable().defaultTo(false);
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
    t.unique(['space_id', 'name']);
  });

  // Space members
  await knex.schema.createTable('space_members', (t) => {
    t.bigInteger('space_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.string('nickname', 64).nullable();
    t.timestamp('joined_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.primary(['space_id', 'user_id']);
    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // Member roles
  await knex.schema.createTable('member_roles', (t) => {
    t.bigInteger('space_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.bigInteger('role_id').notNullable();

    t.primary(['space_id', 'user_id', 'role_id']);
    t.foreign(['space_id', 'user_id']).references(['space_id', 'user_id']).inTable('space_members').onDelete('CASCADE');
    t.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
  });

  // Channels
  await knex.schema.createTable('channels', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.string('name', 100).notNullable();
    t.string('topic', 1024).nullable();
    t.enum('type', ['text', 'announcement', 'read_only']).notNullable().defaultTo('text');
    t.boolean('is_private').notNullable().defaultTo(false);
    t.integer('position').notNullable().defaultTo(0);
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.timestamp('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
    t.unique(['space_id', 'name']);
  });

  // Channel members (private channels only)
  await knex.schema.createTable('channel_members', (t) => {
    t.bigInteger('channel_id').notNullable();
    t.bigInteger('user_id').notNullable();

    t.primary(['channel_id', 'user_id']);
    t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // Messages
  await knex.schema.createTable('messages', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('channel_id').notNullable();
    t.bigInteger('author_id').notNullable();
    t.text('content').notNullable();
    t.timestamp('edited_at', { precision: 3 }).nullable();
    t.boolean('is_pinned').notNullable().defaultTo(false);
    t.bigInteger('reply_to_id').nullable();

    t.foreign('channel_id').references('id').inTable('channels').onDelete('CASCADE');
    t.foreign('author_id').references('id').inTable('users');
    t.foreign('reply_to_id').references('id').inTable('messages').onDelete('SET NULL');
    t.index(['channel_id', 'id'], 'idx_messages_channel');
  });

  // Message reactions
  await knex.schema.createTable('message_reactions', (t) => {
    t.bigInteger('message_id').notNullable();
    t.bigInteger('user_id').notNullable();
    t.string('emoji', 64).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.primary(['message_id', 'user_id', 'emoji']);
    t.foreign('message_id').references('id').inTable('messages').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // Invites
  await knex.schema.createTable('invites', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').notNullable();
    t.string('code', 16).notNullable().unique();
    t.bigInteger('created_by').notNullable();
    t.integer('max_uses').nullable();
    t.integer('use_count').notNullable().defaultTo(0);
    t.timestamp('expires_at', { precision: 3 }).nullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('space_id').references('id').inTable('spaces').onDelete('CASCADE');
    t.foreign('created_by').references('id').inTable('users');
  });

  // Refresh tokens
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('user_id').notNullable();
    t.string('token_hash', 255).notNullable().unique();
    t.timestamp('expires_at', { precision: 3 }).notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.index('user_id', 'idx_refresh_tokens_user');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('message_reactions');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('channel_members');
  await knex.schema.dropTableIfExists('channels');
  await knex.schema.dropTableIfExists('member_roles');
  await knex.schema.dropTableIfExists('space_members');
  await knex.schema.dropTableIfExists('invites');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('spaces');
  await knex.schema.dropTableIfExists('users');
}
