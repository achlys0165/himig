import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { turso } from '../lib/turso';
import { Song, Schedule, Setlist, AppNotification, ScheduleStatus, ScheduleStatusType } from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  songs: Song[];
  schedules: Schedule[];
  setlists: Setlist[];
  notifications: AppNotification[];
  loading: boolean;
  addSong: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  assignMusician: (assignment: { musician_id: string; date: string; role: string }) => Promise<void>;
  removeSchedule: (scheduleId: string) => Promise<void>;
  updateScheduleStatus: (scheduleId: string, status: ScheduleStatusType, declineReason?: string) => Promise<void>;
  updateSetlist: (setlist: { date: string; song_ids: string[] | { song_id: string; category: string; order: number }[] }) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  refreshData: () => Promise<void>;
  showNotificationPopup: boolean;
  latestNotification: AppNotification | null;
  dismissNotificationPopup: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [latestNotification, setLatestNotification] = useState<AppNotification | null>(null);
  const [lastCheckedNotificationId, setLastCheckedNotificationId] = useState<string | null>(null);

  // Send browser push notification
  const sendPushNotification = async (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'himig-notification',
    });

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

  // Send email notification via API
  const sendEmailNotification = async (to: string, subject: string, text: string, html?: string) => {
    try {
      if (!to) {
        console.log('No email address provided, skipping email');
        return;
      }
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text,
          html: html || text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Email API error:', error);
        // Don't throw - email is non-critical
      } else {
        console.log(`Email sent successfully to ${to}`);
      }
    } catch (error) {
      console.error('Email send failed:', error);
      // Don't throw - email is non-critical
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
      
      const typedNotifications: AppNotification[] = rows.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        message: row.message,
        type: row.type || 'info',
        read: Boolean(row.read),
        created_at: row.created_at
      }));
      
      if (typedNotifications.length > 0) {
        const latest = typedNotifications[0];
        if (lastCheckedNotificationId && latest.id !== lastCheckedNotificationId && !latest.read) {
          setLatestNotification(latest);
          setShowNotificationPopup(true);
          sendPushNotification('HIMIG - New Assignment', latest.message);
        }
        setLastCheckedNotificationId(latest.id);
      }
      
      setNotifications(typedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user, lastCheckedNotificationId]);

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
    }, 2000);
    
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
      
      const { rows: users } = await turso.execute({
        sql: 'SELECT id, email, name FROM users WHERE is_active = 1'
      });
      
      const message = `New song added to the library: "${songData.title}" (${songData.category}, Key: ${songData.original_key})`;
      
      for (const u of users) {
        const userData = u as any;
        
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            'notif-' + Date.now() + '-' + userData.id,
            userData.id,
            message,
            'info',
            false
          ]
        });
        
        sendPushNotification('HIMIG - New Song', message);
        
        if (userData.email) {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>New Song - HIMIG Music Ministry</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #000000;">
                <tr>
                  <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 600px; background-color: #0a0a0a; border-radius: 24px; border: 1px solid #222; overflow: hidden;">
                      <tr>
                        <td style="background-color: #000; padding: 40px; text-align: center; border-bottom: 1px solid #222;">
                          <div style="width: 60px; height: 60px; background-color: #fff; border-radius: 16px; display: inline-block; line-height: 60px; text-align: center; margin-bottom: 20px;">
                            <span style="color: #000; font-size: 32px; font-weight: 900; font-style: italic;">H</span>
                          </div>
                          <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">HIMIG</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="color: #fff; margin: 0 0 20px; font-size: 20px; font-weight: bold;">New Song Added</h2>
                          <p style="color: #999; margin: 0 0 30px; line-height: 1.6; font-size: 14px;">
                            Hi <strong style="color: #fff;">${userData.name}</strong>,<br><br>
                            A new song has been added to the HIMIG library:
                          </p>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #000; border-radius: 16px; border: 1px solid #333; margin-bottom: 30px;">
                            <tr>
                              <td style="padding: 30px;">
                                <p style="color: #666; margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Title</p>
                                <p style="color: #fff; margin: 0 0 20px; font-size: 24px; font-weight: bold; font-style: italic;">${songData.title}</p>
                                <p style="color: #666; margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Category</p>
                                <p style="color: #fff; margin: 0 0 20px; font-size: 18px; font-weight: bold;">${songData.category}</p>
                                <p style="color: #666; margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Key</p>
                                <p style="color: #fff; margin: 0; font-size: 18px; font-weight: bold;">${songData.original_key}</p>
                              </td>
                            </tr>
                          </table>
                          <a href="https://top-himig.vercel.app/search" style="display: inline-block; width: 100%; background-color: #fff; color: #000; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; text-align: center; box-sizing: border-box;">
                            View in Library
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          await sendEmailNotification(
            userData.email,
            'New Song Added - HIMIG',
            `Hi ${userData.name},\n\nA new song has been added to the HIMIG library:\n\nTitle: ${songData.title}\nCategory: ${songData.category}\nKey: ${songData.original_key}\n\nLog in to view the full details and lyrics.\n\nBest regards,\nTOP Music Ministry Team`,
            emailHtml
          );
        }
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
    
      const { rows: musicianRows } = await turso.execute({
        sql: 'SELECT name, email FROM users WHERE id = ?',
        args: [assignment.musician_id]
      });
      
      const musician = musicianRows[0] as any;
      const musicianName = musician?.name || 'Musician';
      const musicianEmail = musician?.email;

      // Generate secure tokens for email actions
      const acceptToken = btoa(`${scheduleId}:${assignment.musician_id}:${assignment.date}`);
      const declineToken = acceptToken;// Same token works for both actions
            
      const acceptUrl = `https://top-himig.vercel.app/api/email-action?scheduleId=${scheduleId}&action=accept&token=${encodeURIComponent(acceptToken)}`;
      const declineUrl = `https://top-himig.vercel.app/api/email-action?scheduleId=${scheduleId}&action=decline&token=${encodeURIComponent(declineToken)}`;
      const appUrl = 'https://top-himig.vercel.app';
    
      const notifId = 'notif-' + Date.now();
      const message = `You have been assigned as ${assignment.role} on ${assignment.date}`;
      
      await turso.execute({
        sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
              VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          notifId,
          assignment.musician_id,
          message,
          'info',
          false
        ]
      });

      sendPushNotification('HIMIG - New Assignment', message);
      
      if (musicianEmail) {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!-- Add plaintext version -->
            <meta name="format-detection" content="telephone=no, date=no, address=no">
            <title>New Assignment - HIMIG Music Ministry</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
            <!-- Preheader text (hidden) -->
            <div style="display: none; max-height: 0; overflow: hidden;">
              You have been assigned as ${assignment.role} for ${assignment.date}. Click to accept or decline.
            </div>
            
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f4f4f4;">
              <tr>
                <td align="center" style="padding: 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header with text (not just image) -->
                    <tr>
                      <td style="background-color: #000000; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; font-style: italic;">HIMIG</h1>
                        <p style="color: #cccccc; margin: 5px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">TOP Music Ministry</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="color: #333333; margin: 0 0 20px; line-height: 1.6; font-size: 16px;">
                          Hi <strong>${musicianName}</strong>,
                        </p>
                        <p style="color: #333333; margin: 0 0 30px; line-height: 1.6; font-size: 16px;">
                          You have been assigned as <strong>${assignment.role}</strong> for the upcoming service:
                        </p>
                        
                        <!-- Assignment Box -->
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f9f9f9; border-left: 4px solid #000000; margin-bottom: 30px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="color: #666666; margin: 0 0 5px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Service Date</p>
                              <p style="color: #000000; margin: 0 0 15px; font-size: 20px; font-weight: bold;">
                                ${new Date(assignment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                              <p style="color: #666666; margin: 0 0 5px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Your Role</p>
                              <p style="color: #000000; margin: 0; font-size: 18px; font-weight: bold;">${assignment.role}</p>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #666666; margin: 0 0 25px; line-height: 1.6; font-size: 14px;">
                          Please respond by clicking one of the buttons below:
                        </p>
                        
                        <!-- Buttons -->
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                          <tr>
                            <td style="padding-bottom: 10px;">
                              <a href="${acceptUrl}" style="display: block; width: 100%; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 15px; border-radius: 6px; font-weight: bold; font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                                ✓ Accept Assignment
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <a href="${declineUrl}" style="display: block; width: 100%; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 15px; border-radius: 6px; font-weight: bold; font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                                ✕ Unable to Serve
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #999999; margin: 25px 0 0; font-size: 12px; text-align: center;">
                          Or log in at <a href="https://top-himig.vercel.app" style="color: #000000; text-decoration: underline;">top-himig.vercel.app</a>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f4f4f4; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="color: #999999; margin: 0; font-size: 12px; line-height: 1.6;">
                          This is an automated notification from HIMIG Music Ministry.<br>
                          If you have questions, contact your ministry coordinator.
                        </p>
                        <p style="color: #bbbbbb; margin: 10px 0 0; font-size: 11px;">
                          Sent to ${musicianEmail}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        const emailText = `
Hi ${musicianName},

You have been assigned as ${assignment.role} for the service on ${assignment.date}.

ACCEPT: ${acceptUrl}
DECLINE: ${declineUrl}

Or log in to HIMIG: ${appUrl}

TOP Music Ministry Team
        `;

        await sendEmailNotification(
          musicianEmail,
          'New Assignment - HIMIG Music Ministry',
          emailText,
          emailHtml
        );
      }
    
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

  const updateScheduleStatus = async (scheduleId: string, status: ScheduleStatusType, declineReason?: string) => {
    try {
      await turso.execute({
        sql: 'UPDATE schedules SET status = ?, decline_reason = ? WHERE id = ?',
        args: [status, declineReason || null, scheduleId]
      });
      
      const { rows } = await turso.execute({
        sql: `SELECT s.*, u.name as musician_name, u.id as musician_id, u.email as musician_email
              FROM schedules s 
              JOIN users u ON s.musician_id = u.id 
              WHERE s.id = ?`,
        args: [scheduleId]
      });
      
      if (rows.length === 0) {
        throw new Error('Schedule not found');
      }
      
      const schedule = rows[0] as any;
      
      const { rows: admins } = await turso.execute({
        sql: "SELECT id, email, name FROM users WHERE role IN ('admin', 'super_admin')"
      });
      
      let message = `${schedule.musician_name} ${status} the assignment for ${schedule.role} on ${schedule.date}`;
      if (status === ScheduleStatus.REJECTED && declineReason) {
        message += `. Reason: ${declineReason}`;
      }
      
      for (const admin of admins) {
        const adminData = admin as any;
        const notifId = 'notif-' + Date.now() + '-' + adminData.id;
        
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            notifId,
            adminData.id,
            message,
            'info',
            false
          ]
        });

        if (adminData.email) {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Assignment Update - HIMIG</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #000000;">
                <tr>
                  <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 600px; background-color: #0a0a0a; border-radius: 24px; border: 1px solid #222;">
                      <tr>
                        <td style="padding: 40px; text-align: center;">
                          <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 900; font-style: italic;">HIMIG</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="color: #fff; margin: 0 0 20px; font-size: 20px;">Assignment Response</h2>
                          <p style="color: #999; margin: 0 0 30px; line-height: 1.6; font-size: 14px;">
                            <strong style="color: #fff;">${schedule.musician_name}</strong> has 
                            <strong style="color: ${status === 'accepted' ? '#22c55e' : '#ef4444'};">${status}</strong> 
                            the assignment for <strong style="color: #fff;">${schedule.role}</strong> on 
                            <strong style="color: #fff;">${schedule.date}</strong>.
                            ${declineReason ? `<br><br>Reason: <em>${declineReason}</em>` : ''}
                          </p>
                          <a href="https://top-himig.vercel.app/admin-schedule" style="display: inline-block; background-color: #fff; color: #000; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                            View Schedule
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          await sendEmailNotification(
            adminData.email,
            `Assignment ${status} - HIMIG`,
            `Hi ${adminData.name},\n\n${message}.\n\n${status === ScheduleStatus.REJECTED && declineReason ? `Reason provided: ${declineReason}\n\n` : ''}Please check the schedule for updates.\n\nBest regards,\nHIMIG System`,
            emailHtml
          );
        }
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
      
      const { rows: users } = await turso.execute({
        sql: 'SELECT id, email, name FROM users WHERE is_active = 1'
      });
      
      for (const u of users) {
        const userData = u as any;
        
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            'notif-' + Date.now() + '-' + userData.id,
            userData.id,
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