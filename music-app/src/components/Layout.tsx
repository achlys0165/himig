import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Music, Search, Bell, 
  Settings, LogOut, Menu, X, Shield, Users, FileText, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole } from '../types';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { showNotificationPopup, latestNotification, dismissNotificationPopup, notifications } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Real-time notifications - faster polling
  useEffect(() => {
    if (!user) return;
    
    // Poll every 2 seconds for real-time feel
    const interval = setInterval(() => {
      // This will trigger DataContext to refresh
      window.dispatchEvent(new CustomEvent('refresh-data'));
    }, 2000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        window.dispatchEvent(new CustomEvent('refresh-data'));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // Push notification setup
  useEffect(() => {
    if (!user || !('Notification' in window)) return;
    
    // Request permission on load
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register service worker for push
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isAdmin = user?.role === UserRole.ADMIN || isSuperAdmin;

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read && n.user_id === user?.id).length;
  }, [notifications, user?.id]);

  const superAdminNav = [
    { name: 'Super Admin', path: '/super-admin', icon: Shield },
    { name: 'User Management', path: '/super-admin/users', icon: Users },
    { name: 'System Logs', path: '/super-admin/logs', icon: FileText },
    { name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Team Schedule', path: '/admin-schedule', icon: Calendar },
    { name: 'Song Vault', path: '/admin-songs', icon: Music },
    { name: 'Setlists', path: '/setlist', icon: Music },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
  ];

  const adminNav = [
    { name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Team Schedule', path: '/admin-schedule', icon: Calendar },
    { name: 'Song Vault', path: '/admin-songs', icon: Music },
    { name: 'Setlists', path: '/setlist', icon: Music },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
  ];

  const musicianNav = [
    { name: 'My Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Schedule', path: '/schedule', icon: Calendar },
    { name: 'Setlists', path: '/setlist', icon: Music },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount },
  ];

  const navItems = isSuperAdmin ? superAdminNav : isAdmin ? adminNav : musicianNav;

  // Handle notification popup click
  const handleNotificationClick = () => {
    dismissNotificationPopup();
    if (latestNotification?.message.toLowerCase().includes('assigned')) {
      navigate('/schedule');
    } else {
      navigate('/notifications');
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-black text-white items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden relative">
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          transition-transform duration-300 ease-in-out
          border-r border-white/10 bg-[#050505] 
          flex flex-col h-full w-64
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-6 flex items-center justify-between min-h-[80px] shrink-0 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="min-w-[40px] w-10 h-10 bg-white flex items-center justify-center rounded-xl shrink-0">
               <span className="text-black font-black text-2xl italic leading-none">H</span>
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white">
              HIMIG
            </h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white p-2"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const hasBadge = item.badge && item.badge > 0;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all relative
                  ${isActive 
                    ? 'bg-white text-black font-bold shadow-lg' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <div className="relative">
                  <Icon size={22} />
                  {hasBadge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium flex-1">
                  {item.name}
                </span>
                {hasBadge && isMobile && (
                  <span className="text-[10px] font-black text-red-400">
                    {item.badge} NEW
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0 space-y-2">
          <Link
            to="/settings"
            onClick={() => isMobile && setIsSidebarOpen(false)}
            className={`
              flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all
              ${location.pathname === '/settings' 
                ? 'bg-white/10 text-white' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <Settings size={22} />
            <span className="text-sm font-medium">Settings</span>
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-3.5 w-full text-white/60 hover:text-red-400 transition-colors rounded-xl hover:bg-red-400/10 text-left"
          >
            <LogOut size={22} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-black relative overflow-hidden">
        <header className="h-16 lg:h-20 border-b border-white/10 flex items-center justify-between px-4 lg:px-8 bg-black/50 backdrop-blur-md shrink-0 z-30">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg lg:hidden"
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden lg:block text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <Menu size={24} />
              </button>

              <div className="hidden sm:block">
                <h2 className="text-xs font-black uppercase tracking-widest text-white/40">
                  {isSuperAdmin ? 'Super Administrator' : isAdmin ? 'Administrator' : 'Musician'}
                </h2>
                <p className="text-sm font-bold text-white">
                  {location.pathname === '/super-admin' ? 'SUPER ADMIN' :
                   location.pathname === '/admin' ? 'ADMIN DASHBOARD' :
                   location.pathname === '/admin-schedule' ? 'TEAM SCHEDULE' :
                   location.pathname === '/admin-songs' ? 'SONG VAULT' :
                   location.pathname.substring(1).replace(/-/g, ' ').toUpperCase() || 'DASHBOARD'}
                </p>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              {/* Notification bell in header */}
              <Link to="/notifications" className="relative p-2 text-white/60 hover:text-white transition-colors">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
              
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">{user?.name}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
                  {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin Access' : 'Team Member'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-white/70 text-black flex items-center justify-center text-sm font-black italic shadow-lg">
                {user?.name?.charAt(0)}
              </div>
           </div>
        </header>
        
        <main className="flex-1 overflow-y-auto bg-black">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Clickable Notification Popup */}
      {showNotificationPopup && latestNotification && (
        <div 
          onClick={handleNotificationClick}
          className="fixed top-16 sm:top-20 left-4 right-4 sm:left-auto sm:right-4 z-[60] animate-slide-in-right cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="bg-[#0a0a0a] border border-white/20 rounded-2xl p-4 shadow-2xl shadow-white/10 max-w-sm sm:w-80 mx-auto sm:mx-0 hover:border-white/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/10 rounded-xl shrink-0">
                <Bell size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">New Notification</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotificationPopup();
                    }}
                    className="p-1 text-white/40 hover:text-white transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-sm font-bold text-white leading-tight">
                  {latestNotification.message}
                </p>
                <p className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                  <span>Click to view</span>
                  <ChevronRight size={10} />
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;