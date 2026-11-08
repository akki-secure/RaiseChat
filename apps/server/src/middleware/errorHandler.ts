import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import logger from '../utils/logger.js';
import { UploadError } from './upload.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'バリデーションエラー',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  // アップロードのエラーは利用者の操作で起きるので、500ではなく400で返す
  if (err instanceof UploadError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof multer.MulterError) {
    const error = err.code === 'LIMIT_FILE_SIZE'
      ? 'ファイルが大きすぎます（画像は10MB、動画は100MBまで）'
      : 'ファイルのアップロードに失敗しました';
    res.status(400).json({ error });
    return;
  }

  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({ error: 'サーバーエラーが発生しました' });
}
