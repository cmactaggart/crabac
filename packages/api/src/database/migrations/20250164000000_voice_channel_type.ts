import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum','media_gallery','route_library','voice') NOT NULL DEFAULT 'text'"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    "ALTER TABLE channels MODIFY COLUMN type ENUM('text','announcement','read_only','forum','media_gallery','route_library') NOT NULL DEFAULT 'text'"
  );
}
