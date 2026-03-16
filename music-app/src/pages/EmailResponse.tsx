import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { ScheduleStatus } from '../types';
import { Check, X, Loader2, Music } from 'lucide-react';

type PageState = 'loading' | 'confirm' | 'submitting' | 'success' | 'error' | 'already_responded' | 'login_required';

const EmailResponse: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { schedules, updateScheduleStatus } = useData();

  const scheduleId = searchParams.get('scheduleId');
  const action     = searchParams.get('action') as 'accept' | 'decline' | null;

  const [state, setState]           = useState<PageState>('loading');
  const [declineReason, setDeclineReason] = useState('');
  const [schedule, setSchedule]     = useState<any>(null);
  const [errorMsg, setErrorMsg]     = useState('');

  const isAccept    = action === 'accept';
  const actionColor = isAccept ? '#22c55e' : '#ef4444';
  const actionText  = isAccept ? 'Accept' : 'Decline';

  useEffect(() => {
    if (!scheduleId || !action) {
      setState('error');
      setErrorMsg('Invalid link — missing required parameters.');
      return;
    }

    if (action !== 'accept' && action !== 'decline') {
      setState('error');
      setErrorMsg('Invalid action in link.');
      return;
    }

    // Wait for schedules to load
    if (schedules.length === 0) return;

    const found = schedules.find((s: any) => s.id === scheduleId);

    if (!found) {
      setState('error');
      setErrorMsg('This assignment no longer exists.');
      return;
    }

    if (found.status !== 'pending') {
      setSchedule(found);
      setState('already_responded');
      return;
    }

    // If not logged in, we still show the confirm page but warn them
    setSchedule(found);
    setState('confirm');
  }, [scheduleId, action, schedules]);

  const handleConfirm = async () => {
    if (!scheduleId || !schedule) return;
    if (!isAccept && !declineReason.trim()) return;

    setState('submitting');
    try {
      await updateScheduleStatus(
        scheduleId,
        isAccept ? ScheduleStatus.ACCEPTED : ScheduleStatus.REJECTED,
        isAccept ? undefined : declineReason.trim()
      );
      setState('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit response.');
      setState('error');
    }
  };

  // ── Shared layout wrapper ────────────────────────────────────────────────
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter text-white">HIMIG</h1>
          <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mt-1">Music Ministry</p>
        </div>
        {children}
      </div>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <Wrapper>
        <div className="text-center py-20">
          <Loader2 className="animate-spin mx-auto text-white/40" size={32} />
          <p className="text-white/30 text-sm mt-4 uppercase tracking-widest">Loading assignment...</p>
        </div>
      </Wrapper>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <Wrapper>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <X size={28} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black italic mb-3">Not Found</h2>
          <p className="text-white/40 text-sm leading-relaxed mb-8">{errorMsg}</p>
          <button
            onClick={() => navigate('/schedule')}
            className="w-full py-3.5 bg-white text-black font-black uppercase text-xs tracking-widest rounded-full hover:bg-white/90 transition-all"
          >
            Go to My Schedule
          </button>
        </div>
      </Wrapper>
    );
  }

  // ── Already responded ────────────────────────────────────────────────────
  if (state === 'already_responded' && schedule) {
    const wasAccepted = schedule.status === ScheduleStatus.ACCEPTED;
    return (
      <Wrapper>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-10 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${wasAccepted ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {wasAccepted ? <Check size={28} className="text-green-500" /> : <X size={28} className="text-red-500" />}
          </div>
          <h2 className="text-2xl font-black italic mb-2">Already Responded</h2>
          <p className="text-white/40 text-sm mb-6">You have already responded to this assignment.</p>
          <div className="bg-black border border-white/5 rounded-2xl p-5 text-left mb-8 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Role</p>
              <p className="font-bold text-sm">{schedule.role}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Date</p>
              <p className="font-bold text-sm">{schedule.date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${wasAccepted ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                {schedule.status}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/schedule')}
            className="w-full py-3.5 bg-white text-black font-black uppercase text-xs tracking-widest rounded-full hover:bg-white/90 transition-all"
          >
            View My Schedule
          </button>
        </div>
      </Wrapper>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (state === 'success' && schedule) {
    return (
      <Wrapper>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-10 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isAccept ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}
            style={{ borderColor: actionColor + '33', backgroundColor: actionColor + '1a' }}>
            <Check size={28} style={{ color: actionColor }} />
          </div>
          <h2 className="text-2xl font-black italic mb-2">Response Recorded!</h2>
          <p className="text-white/40 text-sm mb-6">Your response has been saved and the admin team has been notified.</p>
          <div className="bg-black border border-white/5 rounded-2xl p-5 text-left mb-8 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Role</p>
              <p className="font-bold text-sm">{schedule.role}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Date</p>
              <p className="font-bold text-sm">{schedule.date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Status</p>
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                style={{ color: actionColor, backgroundColor: actionColor + '1a', border: `1px solid ${actionColor}33` }}>
                {isAccept ? 'Accepted' : 'Declined'}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/schedule')}
            className="w-full py-3.5 bg-white text-black font-black uppercase text-xs tracking-widest rounded-full hover:bg-white/90 transition-all"
          >
            View My Schedule
          </button>
        </div>
      </Wrapper>
    );
  }

  // ── Confirm page ─────────────────────────────────────────────────────────
  if ((state === 'confirm' || state === 'submitting') && schedule) {
    return (
      <Wrapper>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-10">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ borderColor: actionColor + '33', backgroundColor: actionColor + '1a', border: `1px solid ${actionColor}33` }}>
              {isAccept
                ? <Check size={28} style={{ color: actionColor }} />
                : <X size={28} style={{ color: actionColor }} />}
            </div>
            <h2 className="text-2xl font-black italic">{actionText} Assignment?</h2>
            <p className="text-white/40 text-sm mt-2">Please confirm your response below.</p>
          </div>

          {/* Assignment details */}
          <div className="bg-black border border-white/5 rounded-2xl p-5 mb-6 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Role</p>
              <p className="font-bold">{schedule.role}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Date</p>
              <p className="font-bold">{schedule.date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Current Status</p>
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                Pending
              </span>
            </div>
          </div>

          {/* Decline reason */}
          {!isAccept && (
            <div className="mb-6">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 block">
                Reason for declining *
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., I have a family event, I'm out of town..."
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-white/20 focus:border-white/30 outline-none resize-none"
                rows={3}
                disabled={state === 'submitting'}
              />
            </div>
          )}

          {/* Not logged in warning */}
          {!user && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
              <p className="text-yellow-400 text-xs leading-relaxed">
                <strong>Note:</strong> You need to be logged in to respond. Please{' '}
                <button onClick={() => navigate(`/?redirect=${encodeURIComponent(`/email-response?scheduleId=${scheduleId}&action=${action}`)}`)}
                  className="underline hover:text-yellow-300">log in</button>{' '}
                first, then return to this page.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/schedule')}
              disabled={state === 'submitting'}
              className="flex-1 py-3.5 border border-white/10 text-white/60 rounded-full text-xs font-black uppercase tracking-widest hover:border-white/30 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={state === 'submitting' || (!isAccept && !declineReason.trim()) || !user}
              className="flex-1 py-3.5 rounded-full text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: actionColor, color: '#000' }}
            >
              {state === 'submitting'
                ? <><Loader2 size={14} className="animate-spin" /> Submitting...</>
                : `Confirm ${actionText}`}
            </button>
          </div>
        </div>
      </Wrapper>
    );
  }

  return null;
};

export default EmailResponse;
