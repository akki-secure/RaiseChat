import { authenticator } from 'otplib';
import qrcode from 'qrcode';

const APP_NAME = 'RaiseChat';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotpCode(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}

export async function generateQRCodeDataURL(username: string, secret: string): Promise<string> {
  const otpauth = authenticator.keyuri(username, APP_NAME, secret);
  return qrcode.toDataURL(otpauth);
}
