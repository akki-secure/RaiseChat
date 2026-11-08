import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON, AuthenticationResponseJSON, AuthenticatorTransport,
} from '@simplewebauthn/server';
import pool from '../../config/db.js';

export const CHALLENGE_COOKIE = 'passkey_challenge';
export const CHALLENGE_EXPIRES_MS = 5 * 60 * 1000; // 5分

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}
const rpID = () => process.env.WEBAUTHN_RP_ID || 'localhost';
const rpName = () => process.env.WEBAUTHN_RP_NAME || 'RaiseChat';
const origin = () => process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// チャレンジ署名（purpose で登録用/認証用を区別）
export function signChallenge(challenge: string, purpose: 'register' | 'authenticate', userId: string): string {
  return jwt.sign({ challenge, purpose, userId }, secret(), { expiresIn: CHALLENGE_EXPIRES_MS / 1000 });
}
export function readChallenge(token: string | undefined, purpose: 'register' | 'authenticate', userId: string): string | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret()) as { challenge: string; purpose: string; userId: string };
    return p.purpose === purpose && p.userId === userId ? p.challenge : null;
  } catch { return null; }
}

export async function listPasskeys(userId: string) {
  const { rows } = await pool.query(
    'SELECT id, device_name, created_at, last_used_at FROM passkeys WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at',
    [userId]
  );
  return rows;
}
export async function countPasskeys(userId: string): Promise<number> {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM passkeys WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  return rows[0].n;
}

export async function createRegistrationOptions(userId: string, username: string) {
  const { rows } = await pool.query(
    'SELECT credential_id, transports FROM passkeys WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  return generateRegistrationOptions({
    rpName: rpName(), rpID: rpID(),
    userName: username,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: rows.map((r) => ({ id: r.credential_id, transports: r.transports ?? undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, // 指紋等を必須に
  });
}

export async function verifyAndSaveRegistration(
  userId: string, response: RegistrationResponseJSON, expectedChallenge: string, deviceName: string
): Promise<boolean> {
  const v = await verifyRegistrationResponse({
    response, expectedChallenge, expectedOrigin: origin(), expectedRPID: rpID(), requireUserVerification: true,
  });
  if (!v.verified || !v.registrationInfo) return false;
  const { credential } = v.registrationInfo;
  await pool.query(
    `INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports, device_name)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, credential.id, Buffer.from(credential.publicKey), credential.counter, credential.transports ?? null, deviceName]
  );
  return true;
}

export async function createAuthenticationOptions(userId: string) {
  const { rows } = await pool.query(
    'SELECT credential_id, transports FROM passkeys WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
  return generateAuthenticationOptions({
    rpID: rpID(), userVerification: 'required',
    allowCredentials: rows.map((r) => ({ id: r.credential_id, transports: r.transports ?? undefined })),
  });
}

export async function verifyAuthentication(
  userId: string, response: AuthenticationResponseJSON, expectedChallenge: string
): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id, credential_id, public_key, counter, transports FROM passkeys WHERE user_id = $1 AND credential_id = $2 AND deleted_at IS NULL',
    [userId, response.id]
  );
  const pk = rows[0];
  if (!pk) return false;
  const v = await verifyAuthenticationResponse({
    response, expectedChallenge, expectedOrigin: origin(), expectedRPID: rpID(), requireUserVerification: true,
    credential: {
      id: pk.credential_id,
      publicKey: new Uint8Array(pk.public_key),
      counter: Number(pk.counter),
      transports: (pk.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    },
  });
  if (!v.verified) return false;
  await pool.query('UPDATE passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2', [v.authenticationInfo.newCounter, pk.id]);
  return true;
}
