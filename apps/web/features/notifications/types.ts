export type NotificationType = 'new' | 'urgent';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** 通知元のリンク（ワークスペース内チャンネルURLなど） */
  href?: string;
  read: boolean;
  createdAt: string;
}
