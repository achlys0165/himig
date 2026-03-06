// User & Authentication
export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'musician';
  instrument?: string;
  is_active?: boolean;
}

// User Role constants
export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MUSICIAN: 'musician'
} as const;

// Songs
export interface Song {
  id: string;
  title: string;
  original_key: string;
  category: 'Worship' | 'Choir' | 'Special';
  tempo?: string;
  lyrics?: string;
  reference_url?: string;
  created_by?: string;
  created_at: string;
}

// Schedule Status constants
export const ScheduleStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
} as const;

export type ScheduleStatusType = typeof ScheduleStatus[keyof typeof ScheduleStatus];

// Schedules
export interface Schedule {
  id: string;
  date: string;
  musician_id: string;
  musician?: {
    id: string;
    name: string;
    instrument?: string;
  };
  role: string;
  status: ScheduleStatusType;
  decline_reason?: string;
  created_at: string;
}

// Setlists
export interface Setlist {
  id: string;
  date: string;
  song_ids: string[];
  theme?: string;
  created_at: string;
}

// App Notification - renamed to avoid conflict with DOM Notification
export interface AppNotification {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  type: string;
  created_at: string;
}