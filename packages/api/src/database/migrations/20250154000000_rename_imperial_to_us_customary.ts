import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Update existing rows first
  await knex('user_preferences')
    .where('distance_units', 'imperial')
    .update({ distance_units: 'us_customary' });

  // Alter the column to use the new enum values
  await knex.schema.alterTable('user_preferences', (t) => {
    t.enum('distance_units_new', ['metric', 'us_customary'])
      .notNullable()
      .defaultTo('us_customary');
  });

  await knex.raw(
    'UPDATE user_preferences SET distance_units_new = distance_units',
  );

  await knex.schema.alterTable('user_preferences', (t) => {
    t.dropColumn('distance_units');
  });

  await knex.schema.alterTable('user_preferences', (t) => {
    t.renameColumn('distance_units_new', 'distance_units');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex('user_preferences')
    .where('distance_units', 'us_customary')
    .update({ distance_units: 'imperial' });

  await knex.schema.alterTable('user_preferences', (t) => {
    t.enum('distance_units_old', ['metric', 'imperial'])
      .notNullable()
      .defaultTo('imperial');
  });

  await knex.raw(
    'UPDATE user_preferences SET distance_units_old = distance_units',
  );

  await knex.schema.alterTable('user_preferences', (t) => {
    t.dropColumn('distance_units');
  });

  await knex.schema.alterTable('user_preferences', (t) => {
    t.renameColumn('distance_units_old', 'distance_units');
  });
}
