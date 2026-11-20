import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

// 実DBに対する統合テスト。INTEGRATION_DB=1 のときだけ動く（普段の pnpm test では実行されない）
// アプリ用ロールは DELETE できないため後始末はしない。毎回ユニークな名前で作り、使い捨てDB(CI / raisechat_test)でのみ実行する
const run = process.env.INTEGRATION_DB === '1' ? describe : describe.skip;

// Socket.io だけモックする（DB・SQL・トランザクションは本物）
const emit = vi.fn();
const socketsLeave = vi.fn();
vi.mock('../../socket/ioInstance.js', () => ({
  getIo: () => ({
    to: (room: string) => ({ emit: (...a: unknown[]) => emit(room, ...a) }),
    in: (room: string) => ({ socketsLeave: (...a: unknown[]) => socketsLeave(room, ...a) }),
  }),
}));

import pool from '../../config/db.js';
import { signToken } from '../../utils/jwt.js';
import moderationRouter from './moderationRouter.js';

const sfx = () => randomUUID().slice(0, 8);

async function mkUser(label: string) {
  const username = `it_${label}_${sfx()}`;
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, 'x') RETURNING id`, [username]);
  return { id: rows[0].id as string, username };
}
async function mkWorkspace(ownerId: string) {
  const { rows } = await pool.query(
    `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id`, [`it-${sfx()}`, ownerId]);
  await pool.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`, [rows[0].id, ownerId]);
  return rows[0].id as string;
}
async function addMember(wid: string, uid: string) {
  await pool.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`, [wid, uid]);
}
async function mkChannel(wid: string, createdBy: string, members: string[]) {
  const { rows } = await pool.query(
    `INSERT INTO channels (workspace_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`, [wid, `ch-${sfx()}`, createdBy]);
  for (const m of members) {
    await pool.query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)`, [rows[0].id, m]);
  }
  return rows[0].id as string;
}
async function mkMessage(cid: string, uid: string) {
  const { rows } = await pool.query(
    `INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, 'hi') RETURNING id`, [cid, uid]);
  return rows[0].id as string;
}
async function mkWarnings(wid: string, uid: string, issuer: string, n: number) {
  for (let i = 0; i < n; i++) {
    await pool.query(`INSERT INTO member_warnings (workspace_id, user_id, issued_by, reason) VALUES ($1,$2,$3,'r')`, [wid, uid, issuer]);
  }
}

