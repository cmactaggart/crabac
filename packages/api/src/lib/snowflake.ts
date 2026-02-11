/**
 * Snowflake ID generator.
 *
 * Layout (64 bits):
 *   1 bit  unused (sign)
 *  41 bits timestamp (ms since custom epoch — ~69 years)
 *  10 bits worker id (0-1023)
 *  12 bits sequence (0-4095 per ms per worker)
 *
 * Custom epoch: 2025-01-01T00:00:00.000Z
 */

const EPOCH = 1735689600000n; // 2025-01-01T00:00:00.000Z
const WORKER_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;
const TIMESTAMP_SHIFT = WORKER_BITS + SEQUENCE_BITS;
const WORKER_SHIFT = SEQUENCE_BITS;

export class SnowflakeGenerator {
  private workerId: bigint;
  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(workerId: number) {
    const wid = BigInt(workerId);
    if (wid < 0n || wid > MAX_WORKER_ID) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
    }
    this.workerId = wid;
  }

  generate(): string {
    let timestamp = BigInt(Date.now()) - EPOCH;

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // Sequence exhausted for this ms — wait for next ms
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now()) - EPOCH;
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id =
      (timestamp << TIMESTAMP_SHIFT) |
      (this.workerId << WORKER_SHIFT) |
      this.sequence;

    return id.toString();
  }
}
