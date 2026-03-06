import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Bell, CheckCircle2, Circle, AlertCircle, Info, Calendar, X, ChevronRight, User, Clock, MapPin } from 'lucide-react';

interface NotificationDetail {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  type: string;
  created_at: string;
  // Parsed details
  musicianName?: string;
  action?: string;
  role?: string;
  date?: string;
}

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { notifications, markNotificationsRead, refreshData } = useData();
  const [selectedNotification, setSelectedNotification] = useState<NotificationDetail | null>(null);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const myNotifications = notifications.filter((n: any) => n.user_id === user?.id);

  const parseNotification = (notification: any): NotificationDetail => {
    const msg = notification.message.toLowerCase();
    
    // Parse assignment notifications
    const assignmentMatch = notification.message.match(/(.+?) has been assigned as (.+?) on (\d{4}-\d{2}-\d{2})/);
    if (assignmentMatch) {
      return {
        ...notification,
        musicianName: assignmentMatch[1],
        action: 'assigned',
        role: assignmentMatch[2],
        date: assignmentMatch[3]
      };
    }

    // Parse accept/reject notifications
    const responseMatch = notification.message.match(/(.+?) (accepted|rejected) the assignment for (.+?) on (\d{4}-\d{2}-\d{2})/);
    if (responseMatch) {
      return {
        ...notification,
        musicianName: responseMatch[1],
        action: responseMatch[2],
        role: responseMatch[3],
        date: responseMatch[4]
      };
    }

    // Parse new song notifications
    const songMatch = notification.message.match(/New song added: (.+)/);
    if (songMatch) {
      return {
        ...notification,
        action: 'new_song',
        role: songMatch[1]
      };
    }

    // Parse setlist update notifications
    const setlistMatch = notification.message.match(/Setlist updated for (\d{4}-\d{2}-\d{2})/);
    if (setlistMatch) {
      return {
        ...notification,
        action: 'setlist_updated',
        date: setlistMatch[1]
      };
    }

    // Parse removal notifications
    const removalMatch = notification.message.match(/Your assignment as (.+?) on (\d{4}-\d{2}-\d{2}) has been removed/);
    if (removalMatch) {
      return {
        ...notification,
        action: 'removed',
        role: removalMatch[1],
        date: removalMatch[2]
      };
    }

    return notification;
  };

  const getIcon = (notification: NotificationDetail) => {
    const msg = notification.message.toLowerCase();
    if (msg.includes('accepted')) return <CheckCircle2 size={20} className="text-green-500" />;
    if (msg.includes('rejected')) return <AlertCircle size={20} className="text-red-500" />;
    if (msg.includes('assigned')) return <Calendar size={20} className="text-blue-500" />;
    if (msg.includes('removed')) return <AlertCircle size={20} className="text-orange-500" />;
    if (msg.includes('setlist')) return <Info size={20} className="text-purple-500" />;
    return <Info size={20} className="text-white/40" />;
  };

  const getActionColor = (action?: string) => {
    switch (action) {
      case 'accepted': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'assigned': return 'text-blue-400';
      case 'removed': return 'text-orange-400';
      case 'new_song': return 'text-purple-400';
      case 'setlist_updated': return 'text-yellow-400';
      default: return 'text-white/60';
    }
  };

  const handleNotificationClick = (notification: any) => {
    const parsed = parseNotification(notification);
    setSelectedNotification(parsed);
    
    // Mark as read if unread
    if (!notification.read) {
      // You might want to mark individual notification as read here
    }
  };

  const closeModal = () => {
    setSelectedNotification(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter uppercase">Activity Feed</h1>
          <p className="text-white/40 mt-1 uppercase text-xs tracking-[0.2em]">
            {myNotifications.filter((n: any) => !n.read).length} unread notifications
          </p>
        </div>
        {myNotifications.some((n: any) => !n.read) && (
          <button 
            onClick={markNotificationsRead}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white flex items-center gap-2 border border-white/10 px-6 py-3 rounded-full transition-all bg-white/5 hover:bg-white/10"
          >
            Mark All Read
          </button>
        )}
      </header>

      <div className="space-y-4">
        {myNotifications.length > 0 ? (
          myNotifications
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((notif: any) => {
              const parsed = parseNotification(notif);
              return (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-6 border-2 rounded-[2rem] transition-all flex items-start gap-6 relative overflow-hidden group cursor-pointer hover:border-white/30 ${
                    notif.read ? 'bg-black border-white/5 text-white/40 opacity-70' : 'bg-[#080808] border-white/10 text-white shadow-xl hover:bg-[#0a0a0a]'
                  }`}
                >
                  {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white"></div>}

                  <div className={`shrink-0 p-4 rounded-3xl ${notif.read ? 'bg-white/5' : 'bg-white/10 group-hover:scale-110 transition-transform duration-500'}`}>
                    {getIcon(parsed)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-2">
                       <p className="text-[10px] uppercase tracking-widest font-black text-white/20">
                         {new Date(notif.created_at).toLocaleDateString(undefined, { 
                           month: 'short', 
                           day: 'numeric', 
                           hour: '2-digit', 
                           minute: '2-digit' 
                         })}
                       </p>
                       {!notif.read && (
                         <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/40">
                           <Circle className="fill-white text-white" size={6} /> New
                         </span>
                       )}
                    </div>
                    <p className={`text-lg font-bold leading-tight tracking-tight ${notif.read ? 'line-through decoration-white/10' : ''}`}>
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-white/30 mt-2 flex items-center gap-1">
                      Click for details <ChevronRight size={10} />
                    </p>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center">
            <Bell className="text-white/5 mb-6" size={64} />
            <p className="text-white/20 italic text-lg">No notifications found.</p>
            <p className="text-white/10 text-[10px] uppercase tracking-widest mt-2">Check back later</p>
          </div>
        )}
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className={`p-4 rounded-2xl bg-white/5`}>
                {getIcon(selectedNotification)}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-white/40">
                  {selectedNotification.type || 'Notification'}
                </p>
                <p className={`text-sm font-bold ${getActionColor(selectedNotification.action)}`}>
                  {selectedNotification.action?.toUpperCase() || 'INFO'}
                </p>
              </div>
            </div>

            <h2 className="text-xl font-bold mb-4 leading-tight">
              {selectedNotification.message}
            </h2>

            <div className="space-y-4 bg-black/40 rounded-2xl p-6 border border-white/5">
              {selectedNotification.musicianName && (
                <div className="flex items-center gap-3">
                  <User size={16} className="text-white/40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Musician</p>
                    <p className="text-sm font-bold">{selectedNotification.musicianName}</p>
                  </div>
                </div>
              )}

              {selectedNotification.role && (
                <div className="flex items-center gap-3">
                  <Bell size={16} className="text-white/40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Role</p>
                    <p className="text-sm font-bold">{selectedNotification.role}</p>
                  </div>
                </div>
              )}

              {selectedNotification.date && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-white/40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Service Date</p>
                    <p className="text-sm font-bold">{formatDate(selectedNotification.date)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Clock size={16} className="text-white/40" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Received</p>
                  <p className="text-sm font-bold">
                    {formatDate(selectedNotification.created_at)} at {formatTime(selectedNotification.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex gap-3">
              <button 
                onClick={closeModal}
                className="flex-1 py-3 border border-white/10 text-white/60 rounded-full text-xs font-black uppercase tracking-widest hover:border-white/30 transition-all"
              >
                Close
              </button>
              {selectedNotification.date && (
                <button 
                  onClick={() => {
                    closeModal();
                    window.location.href = `/setlist?date=${selectedNotification.date}`;
                  }}
                  className="flex-1 py-3 bg-white text-black rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                >
                  View Setlist <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;