import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import semver from 'semver';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { config } from '../../config.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import type { MobileBundle, MobileBundleUpdateCheck } from '@crabac/shared';

const BUNDLES_DIR = 'bundles';

function toMobileBundle(row: any): MobileBundle {
  return {
    id: String(row.id),
    platform: row.platform,
    bundleVersion: row.bundle_version,
    nativeVersion: row.native_version,
    filePath: row.file_path,
    checksum: row.checksum,
    fileSize: Number(row.file_size),
    status: row.status,
    isRequired: !!row.is_required,
    releaseNotes: row.release_notes,
    createdBy: String(row.created_by),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

export async function checkForUpdate(
  platform: 'ios' | 'android',
  nativeVersion: string,
  currentBundleVersion: number,
): Promise<MobileBundleUpdateCheck | null> {
  // Get all active bundles newer than currentBundleVersion for this platform
  const bundles = await db('mobile_bundles')
    .where('platform', platform)
    .where('status', 'active')
    .where('bundle_version', '>', currentBundleVersion)
    .orderBy('bundle_version', 'asc');

  if (bundles.length === 0) return null;

  // Filter to bundles compatible with this native version
  const compatible = bundles.filter((b: any) =>
    semver.gte(nativeVersion, b.native_version),
  );

  if (compatible.length === 0) return null;

  // The latest compatible bundle
  const latest = compatible[compatible.length - 1];

  // If ANY bundle in the range is required, the update is required
  const isRequired = compatible.some((b: any) => b.is_required);

  return {
    id: String(latest.id),
    bundleVersion: latest.bundle_version,
    nativeVersion: latest.native_version,
    checksum: latest.checksum,
    fileSize: Number(latest.file_size),
    downloadUrl: `/api/mobile/bundles/${latest.id}/download`,
    isRequired,
    releaseNotes: latest.release_notes,
  };
}

export async function getBundleById(id: string): Promise<MobileBundle> {
  const row = await db('mobile_bundles').where('id', id).first();
  if (!row) throw new NotFoundError('Bundle');
  return toMobileBundle(row);
}

export async function uploadBundle(
  platform: 'ios' | 'android',
  nativeVersion: string,
  isRequired: boolean,
  releaseNotes: string | undefined,
  file: Express.Multer.File,
  userId: string,
): Promise<MobileBundle> {
  // Ensure bundles subdirectory exists
  const bundlesDir = path.join(config.uploadsDir, BUNDLES_DIR);
  await fs.promises.mkdir(bundlesDir, { recursive: true });

  // Compute SHA-256 checksum
  const checksum = await computeChecksum(file.path);

  // Auto-increment bundle_version
  const maxRow = await db('mobile_bundles')
    .where('platform', platform)
    .max('bundle_version as maxVer')
    .first();
  const bundleVersion = (maxRow?.maxVer ?? 0) + 1;

  // Move file to bundles subdirectory with a deterministic name
  const ext = path.extname(file.originalname) || '.bundle';
  const destFilename = `${platform}-v${bundleVersion}-${checksum.slice(0, 12)}${ext}`;
  const destPath = path.join(bundlesDir, destFilename);
  await fs.promises.rename(file.path, destPath);

  const filePath = `${BUNDLES_DIR}/${destFilename}`;
  const id = snowflake.generate();

  await db('mobile_bundles').insert({
    id,
    platform,
    bundle_version: bundleVersion,
    native_version: nativeVersion,
    file_path: filePath,
    checksum,
    file_size: file.size,
    status: 'active',
    is_required: isRequired,
    release_notes: releaseNotes || null,
    created_by: userId,
  });

  return getBundleById(String(id));
}

export async function listBundles(opts: {
  platform?: 'ios' | 'android';
  status?: 'active' | 'inactive';
  limit: number;
  offset: number;
}): Promise<{ bundles: MobileBundle[]; total: number }> {
  let query = db('mobile_bundles');
  let countQuery = db('mobile_bundles');

  if (opts.platform) {
    query = query.where('platform', opts.platform);
    countQuery = countQuery.where('platform', opts.platform);
  }
  if (opts.status) {
    query = query.where('status', opts.status);
    countQuery = countQuery.where('status', opts.status);
  }

  const [{ count }] = await countQuery.count('* as count');
  const rows = await query
    .orderBy('bundle_version', 'desc')
    .limit(opts.limit)
    .offset(opts.offset);

  return {
    bundles: rows.map(toMobileBundle),
    total: Number(count),
  };
}

export async function deactivateBundle(id: string): Promise<MobileBundle> {
  const row = await db('mobile_bundles').where('id', id).first();
  if (!row) throw new NotFoundError('Bundle');
  if (row.status === 'inactive') throw new BadRequestError('Bundle is already inactive');

  await db('mobile_bundles').where('id', id).update({ status: 'inactive' });
  return getBundleById(id);
}

export async function activateBundle(id: string): Promise<MobileBundle> {
  const row = await db('mobile_bundles').where('id', id).first();
  if (!row) throw new NotFoundError('Bundle');
  if (row.status === 'active') throw new BadRequestError('Bundle is already active');

  await db('mobile_bundles').where('id', id).update({ status: 'active' });
  return getBundleById(id);
}

export function getBundleFilePath(bundle: MobileBundle): string {
  return path.join(config.uploadsDir, bundle.filePath);
}

async function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
