import type { Knex } from 'knex';

const VISIBILITY_COLUMNS = [
  { table: 'user_posts', column: 'visibility' },
  { table: 'personal_gallery_items', column: 'visibility' },
  { table: 'personal_route_items', column: 'visibility' },
  { table: 'personal_activity_items', column: 'visibility' },
  { table: 'user_preferences', column: 'default_visibility' },
  { table: 'user_preferences', column: 'profile_visibility' },
  { table: 'user_preferences', column: 'activities_visibility' },
];

export async function up(knex: Knex): Promise<void> {
  // First update all 'friends' values to 'followers'
  for (const { table, column } of VISIBILITY_COLUMNS) {
    await knex(table).where(column, 'friends').update({ [column]: 'followers' });
  }

  // Then alter ENUM definitions
  for (const { table, column } of VISIBILITY_COLUMNS) {
    const nullable = column === 'activities_visibility';
    const nullClause = nullable ? '' : 'NOT NULL';
    await knex.raw(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM('public','private','followers','spaces') ${nullClause}`,
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const { table, column } of VISIBILITY_COLUMNS) {
    await knex(table).where(column, 'followers').update({ [column]: 'friends' });
  }

  for (const { table, column } of VISIBILITY_COLUMNS) {
    const nullable = column === 'activities_visibility';
    const nullClause = nullable ? '' : 'NOT NULL';
    await knex.raw(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM('public','private','friends','spaces') ${nullClause}`,
    );
  }
}
