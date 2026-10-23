import multer from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm']);

const MAX_SIZE_IMAGE = 10 * 1024 * 1024;  // 10MB
const MAX_SIZE_VIDEO = 100 * 1024 * 1024; // 100MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_VIDEO },
  fileFilter(_req: Request, file, cb) {
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('許可されていないファイル形式です'));
      return;
    }
    cb(null, true);
  },
});

export function validateFileSize(file: Express.Multer.File): string | null {
  if (file.mimetype.startsWith('image/') && file.size > MAX_SIZE_IMAGE) {
    return '画像は10MB以下にしてください';
  }
  if (file.mimetype.startsWith('video/') && file.size > MAX_SIZE_VIDEO) {
    return '動画は100MB以下にしてください';
  }
  return null;
}
