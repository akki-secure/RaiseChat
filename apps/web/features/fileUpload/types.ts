export interface UploadedAttachment {
  url: string;
  file_type: string;
  size: number;
  /** プレビュー表示用（サーバーには送信しない） */
  name?: string;
}
