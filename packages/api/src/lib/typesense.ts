import { Client } from 'typesense';
import { config } from '../config.js';

let client: Client | null = null;

export function initTypesense(): void {
  if (!config.typesense.apiKey) {
    console.log('Typesense API key not set — search indexing disabled');
    return;
  }

  client = new Client({
    nodes: [{
      host: config.typesense.host,
      port: config.typesense.port,
      protocol: config.typesense.protocol,
    }],
    apiKey: config.typesense.apiKey,
    connectionTimeoutSeconds: 5,
  });

  console.log(`Typesense client initialized (${config.typesense.protocol}://${config.typesense.host}:${config.typesense.port})`);
}

export function getTypesenseClient(): Client | null {
  return client;
}
