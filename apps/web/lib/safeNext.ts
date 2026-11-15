// ログイン後の戻り先（?next=）を安全に扱う。
// 外部サイトへ誘導されないよう、招待ページ（/invite/<コード>）だけを許可し、それ以外は '/' にする。
const INVITE_PATH = /^\/invite\/[0-9a-zA-Z]{1,64}$/;

export function safeNextPath(next: string | null | undefined): string {
  if (typeof next === 'string' && INVITE_PATH.test(next)) return next;
  return '/';
}

/** 現在のURLの ?next= を安全な戻り先に直して返す（ブラウザ専用） */
export function nextFromLocation(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}

/** ログイン・登録ページ間のリンクに ?next= を引き継ぐ */
export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}
