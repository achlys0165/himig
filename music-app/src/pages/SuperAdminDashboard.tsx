import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Users, Shield, Activity, Trash2, UserCheck, UserX, Crown } from 'lucide-react';
import { turso } from '../lib/turso';
import { useNavigate } from 'react-router-dom';

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'stats'>('users');

  useEffect(() => {
    if (user?.role !== UserRole.SUPER_ADMIN) {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  const fetchUsers = async () => {
    const { rows } = await turso.execute({
      sql: 'SELECT id, username, name, email, role, instrument, is_active, created_at FROM users ORDER BY created_at DESC'
    });
    setUsers(rows);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    await turso.execute({
      sql: 'UPDATE users SET is_active = ? WHERE id = ?',
      args: [!currentStatus, userId]
    });
    fetchUsers();
  };

  const promoteToAdmin = async (userId: string) => {
    if (!confirm('Promote this user to Admin?')) return;
    await turso.execute({
      sql: "UPDATE users SET role = 'admin' WHERE id = ?",
      args: [userId]
    });
    fetchUsers();
  };

  const demoteToMusician = async (userId: string) => {
    if (!confirm('Demote this admin to Musician?')) return;
    await turso.execute({
      sql: "UPDATE users SET role = 'musician' WHERE id = ?",
      args: [userId]
    });
    fetchUsers();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('PERMANENTLY delete this user? This cannot be undone!')) return;
    await turso.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [userId]
    });
    fetchUsers();
  };

  const stats = {
    total: users.length,
    superAdmins: users.filter(u => u.role === 'super_admin').length,
    admins: users.filter(u => u.role === 'admin').length,
    musicians: users.filter(u => u.role === 'musician').length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
          <Crown className="text-purple-400" /> Super Admin
        </h1>
        <p className="text-white/40 mt-1 uppercase text-xs tracking-[0.2em]">
          System oversight and user management
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users },
          { label: 'Super Admins', value: stats.superAdmins, icon: Crown, color: 'text-purple-400' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-blue-400' },
          { label: 'Musicians', value: stats.musicians, icon: Activity, color: 'text-green-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl">
            <stat.icon size={20} className={`mb-2 ${stat.color || 'text-white'}`} />
            <p className="text-3xl font-black italic">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-white/10">
        {['users', 'stats'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab 
                ? 'text-white border-b-2 border-white' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr className="text-[10px] uppercase tracking-widest text-white/40">
                <th className="px-6 py-4 text-left font-black">User</th>
                <th className="px-6 py-4 text-left font-black">Role</th>
                <th className="px-6 py-4 text-left font-black">Status</th>
                <th className="px-6 py-4 text-right font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold">{u.name}</p>
                      <p className="text-xs text-white/40">@{u.username}</p>
                      {u.email && <p className="text-[10px] text-white/30">{u.email}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full ${
                      u.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400' :
                      u.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleUserStatus(u.id, u.is_active)}
                      className={`flex items-center gap-2 text-xs font-bold ${
                        u.is_active ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {u.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'musician' && (
                        <button
                          onClick={() => promoteToAdmin(u.id)}
                          className="p-2 text-white/40 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                          title="Promote to Admin"
                        >
                          <Shield size={16} />
                        </button>
                      )}
                      {u.role === 'admin' && (
                        <button
                          onClick={() => demoteToMusician(u.id)}
                          className="p-2 text-white/40 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-all"
                          title="Demote to Musician"
                        >
                          <Users size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4">User Activity</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white/60">Active Users</span>
                <span className="text-green-400 font-bold">{stats.active}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">Inactive Users</span>
                <span className="text-red-400 font-bold">{stats.inactive}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;