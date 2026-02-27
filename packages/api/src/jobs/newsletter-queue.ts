/**
 * Newsletter job queue utilities.
 * Uses direct execution (no BullMQ) — sends are triggered synchronously when published.
 * Digest jobs run via the worker cron.
 */

export interface ImmediateEmailJob {
  newsletterId: string;
}

export interface DigestJob {
  frequency: 'daily' | 'weekly';
}
