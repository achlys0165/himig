import React, { useMemo, useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { ScheduleStatus } from '../types';
import { turso } from '../lib/turso';
import { 
  Users, Music, Clock, CheckCircle, 
  ArrowUpRight, ShieldCheck, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const { songs, schedules, loading } = useData();
  const [musicianCount, setMusicianCount] = useState(0);

  // Get musician count from Turso
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { rows } = await turso.execute({
          sql: "SELECT COUNT(*) as count FROM users WHERE role = 'musician'"
        });
        setMusicianCount(Number(rows[0]?.count || 0));
      } catch (error) {
        console.error('Error fetching count:', error);
      }
    };
    fetchCount();
  }, []);

  const stats = useMemo(() => {
    const pending = schedules.filter(s => s.status === ScheduleStatus.PENDING).length;
    const accepted = schedules.filter(s => s.status === ScheduleStatus.ACCEPTED).length;

    return {
      totalSongs: songs.length,
      pendingResponses: pending,
      acceptedAssignments: accepted,
      totalTeam: musicianCount
    };
  }, [songs, schedules, musicianCount]);

  const recentResponses = useMemo(() => {
    return schedules
      .filter(s => s.status !== ScheduleStatus.PENDING)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [schedules]);

  if (loading) {
    return <div className="text-white/40 text-center py-20">Loading...</div>;
  }

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Admin Hub</h1>
          <p className="text-white/40 mt-1 uppercase text-xs tracking-[0.2em]">Ministry Oversight & Analytics</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
           <ShieldCheck size={14} className="text-white" />
           <span className="text-[10px] font-black uppercase tracking-widest">Master Auth Level</span>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Song Vault', value: stats.totalSongs, icon: Music, color: 'white' },
          { label: 'Active Team', value: stats.totalTeam, icon: Users, color: 'white' },
          { label: 'Confirmed Duties', value: stats.acceptedAssignments, icon: CheckCircle, color: 'green-500' },
          { label: 'Awaiting Response', value: stats.pendingResponses, icon: Clock, color: 'yellow-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}/5 blur-2xl -mr-12 -mt-12 group-hover:bg-${stat.color}/10 transition-all`}></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="p-2.5 bg-white/5 rounded-xl">
                <stat.icon size={20} className={stat.color === 'white' ? 'text-white' : `text-${stat.color}`} />
              </div>
            </div>
            <div className="mt-6 relative z-10">
              <p className="text-4xl font-black italic tracking-tighter">{stat.value}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/30 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Team Activity */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black italic uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-white/20" /> Recent Team Responses
              </h3>
              <Link to="/notifications" className="text-[10px] font-bold text-white/40 hover:text-white transition-colors flex items-center gap-1">
                View All Activity <ArrowUpRight size={12} />
              </Link>
           </div>
           <div className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden">
             {recentResponses.length > 0 ? (
               <div className="divide-y divide-white/5">
                 {recentResponses.map((res) => (
                   <div key={res.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black italic text-sm">
                         {res.musician?.name?.charAt(0) || '?'}
                       </div>
                       <div>
                          <p className="font-bold text-base">{res.musician?.name || 'Unknown'}</p>
                          <p className="text-[10px] uppercase tracking-widest text-white/30">{res.role} • {res.date}</p>
                       </div>
                     </div>
                     <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                       res.status === ScheduleStatus.ACCEPTED 
                         ? 'border-green-500/20 text-green-500 bg-green-500/5' 
                         : 'border-red-500/20 text-red-500 bg-red-500/5'
                     }`}>
                       {res.status}
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="p-20 text-center text-white/20 italic">No recent responses recorded.</div>
             )}
           </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-sm font-black italic uppercase tracking-widest px-2">
            Quick Operations
          </h3>
          <div className="grid gap-3">
            {[
              { label: 'Dispatch Schedule', path: '/schedule', icon: Clock, desc: 'Assign roles for Sundays' },
              { label: 'Add New Song', path: '/admin-songs', icon: Zap, desc: 'Update music library' },
              { label: 'Edit Setlists', path: '/setlist', icon: Music, desc: 'Plan service repertoire' },
            ].map((action, i) => (
              <Link 
                key={i} 
                to={action.path}
                className="p-6 bg-[#0a0a0a] border border-white/10 rounded-3xl hover:border-white transition-all group flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-white group-hover:text-black transition-all">
                    <action.icon size={20} />
                  </div>
                  <ArrowUpRight size={18} className="text-white/20 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
                <div>
                  <p className="font-bold text-lg">{action.label}</p>
                  <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest mt-0.5">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;