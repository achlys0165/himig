import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

// Layout
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminSchedule from './pages/AdminSchedule';
import AdminSongs from './pages/AdminSongs';
import MusicianDashboard from './pages/MusicianDashboard';
import SchedulePage from './pages/SchedulePage';
import SetlistPage from './pages/SetlistPage';
import SearchPage from './pages/SearchPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean; superAdminOnly?: boolean }> = ({ 
  children, 
  adminOnly = false,
  superAdminOnly = false
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (superAdminOnly && user.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (adminOnly && !['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Layout Wrapper for protected routes
const ProtectedLayout: React.FC<{ adminOnly?: boolean; superAdminOnly?: boolean }> = ({ 
  adminOnly = false,
  superAdminOnly = false
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (superAdminOnly && user.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (adminOnly && !['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Public Route - redirects to dashboard if already logged in
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (user) {
    return <Navigate to={user.role === 'super_admin' ? '/super-admin' : user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes - Login at root "/" */}
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      {/* Musician Routes */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<MusicianDashboard />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/setlist" element={<SetlistPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedLayout adminOnly />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-schedule" element={<AdminSchedule />} />
        <Route path="/admin-songs" element={<AdminSongs />} />
      </Route>

      {/* Super Admin Routes */}
      <Route element={<ProtectedLayout superAdminOnly />}>
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/users" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/logs" element={<SuperAdminDashboard />} />
      </Route>

      {/* Catch all - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <AppRoutes />
        </Router>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;