run('moderation（実DB）', () => {
  let app: express.Express;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/workspaces/:wid/members', moderationRouter);
  });
  afterAll(async () => { await pool.end(); });

  const as = (u: { id: string; username: string }) => `token=${signToken({ userId: u.id, username: u.username })}`;
  const url = (wid: string, uid: string, action: string) => `/api/workspaces/${wid}/members/${uid}/${action}`;

  // 1 オーナー + 1 対象 + 1 チャンネルを用意する
  async function setup() {
    const owner = await mkUser('own');
    const target = await mkUser('tgt');
    const wid = await mkWorkspace(owner.id);
    await addMember(wid, target.id);
    const cid = await mkChannel(wid, owner.id, [owner.id, target.id]);
    return { owner, target, wid, cid };
  }

  describe('kick', () => {
    it('同時に3回キックしても、成功は1回だけ', async () => {
      const { owner, target, wid } = await setup();
      const send = () => request(app).post(url(wid, target.id, 'kick'))
        .set('Cookie', as(owner)).send({ reason: 'spam', severe: true });
      const res = await Promise.all([send(), send(), send()]);
      const codes = res.map((r) => r.status);
      expect(codes.filter((c) => c === 200)).toHaveLength(1);
      expect(codes.filter((c) => c !== 200 && c !== 400 && c !== 409)).toEqual([]);
    });

    it('事前チェックを通過したあとにほかの操作でキック済みになったら、FOR UPDATE で待ってから 409（二重にキックしない）', async () => {
      const { owner, target, wid } = await setup();
      // 別の接続で対象の行をロックしたまま、キックのリクエストを送る。事前チェックは通過し、FOR UPDATE で待たされる
      const holder = await pool.connect();
      try {
        await holder.query('BEGIN');
        await holder.query(
          `SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE`, [wid, target.id]);
        const pending = request(app).post(url(wid, target.id, 'kick'))
          .set('Cookie', as(owner)).send({ reason: 'spam', severe: true }).then((r) => r);

        const early = await Promise.race([pending, new Promise((r) => setTimeout(() => r('waiting'), 300))]);
        expect(early).toBe('waiting'); // ロックが解けるまでレスポンスは返らない

        // ロックを持つ側が先にキック済みにして確定する
        await holder.query(
          `UPDATE workspace_members SET removed_at = NOW(), removed_reason = 'first' WHERE workspace_id=$1 AND user_id=$2`, [wid, target.id]);
        await holder.query('COMMIT');

        const res = await pending;
        expect(res.status).toBe(409);
        const wm = await pool.query(`SELECT removed_reason FROM workspace_members WHERE workspace_id=$1 AND user_id=$2`, [wid, target.id]);
        expect(wm.rows[0].removed_reason).toBe('first'); // 後続のキックで上書きされていない
      } finally {
        await holder.query('ROLLBACK').catch(() => undefined);
        holder.release();
      }
    });

    it('警告2回では 400、3回なら成功、severe なら警告0回でも成功', async () => {
      const a = await setup();
      await mkWarnings(a.wid, a.target.id, a.owner.id, 2);
      const r1 = await request(app).post(url(a.wid, a.target.id, 'kick')).set('Cookie', as(a.owner)).send({ reason: 'x' });
      expect(r1.status).toBe(400);
      await mkWarnings(a.wid, a.target.id, a.owner.id, 1);
      const r2 = await request(app).post(url(a.wid, a.target.id, 'kick')).set('Cookie', as(a.owner)).send({ reason: 'x' });
      expect(r2.status).toBe(200);

      const b = await setup();
      const r3 = await request(app).post(url(b.wid, b.target.id, 'kick')).set('Cookie', as(b.owner)).send({ reason: 'x', severe: true });
      expect(r3.status).toBe(200);
    });

    it('取り消された警告は数えない', async () => {
      const { owner, target, wid } = await setup();
      await mkWarnings(wid, target.id, owner.id, 3);
      await pool.query(`UPDATE member_warnings SET revoked_at = NOW() WHERE workspace_id = $1 AND user_id = $2`, [wid, target.id]);
      const r = await request(app).post(url(wid, target.id, 'kick')).set('Cookie', as(owner)).send({ reason: 'x' });
      expect(r.status).toBe(400);
    });

    it('キックすると、そのWSのチャンネル所属だけ removed_at が付き、他WSには影響しない。メッセージは残る', async () => {
      const { owner, target, wid, cid } = await setup();
      const msg = await mkMessage(cid, target.id);
      const other = await mkWorkspace(owner.id);
      const otherCid = await mkChannel(other, owner.id, [owner.id, target.id]);

      const r = await request(app).post(url(wid, target.id, 'kick')).set('Cookie', as(owner)).send({ reason: 'x', severe: true });
      expect(r.status).toBe(200);

      const wm = await pool.query(`SELECT removed_at, removed_reason FROM workspace_members WHERE workspace_id=$1 AND user_id=$2`, [wid, target.id]);
      expect(wm.rows[0].removed_at).not.toBeNull();
      expect(wm.rows[0].removed_reason).toBe('x');
      const cm = async (c: string) => (await pool.query(`SELECT removed_at FROM channel_members WHERE channel_id=$1 AND user_id=$2`, [c, target.id])).rows[0].removed_at;
      expect(await cm(cid)).not.toBeNull();
      expect(await cm(otherCid)).toBeNull();
      expect((await pool.query(`SELECT 1 FROM messages WHERE id=$1 AND deleted_at IS NULL`, [msg])).rowCount).toBe(1);
      expect(socketsLeave).toHaveBeenCalledWith(`user:${target.id}`, [`channel:${cid}`]);
    });
  });

  describe('warn の message_id 検証', () => {
    const warn = (o: { id: string; username: string }, wid: string, uid: string, message_id: string) =>
      request(app).post(url(wid, uid, 'warn')).set('Cookie', as(o)).send({ reason: 'r', message_id });

    it('対象本人の未削除メッセージなら 201', async () => {
      const { owner, target, wid, cid } = await setup();
      const r = await warn(owner, wid, target.id, await mkMessage(cid, target.id));
      expect(r.status).toBe(201);
    });

    it('他人の発言・削除済みメッセージ・削除済みチャンネル・別WSのメッセージは 400', async () => {
      const { owner, target, wid, cid } = await setup();

      const ownersMsg = await mkMessage(cid, owner.id);
      expect((await warn(owner, wid, target.id, ownersMsg)).status).toBe(400);

      const deleted = await mkMessage(cid, target.id);
      await pool.query(`UPDATE messages SET deleted_at = NOW() WHERE id = $1`, [deleted]);
      expect((await warn(owner, wid, target.id, deleted)).status).toBe(400);

      const deadCid = await mkChannel(wid, owner.id, [owner.id, target.id]);
      const inDead = await mkMessage(deadCid, target.id);
      await pool.query(`UPDATE channels SET deleted_at = NOW() WHERE id = $1`, [deadCid]);
      expect((await warn(owner, wid, target.id, inDead)).status).toBe(400);

      const otherWid = await mkWorkspace(owner.id);
      await addMember(otherWid, target.id);
      const otherCid = await mkChannel(otherWid, owner.id, [target.id]);
      expect((await warn(owner, wid, target.id, await mkMessage(otherCid, target.id))).status).toBe(400);
    });
  });

  describe('unkick', () => {
    it('キック解除で removed_at が NULL に戻り、キックされていない人は 404', async () => {
      const { owner, target, wid } = await setup();
      expect((await request(app).post(url(wid, target.id, 'unkick')).set('Cookie', as(owner))).status).toBe(404);
      await request(app).post(url(wid, target.id, 'kick')).set('Cookie', as(owner)).send({ reason: 'x', severe: true });
      expect((await request(app).post(url(wid, target.id, 'unkick')).set('Cookie', as(owner))).status).toBe(200);
      const wm = await pool.query(`SELECT removed_at, removed_reason FROM workspace_members WHERE workspace_id=$1 AND user_id=$2`, [wid, target.id]);
      expect(wm.rows[0].removed_at).toBeNull();
      expect(wm.rows[0].removed_reason).toBeNull();
    });
  });
});
