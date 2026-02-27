import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Newsletters table
  await knex.schema.createTable('newsletters', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('space_id').nullable().references('id').inTable('spaces').onDelete('CASCADE');
    t.bigInteger('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('subject', 500).notNullable();
    t.string('summary', 500).nullable();
    t.string('header_image_url', 512).nullable();
    t.json('blocks').notNullable();
    t.enum('status', ['draft', 'published']).notNullable().defaultTo('draft');
    t.boolean('is_public').notNullable().defaultTo(false);
    t.timestamp('published_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    t.index(['space_id', 'status', 'published_at']);
    t.index(['author_id', 'space_id']);
  });

  // Newsletter subscriptions (authenticated users)
  await knex.schema.createTable('newsletter_subscriptions', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enum('source_type', ['space', 'user']).notNullable();
    t.bigInteger('source_id').notNullable();
    t.enum('frequency', ['immediate', 'daily_digest', 'weekly_digest']).notNullable().defaultTo('immediate');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('unsubscribe_token', 128).notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    t.unique(['user_id', 'source_type', 'source_id']);
    t.index('unsubscribe_token');
  });

  // Newsletter anonymous subscribers
  await knex.schema.createTable('newsletter_anonymous_subscribers', (t) => {
    t.bigInteger('id').primary();
    t.string('email', 255).notNullable();
    t.enum('source_type', ['space', 'user']).notNullable();
    t.bigInteger('source_id').notNullable();
    t.enum('frequency', ['immediate', 'daily_digest', 'weekly_digest']).notNullable().defaultTo('immediate');
    t.boolean('is_active').notNullable().defaultTo(false);
    t.boolean('email_verified').notNullable().defaultTo(false);
    t.string('verification_token_hash', 128).nullable();
    t.timestamp('verification_expires_at', { useTz: true }).nullable();
    t.string('unsubscribe_token', 128).notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    t.unique(['email', 'source_type', 'source_id'], { indexName: 'nl_anon_sub_email_src_unique' });
    t.index('unsubscribe_token');
    t.index('verification_token_hash');
  });

  // Newsletter sends (tracking individual email deliveries)
  await knex.schema.createTable('newsletter_sends', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('newsletter_id').notNullable().references('id').inTable('newsletters').onDelete('CASCADE');
    t.enum('recipient_type', ['user', 'anonymous']).notNullable();
    t.bigInteger('recipient_id').notNullable(); // subscription or anonymous_subscriber id
    t.string('email', 255).notNullable();
    t.string('ses_message_id', 255).nullable();
    t.enum('status', ['queued', 'sent', 'delivered', 'opened', 'bounced', 'complained']).notNullable().defaultTo('queued');
    t.timestamp('sent_at', { useTz: true }).nullable();
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.timestamp('opened_at', { useTz: true }).nullable();
    t.integer('open_count').notNullable().defaultTo(0);
    t.integer('click_count').notNullable().defaultTo(0);
    t.string('tracking_token', 128).notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    t.index(['newsletter_id', 'status']);
    t.index('tracking_token');
  });

  // Newsletter link clicks
  await knex.schema.createTable('newsletter_link_clicks', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('send_id').notNullable().references('id').inTable('newsletter_sends').onDelete('CASCADE');
    t.string('original_url', 2000).notNullable();
    t.timestamp('clicked_at', { useTz: true }).defaultTo(knex.fn.now());
    t.string('user_agent', 500).nullable();
    t.string('ip_hash', 64).nullable();

    t.index('send_id');
  });

  // Newsletter digest queue
  await knex.schema.createTable('newsletter_digest_queue', (t) => {
    t.bigInteger('id').primary();
    t.bigInteger('newsletter_id').notNullable().references('id').inTable('newsletters').onDelete('CASCADE');
    t.enum('source_type', ['space', 'user']).notNullable();
    t.bigInteger('source_id').notNullable();
    t.timestamp('published_at', { useTz: true }).notNullable();
    t.boolean('processed').notNullable().defaultTo(false);

    t.index(['processed', 'source_type', 'source_id']);
  });

  // Add newsletter settings to space_settings
  await knex.schema.alterTable('space_settings', (t) => {
    t.boolean('newsletter_enabled').notNullable().defaultTo(false);
    t.boolean('allow_public_newsletter').notNullable().defaultTo(false);
    t.boolean('allow_public_newsletter_subscription').notNullable().defaultTo(false);
    t.boolean('newsletter_tracking_enabled').notNullable().defaultTo(true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('space_settings', (t) => {
    t.dropColumn('newsletter_enabled');
    t.dropColumn('allow_public_newsletter');
    t.dropColumn('allow_public_newsletter_subscription');
    t.dropColumn('newsletter_tracking_enabled');
  });

  await knex.schema.dropTableIfExists('newsletter_digest_queue');
  await knex.schema.dropTableIfExists('newsletter_link_clicks');
  await knex.schema.dropTableIfExists('newsletter_sends');
  await knex.schema.dropTableIfExists('newsletter_anonymous_subscribers');
  await knex.schema.dropTableIfExists('newsletter_subscriptions');
  await knex.schema.dropTableIfExists('newsletters');
}
