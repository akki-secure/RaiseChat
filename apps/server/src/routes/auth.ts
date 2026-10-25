import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { PENDING_COOKIE, PENDING_EXPIRES_MS } from '../features/totp/totpRouter.js';
import { isBlockedPassword } from '../utils/blockedPasswords.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const usernameRule = z.string()
  .min(3, '3文字以上で入力してください')
  .max(50, '50文字以内で入力してください')
  .regex(/^[\p{L}\p{N}_\-.]+$/u, '使用できない文字が含まれています');

const passwordRule = z.string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .max(100, 'パスワードは100文字以内で入力してください')
  .regex(/[a-zA-Z]/, 'パスワードには英字を含めてください')
  .regex(/[0-9]/, 'パスワードには数字を含めてください')
  .regex(/[^a-zA-Z0-9]/, 'パスワードには記号を含めてください');

function validatePasswordStrength(password: string): string | null {
  const result = passwordRule.safeParse(password);
  if (!result.success) return result.error.errors[0].message;
  if (isBlockedPassword(password)) return 'このパスワードはセキュリティリスクが高いため使用できません';
  return null;
}

const registerSchema = z.object({
  username: usernameRule,
  password: z.string().min(1),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = registerSchema.parse(req.body);

    const pwError = validatePasswordStrength(password);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

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
      'SELECT id, username, display_name, avatar_url, status, totp_enabled, security_question IS NOT NULL AS has_security_question FROM users WHERE id = $1',
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

// PATCH /api/auth/username
router.patch('/username', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { newUsername } = z.object({ newUsername: usernameRule }).parse(req.body);

    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [newUsername]);
    if (exists.rows.length > 0) {
      res.status(409).json({ error: 'このユーザーIDは既に使用されています' });
      return;
    }

    const result = await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, display_name, avatar_url, status',
      [newUsername, req.user!.userId]
    );
    const user = result.rows[0];
    const token = signToken({ userId: user.id, username: user.username });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/password
router.patch('/password', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(1),
    }).parse(req.body);

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: '現在のパスワードが正しくありません' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.userId]);
    res.json({ message: 'パスワードを変更しました' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/security-question
router.post('/security-question', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { question, answer } = z.object({
      question: z.string().min(1).max(200),
      answer: z.string().min(1).max(200),
    }).parse(req.body);

    const answerHash = await bcrypt.hash(answer.toLowerCase().trim(), 12);
    await pool.query(
      'UPDATE users SET security_question = $1, security_answer_hash = $2 WHERE id = $3',
      [question, answerHash, req.user!.userId]
    );
    res.json({ message: '秘密の質問を設定しました' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/security-question
router.get('/security-question', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = z.object({ username: z.string().min(1) }).parse(req.query);

    const result = await pool.query(
      'SELECT security_question FROM users WHERE username = $1',
      [username]
    );
    if (!result.rows[0] || !result.rows[0].security_question) {
      res.status(404).json({ error: 'ユーザーが見つからないか、秘密の質問が設定されていません' });
      return;
    }
    res.json({ question: result.rows[0].security_question });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, answer, newPassword } = z.object({
      username: z.string().min(1),
      answer: z.string().min(1),
      newPassword: z.string().min(1),
    }).parse(req.body);

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const result = await pool.query(
      'SELECT id, security_answer_hash FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user || !user.security_answer_hash) {
      res.status(400).json({ error: 'ユーザーが見つからないか、秘密の質問が設定されていません' });
      return;
    }

    const valid = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer_hash);
    if (!valid) {
      res.status(401).json({ error: '秘密の質問の回答が正しくありません' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    res.json({ message: 'パスワードをリセットしました' });
  } catch (err) {
    next(err);
  }
});

export default router;
