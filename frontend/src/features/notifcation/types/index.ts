// src/features/notification/types/index.ts
export interface INotify {
  _id: string;
  recipientId: string;
  senderId: {
    _id: string;
    name: string;
    avatar: string;
  };
  type: "NEW_TRACK" | "SYSTEM" | "LIKE_TRACK";
  relatedId?: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface NotifyResponse {
  list: INotify[];
  unreadCount: number;
}
