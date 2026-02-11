import { SnowflakeGenerator } from '../lib/snowflake.js';
import { config } from '../config.js';

export const snowflake = new SnowflakeGenerator(config.workerId);
