import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User as UserIcon, Mail, Shield, Smartphone, Save } from 'lucide-react';
import { turso } from '../lib/turso';

const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    instrument: user?.instrument || ''
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await turso.execute({
        sql: 'UPDATE users SET name = ?, instrument = ? WHERE id = ?',
        args: [formData.name, formData.instrument, user.id]
      });
      await refreshUser(); // Refresh user data in context
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <header>
        <h1 className="text-3xl font-bold italic tracking-tighter">SETTINGS</h1>
        <p className="text-white/40 mt-1 uppercase text-xs tracking-[0.2em]">Manage your profile and preferences</p>
      </header>

      <div className="space-y-10">
        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 border-b border-white/5 pb-2">Profile Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-1">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-white/30 outline-none text-white" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  type="email" 
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white/40 cursor-not-allowed" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-1">Primary Instrument</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  type="text" 
                  value={formData.instrument}
                  onChange={(e) => setFormData({...formData, instrument: e.target.value})}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-white/30 outline-none text-white" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-1">Access Level</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  type="text" 
                  value={user?.role || ''}
                  disabled
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white/40 uppercase tracking-widest text-[10px] font-bold" 
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 border-b border-white/5 pb-2">App Preferences</h3>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl divide-y divide-white/5">
            <div className="p-6 flex items-center justify-between">
               <div>
                  <p className="font-semibold text-sm">Monochrome Dark Mode</p>
                  <p className="text-xs text-white/40">Keep the application in high-contrast black and white.</p>
               </div>
               <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-12 h-6 rounded-full transition-all relative ${isDarkMode ? 'bg-white' : 'bg-white/10'}`}
               >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${isDarkMode ? 'right-1 bg-black' : 'left-1 bg-white'}`} />
               </button>
            </div>
            <div className="p-6 flex items-center justify-between">
               <div>
                  <p className="font-semibold text-sm">System Notifications</p>
                  <p className="text-xs text-white/40">Allow browser alerts for new assignments.</p>
               </div>
               <button className="w-12 h-6 bg-white/10 rounded-full relative">
                  <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white" />
               </button>
            </div>
          </div>
        </section>

        <div className="pt-4">
           <button 
             onClick={handleSave}
             disabled={saving}
             className="flex items-center gap-3 px-10 py-4 bg-white text-black font-black uppercase text-xs tracking-[0.2em] rounded-full hover:bg-white/90 transition-all shadow-xl disabled:opacity-50"
           >
             {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;