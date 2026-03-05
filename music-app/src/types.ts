// User & Authentication
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MUSICIAN = 'musician'
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'musician';
  instrument?: string;
  is_active?: boolean;
}

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

// Schedules
export enum ScheduleStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected'
}

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
  status: ScheduleStatus;
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

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  type: string;
  created_at: string;
}