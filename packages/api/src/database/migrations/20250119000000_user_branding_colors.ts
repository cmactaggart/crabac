import type { Knex } from 'knex';

const COLOR_PALETTE = [
  { base: '#667eea', accent: '#764ba2' },
  { base: '#f093fb', accent: '#f5576c' },
  { base: '#4facfe', accent: '#00f2fe' },
  { base: '#43e97b', accent: '#38f9d7' },
  { base: '#fa709a', accent: '#fee140' },
  { base: '#a18cd1', accent: '#fbc2eb' },
  { base: '#fccb90', accent: '#d57eeb' },
  { base: '#e0c3fc', accent: '#8ec5fc' },
  { base: '#f5576c', accent: '#ff9a76' },
  { base: '#6991c7', accent: '#a3bded' },
  { base: '#13547a', accent: '#80d0c7' },
  { base: '#ff0844', accent: '#ffb199' },
  { base: '#c471f5', accent: '#fa71cd' },
  { base: '#48c6ef', accent: '#6f86d6' },
  { base: '#a1c4fd', accent: '#c2e9fb' },
  { base: '#d4fc79', accent: '#96e6a1' },
  { base: '#84fab0', accent: '#8fd3f4' },
  { base: '#f6d365', accent: '#fda085' },
  { base: '#ffecd2', accent: '#fcb69f' },
  { base: '#a6c0fe', accent: '#f68084' },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.string('base_color', 7).nullable();
    table.string('accent_color', 7).nullable();
  });

  // Backfill existing users with random colors
  const users = await knex('users').select('id');
  for (const user of users) {
    const combo = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    await knex('users').where('id', user.id).update({
      base_color: combo.base,
      accent_color: combo.accent,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('base_color');
    table.dropColumn('accent_color');
  });
}
