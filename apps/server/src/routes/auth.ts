import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { PENDING_COOKIE, PENDING_EXPIRES_MS } from '../features/totp/totpRouter.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const registerSchema = z.object({
  username: z.string()
    .min(3, '3文字以上で入力してください')
    .max(50, '50文字以内で入力してください')
    .regex(/^[\p{L}\p{N}_\-.]+$/u, '使用できない文字が含まれています'),
  password: z.string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .max(100, 'パスワードは100文字以内で入力してください'),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = registerSchema.parse(req.body);

    const exists = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (exists.rows.length > 0) {
      res.status(409).json({ error: 'このユーザーIDは既に使用されています' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, display_name, password_hash) VALUES ($1, $1, $2) RETURNING id, username, display_name, avatar_url, status',
      [username, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken({ userId: user.id, username: user.username });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, username, display_name, avatar_url, status, password_hash, totp_enabled FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'ユーザーIDまたはパスワードが間違っています' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'ユーザーIDまたはパスワードが間違っています' });
      return;
    }

    // 2FA有効なら pending_token を発行してTOTPステップへ
    if (user.totp_enabled) {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) throw new Error('JWT_SECRET is not set');
      const pendingToken = jwt.sign(
        { userId: user.id, username: user.username, totp_pending: true },
        jwtSecret,
        { expiresIn: '15m' }
      );
      res.cookie(PENDING_COOKIE, pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
        maxAge: PENDING_EXPIRES_MS,
      });
      res.json({ requireTotp: true });
      return;
    }

    await pool.query(
      "UPDATE users SET status = 'online' WHERE id = $1",
      [user.id]
    );

    const token = signToken({ userId: user.id, username: user.username });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        status: 'online',
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/logout
router.delete('/logout', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await pool.query(
      "UPDATE users SET status = 'offline' WHERE id = $1",
      [req.user!.userId]
    );
    res.clearCookie('token');
    res.json({ message: 'ログアウトしました' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, avatar_url, status FROM users WHERE id = $1',
      [req.user!.userId]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      display_name: z.string().min(1).max(100).optional(),
      status: z.enum(['online', 'away', 'busy', 'offline']).optional(),
      avatar_url: z.string().url().optional(),
    });
    const updates = schema.parse(req.body);

    const fields = Object.entries(updates);
    if (fields.length === 0) {
      res.status(400).json({ error: '更新するフィールドがありません' });
      return;
    }

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, val]) => val);

    const result = await pool.query(
      `UPDATE users SET ${setClause} WHERE id = $1 RETURNING id, username, display_name, avatar_url, status`,
      [req.user!.userId, ...values]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
