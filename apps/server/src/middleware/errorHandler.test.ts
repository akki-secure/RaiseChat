import { describe, it, expect, vi } from 'vitest';
import multer from 'multer';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../utils/logger.js', () => ({ default: { error: vi.fn() } }));
import logger from '../utils/logger.js';
import { errorHandler } from './errorHandler.js';
import { UploadError } from './upload.js';

interface FakeRes { statusCode: number; body: { error?: string }; status: (c: number) => FakeRes; json: (b: unknown) => FakeRes }

function run(err: unknown): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    body: {},
    status: (c) => { res.statusCode = c; return res; },
    json: (b) => { res.body = b as FakeRes['body']; return res; },
  };
  const req = { method: 'POST', path: '/api/upload' } as Request;
  errorHandler(err, req, res as unknown as Response, (() => {}) as NextFunction);
  return res;
}

describe('errorHandler', () => {
  it('ファイルサイズ超過（LIMIT_FILE_SIZE）は 400 で案内を返す', () => {
    const res = run(new multer.MulterError('LIMIT_FILE_SIZE'));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('100MB');
    expect(logger.error).not.toHaveBeenCalled();
  });
  it('その他の multer エラーも 400', () => {
    expect(run(new multer.MulterError('LIMIT_UNEXPECTED_FILE')).statusCode).toBe(400);
  });
  it('許可されていない形式（UploadError）は 400 でメッセージをそのまま返す', () => {
    const res = run(new UploadError('許可されていないファイル形式です'));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('許可されていないファイル形式です');
  });
  it('Zod のエラーは従来どおり 400', () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    expect(run(parsed.success ? null : parsed.error).statusCode).toBe(400);
  });
  it('想定外のエラーは 500 で、内部の詳細は返さずログに記録する', () => {
    const res = run(new Error('db connection failed'));
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('サーバーエラーが発生しました');
    expect(JSON.stringify(res.body)).not.toContain('db connection');
    expect(logger.error).toHaveBeenCalled();
  });
});
