import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { turso } from '../lib/turso';
import { Song, Schedule, Setlist, Notification, ScheduleStatus } from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  songs: Song[];
  schedules: Schedule[];
  setlists: Setlist[];
  notifications: Notification[];
  loading: boolean;
  addSong: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  assignMusician: (assignment: { musician_id: string; date: string; role: string }) => Promise<void>;
  removeSchedule: (scheduleId: string) => Promise<void>;
  updateScheduleStatus: (scheduleId: string, status: ScheduleStatus, declineReason?: string) => Promise<void>;
  updateSetlist: (setlist: { date: string; song_ids: string[] | { song_id: string; category: string; order: number }[] }) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  refreshData: () => Promise<void>;
  showNotificationPopup: boolean;
  latestNotification: Notification | null;
  dismissNotificationPopup: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);
  const [lastCheckedNotificationId, setLastCheckedNotificationId] = useState<string | null>(null);

  // Send browser push notification
  const sendPushNotification = async (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    // Show native notification
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'himig-notification',
    });

    // Also try service worker for background notifications
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'himig-notification',
        requireInteraction: true,
      });
    }
  };

  const fetchSongs = useCallback(async () => {
    try {
      const { rows } = await turso.execute({
        sql: 'SELECT * FROM songs ORDER BY created_at DESC'
      });
      
      const typedSongs: Song[] = rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        original_key: row.original_key,
        category: row.category,
        lyrics: row.lyrics,
        reference_url: row.reference_url,
        tempo: row.tempo,
        created_at: row.created_at
      }));
      
      setSongs(typedSongs);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const { rows } = await turso.execute({
        sql: `
          SELECT s.*, u.name as musician_name, u.instrument 
          FROM schedules s
          LEFT JOIN users u ON s.musician_id = u.id
          ORDER BY s.date ASC
        `
      });
      
      const transformedRows: Schedule[] = rows.map((row: any) => ({
        id: row.id,
        musician_id: row.musician_id,
        date: row.date,
        role: row.role,
        status: row.status,
        decline_reason: row.decline_reason,
        created_at: row.created_at,
        musician: row.musician_name ? {
          id: row.musician_id,
          name: row.musician_name,
          instrument: row.instrument
        } : undefined
      }));
      
      setSchedules(transformedRows);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  }, []);

  const fetchSetlists = useCallback(async () => {
    try {
      const { rows } = await turso.execute({
        sql: 'SELECT * FROM setlists ORDER BY date DESC'
      });
      
      const typedSetlists: Setlist[] = rows.map((row: any) => ({
        id: row.id,
        date: row.date,
        song_ids: row.song_ids ? JSON.parse(row.song_ids) : [],
        created_at: row.created_at
      }));
      
      setSetlists(typedSetlists);
    } catch (error) {
      console.error('Error fetching setlists:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { rows } = await turso.execute({
        sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
        args: [user.id]
      });
      
      const typedNotifications: Notification[] = rows.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        message: row.message,
        type: row.type || 'info',
        read: Boolean(row.read),
        created_at: row.created_at
      }));
      
      // Check for new notifications
      if (typedNotifications.length > 0) {
        const latest = typedNotifications[0];
        if (lastCheckedNotificationId && latest.id !== lastCheckedNotificationId && !latest.read) {
          setLatestNotification(latest);
          setShowNotificationPopup(true);
          
          // Send browser push notification
          sendPushNotification('HIMIG - New Assignment', latest.message);
        }
        setLastCheckedNotificationId(latest.id);
      }
      
      setNotifications(typedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user, lastCheckedNotificationId]);

  // Listen for real-time refresh events
  useEffect(() => {
    const handleRefresh = () => {
      if (user) {
        fetchNotifications();
      }
    };
    
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 2000); // 2 second polling for real-time feel
    
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSongs(),
        fetchSchedules(),
        fetchSetlists(),
        fetchNotifications()
      ]);
      setLoading(false);
    };
    
    if (user) {
      loadAllData();
    }
  }, [user, fetchSongs, fetchSchedules, fetchSetlists, fetchNotifications]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchSongs(),
      fetchSchedules(),
      fetchSetlists(),
      fetchNotifications()
    ]);
    setLoading(false);
  }, [fetchSongs, fetchSchedules, fetchSetlists, fetchNotifications]);

  const addSong = async (songData: Omit<Song, 'id' | 'created_at'>) => {
    try {
      const id = 'song-' + Date.now();
      await turso.execute({
        sql: `INSERT INTO songs (id, title, original_key, category, lyrics, reference_url, tempo, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          id,
          songData.title,
          songData.original_key,
          songData.category,
          songData.lyrics || '',
          songData.reference_url || '',
          songData.tempo || ''
        ]
      });
      
      // Notify all users
      const { rows: users } = await turso.execute({
        sql: 'SELECT id FROM users WHERE is_active = 1'
      });
      
      for (const u of users) {
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            'notif-' + Date.now() + '-' + (u as any).id,
            (u as any).id,
            `New song added: ${songData.title}`,
            'info',
            false
          ]
        });
        
        // Send push notification
        sendPushNotification('HIMIG - New Song', `New song added: ${songData.title}`);
      }
      
      await fetchSongs();
      await fetchNotifications();
    } catch (error) {
      console.error('Error adding song:', error);
      throw error;
    }
  };

  const assignMusician = async (assignment: { musician_id: string; date: string; role: string }) => {
    try {
      const { rows: existing } = await turso.execute({
        sql: 'SELECT id FROM schedules WHERE date = ? AND role = ?',
        args: [assignment.date, assignment.role]
      });
    
      if (existing.length > 0) {
        throw new Error(`Position ${assignment.role} is already filled for this date`);
      }
    
      const scheduleId = 'sched-' + Date.now();
      await turso.execute({
        sql: `INSERT INTO schedules (id, musician_id, date, role, status, decline_reason, created_at) 
             VALUES (?, ?, ?, ?, ?, NULL, datetime('now'))`,
        args: [
          scheduleId,
          assignment.musician_id,
          assignment.date,
          assignment.role,
          ScheduleStatus.PENDING
        ]
      });
    
      // Get musician details for notification
      const { rows: musicianRows } = await turso.execute({
        sql: 'SELECT name, email FROM users WHERE id = ?',
        args: [assignment.musician_id]
      });
      
      const musicianName = (musicianRows[0] as any)?.name || 'Musician';
    
      const notifId = 'notif-' + Date.now();
      await turso.execute({
        sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
              VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          notifId,
          assignment.musician_id,
          `You have been assigned as ${assignment.role} on ${assignment.date}`,
          'info',
          false
        ]
      });

      // Send push notification to assigned musician
      sendPushNotification(
        'HIMIG - New Assignment', 
        `You have been assigned as ${assignment.role} on ${assignment.date}`
      );
    
      await fetchSchedules();
      await fetchNotifications();
    } catch (error) {
      console.error('Error in assignMusician:', error);
      throw error;
    }
  };

  const removeSchedule = async (scheduleId: string) => {
    try {
      const { rows } = await turso.execute({
        sql: 'SELECT * FROM schedules WHERE id = ?',
        args: [scheduleId]
      });
      
      if (rows.length === 0) {
        throw new Error('Schedule not found');
      }
      
      const schedule = rows[0] as any;
      
      await turso.execute({
        sql: 'DELETE FROM schedules WHERE id = ?',
        args: [scheduleId]
      });
      
      await turso.execute({
        sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
              VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          'notif-' + Date.now(),
          schedule.musician_id,
          `Your assignment as ${schedule.role} on ${schedule.date} has been removed`,
          'warning',
          false
        ]
      });
      
      await fetchSchedules();
      await fetchNotifications();
    } catch (error) {
      console.error('Error removing schedule:', error);
      throw error;
    }
  };

  const updateScheduleStatus = async (scheduleId: string, status: ScheduleStatus, declineReason?: string) => {
    try {
      await turso.execute({
        sql: 'UPDATE schedules SET status = ?, decline_reason = ? WHERE id = ?',
        args: [status, declineReason || null, scheduleId]
      });
      
      const { rows } = await turso.execute({
        sql: `SELECT s.*, u.name as musician_name, u.id as musician_id 
              FROM schedules s 
              JOIN users u ON s.musician_id = u.id 
              WHERE s.id = ?`,
        args: [scheduleId]
      });
      
      if (rows.length === 0) {
        throw new Error('Schedule not found');
      }
      
      const schedule = rows[0] as any;
      
      // Notify admins
      const { rows: admins } = await turso.execute({
        sql: "SELECT id FROM users WHERE role IN ('admin', 'super_admin')"
      });
      
      for (const admin of admins) {
        const adminId = (admin as any).id;
        const notifId = 'notif-' + Date.now() + '-' + adminId;
        
        let message = `${schedule.musician_name} ${status} the assignment for ${schedule.role} on ${schedule.date}`;
        if (status === ScheduleStatus.REJECTED && declineReason) {
          message += `. Reason: ${declineReason}`;
        }
        
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            notifId,
            adminId,
            message,
            'info',
            false
          ]
        });
      }
      
      await fetchSchedules();
      await fetchNotifications();
    } catch (error) {
      console.error('Error in updateScheduleStatus:', error);
      throw error;
    }
  };

  const updateSetlist = async (setlistData: { 
    date: string; 
    song_ids: string[] | { song_id: string; category: string; order: number }[] 
  }) => {
    try {
      const { rows: existing } = await turso.execute({
        sql: 'SELECT id FROM setlists WHERE date = ?',
        args: [setlistData.date]
      });
      
      const songIdsJson = JSON.stringify(setlistData.song_ids);
      
      if (existing.length > 0) {
        await turso.execute({
          sql: 'UPDATE setlists SET song_ids = ? WHERE date = ?',
          args: [songIdsJson, setlistData.date]
        });
      } else {
        await turso.execute({
          sql: `INSERT INTO setlists (id, date, song_ids, created_at) 
                VALUES (?, ?, ?, datetime('now'))`,
          args: [
            'setlist-' + Date.now(),
            setlistData.date,
            songIdsJson
          ]
        });
      }
      
      // Notify all users about setlist update
      const { rows: users } = await turso.execute({
        sql: 'SELECT id FROM users WHERE is_active = 1'
      });
      
      for (const u of users) {
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            'notif-' + Date.now() + '-' + (u as any).id,
            (u as any).id,
            `Setlist updated for ${setlistData.date}`,
            'info',
            false
          ]
        });
      }
      
      await fetchSetlists();
      await fetchNotifications();
    } catch (error) {
      console.error('Error updating setlist:', error);
      throw error;
    }
  };

  const markNotificationsRead = async () => {
    if (!user) return;
    try {
      await turso.execute({
        sql: 'UPDATE notifications SET read = ? WHERE user_id = ? AND read = ?',
        args: [true, user.id, false]
      });
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notifications read:', error);
    }
  };

  const dismissNotificationPopup = () => {
    setShowNotificationPopup(false);
    setLatestNotification(null);
  };

  const value: DataContextType = {
    songs,
    schedules,
    setlists,
    notifications,
    loading,
    addSong,
    assignMusician,
    removeSchedule,
    updateScheduleStatus,
    updateSetlist,
    markNotificationsRead,
    refreshData,
    showNotificationPopup,
    latestNotification,
    dismissNotificationPopup
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};