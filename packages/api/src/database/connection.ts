import knex from 'knex';
import { config } from '../config.js';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    // Serialize bigint as string
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast(field: any, next: () => any) {
      if (field.type === 'LONGLONG') {
        const val = field.string();
        return val === null ? null : val; // keep as string
      }
      if (field.type === 'TINY' && field.length === 1) {
        const val = field.string();
        return val === null ? null : val === '1';
      }
      return next();
    },
  },
  pool: { min: 2, max: 10 },
});
