import 'dotenv/config';
import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'gud',
    password: process.env.DB_PASSWORD || 'gudpass',
    database: process.env.DB_NAME || 'gud',
    supportBigNumbers: true,
    bigNumberStrings: true,
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts',
  },
};

export default config;
