import crypto from 'crypto';
import { TOTP, Secret } from 'otpauth';
import * as QRCode from 'qrcode';
import { db } from '../../database/connection.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { BadRequestError } from '../../lib/errors.js';

function createTOTP(secret: Secret): TOTP {
  return new TOTP({
    issuer: 'crab.ac',
    label: 'crab.ac',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
}

export async function setupTOTP(userId: string) {
  const secret = new Secret({ size: 20 });
  const totp = createTOTP(secret);

  // Encrypt and store (but don't enable yet)
  const encryptedSecret = encrypt(secret.base32);
  await db('users').where('id', userId).update({ totp_secret: encryptedSecret });

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () => {
    const code = crypto.randomBytes(4).toString('hex');
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
  const hashedCodes = backupCodes.map((c) =>
    crypto.createHash('sha256').update(c).digest('hex'),
  );
  await db('users').where('id', userId).update({ backup_codes: JSON.stringify(hashedCodes) });

  const qrCodeUrl = await QRCode.toDataURL(totp.toString());

  return { secret: secret.base32, qrCodeUrl, backupCodes };
}

export async function confirmTOTP(userId: string, code: string) {
  const user = await db('users').where('id', userId).first();
  if (!user?.totp_secret) throw new BadRequestError('TOTP not set up. Call setup first.');

  const secret = Secret.fromBase32(decrypt(user.totp_secret));
  const totp = createTOTP(secret);
  const delta = totp.validate({ token: code, window: 1 });

  if (delta === null) throw new BadRequestError('Invalid TOTP code');

  await db('users').where('id', userId).update({ totp_enabled: true });
}

export async function verifyTOTP(userId: string, code: string): Promise<boolean> {
  const user = await db('users').where('id', userId).first();
  if (!user?.totp_secret) return false;

  const secret = Secret.fromBase32(decrypt(user.totp_secret));
  const totp = createTOTP(secret);
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await db('users').where('id', userId).first();
  if (!user?.backup_codes) return false;

  const hashes: string[] = JSON.parse(user.backup_codes);
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const index = hashes.indexOf(codeHash);

  if (index === -1) return false;

  // Remove used code
  hashes.splice(index, 1);
  await db('users').where('id', userId).update({ backup_codes: JSON.stringify(hashes) });
  return true;
}

export async function disableTOTP(userId: string) {
  await db('users').where('id', userId).update({
    totp_enabled: false,
    totp_secret: null,
    backup_codes: null,
  });
}

export async function regenerateBackupCodes(userId: string) {
  const backupCodes = Array.from({ length: 10 }, () => {
    const code = crypto.randomBytes(4).toString('hex');
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
  const hashedCodes = backupCodes.map((c) =>
    crypto.createHash('sha256').update(c).digest('hex'),
  );
  await db('users').where('id', userId).update({ backup_codes: JSON.stringify(hashedCodes) });
  return backupCodes;
}
