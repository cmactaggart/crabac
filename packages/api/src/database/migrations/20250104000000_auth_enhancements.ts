import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add auth columns to users
  await knex.schema.alterTable('users', (table) => {
    table.boolean('email_verified').notNullable().defaultTo(false);
    table.boolean('totp_enabled').notNullable().defaultTo(false);
    table.string('totp_secret', 512).nullable();
    table.text('backup_codes').nullable();
  });

  // Email verification tokens
  await knex.schema.createTable('email_verification_tokens', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.string('token_hash', 255).unique().notNullable();
    table.string('email', 255).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // Magic link tokens
  await knex.schema.createTable('magic_link_tokens', (table) => {
    table.bigInteger('id').primary();
    table.bigInteger('user_id').notNullable();
    table.string('token_hash', 255).unique().notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('used').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('magic_link_tokens');
  await knex.schema.dropTableIfExists('email_verification_tokens');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verified');
    table.dropColumn('totp_enabled');
    table.dropColumn('totp_secret');
    table.dropColumn('backup_codes');
  });
}
