import multer from 'multer';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../lib/errors.js';
import { config } from '../config.js';

const attachmentStorage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

export const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.cjs', '.php', '.asp', '.aspx', '.jsp', '.sh', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.msi']);

export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.ogg', '.ogv', '.avi', '.mkv']);

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max (videos)
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(new Error('File type not allowed'));
    } else {
      cb(null, true);
    }
  },
});

/** Wraps multer to forward errors to Express error handling instead of crashing */
export function handleMulterUpload(req: Request, res: Response, next: NextFunction) {
  attachmentUpload.array('files', 20)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('File too large (max 100MB for video, 10MB for other files)'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new BadRequestError('Too many files (max 20)'));
      }
      return next(new BadRequestError(err.message || 'Upload failed'));
    }
    next();
  });
}
