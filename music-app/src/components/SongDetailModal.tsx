import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Song } from '../types';
import { X, Plus, Minus, RotateCcw, Copy, Music, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, List } from 'lucide-react';
import Metronome from './Metronome';

// Define locally instead of importing from constants
const CHROMATIC_SCALE = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

interface SongDetailModalProps {
  song: Song | null;
  onClose: () => void;
  // New props for navigation
  songs?: Song[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  category?: string;
}

// Simple swipe hook for mobile
const useSwipe = (onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;

    if (isLeftSwipe) onSwipeLeft();
    if (isRightSwipe) onSwipeRight();
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
};

const SongDetailModal: React.FC<SongDetailModalProps> = ({ 
  song, 
  onClose,
  songs = [],
  currentIndex = 0,
  onNavigate,
  category
}) => {
  const [transposeOffset, setTransposeOffset] = useState(0);
  const [showSongList, setShowSongList] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Reset transpose when song changes
  useEffect(() => {
    setTransposeOffset(0);
  }, [song?.id]);

  // Extract numeric BPM from tempo string
  const songBpm = useMemo(() => {
    if (!song?.tempo) return 120;
    const match = song.tempo.match(/\d+/);
    return match ? parseInt(match[0]) : 120;
  }, [song]);

  const transposeChord = (chord: string, offset: number): string => {
    return chord.replace(/[A-G][b#]?/g, (match) => {
      const index = CHROMATIC_SCALE.indexOf(match);
      if (index === -1) {
        const flatMap: Record<string, string> = { 'Bb': 'A#', 'Eb': 'D#', 'Ab': 'G#', 'Db': 'C#', 'Gb': 'F#' };
        const mappedMatch = flatMap[match] || match;
        const mappedIndex = CHROMATIC_SCALE.indexOf(mappedMatch);
        if (mappedIndex === -1) return match;
        let newIndex = (mappedIndex + offset) % 12;
        while (newIndex < 0) newIndex += 12;
        return CHROMATIC_SCALE[newIndex];
      }
      let newIndex = (index + offset) % 12;
      while (newIndex < 0) newIndex += 12;
      return CHROMATIC_SCALE[newIndex];
    });
  };

  const transposedSheet = useMemo(() => {
    if (!song?.lyrics) return '';
    if (transposeOffset === 0) return song.lyrics;
    const chordRegex = /\b([A-G][b#]?(m|maj|min|aug|dim|sus|add|maj7|m7|7|6|9|11|13|b5|#5|#11)?(\/[A-G][b#]?)?)\b/g;
    return song.lyrics.split('\n').map(line => line.replace(chordRegex, (match) => transposeChord(match, transposeOffset))).join('\n');
  }, [song, transposeOffset]);

  const currentKey = useMemo(() => {
    if (!song) return 'C';
    const originalIndex = CHROMATIC_SCALE.indexOf(song.original_key);
    let newIndex = (originalIndex + transposeOffset) % 12;
    while (newIndex < 0) newIndex += 12;
    return CHROMATIC_SCALE[newIndex];
  }, [song, transposeOffset]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (onNavigate && currentIndex < songs.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [onNavigate, currentIndex, songs.length]);

  const goToPrev = useCallback(() => {
    if (onNavigate && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  }, [onNavigate, currentIndex]);

  // Swipe handlers
  const swipeHandlers = useSwipe(goToNext, goToPrev);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  if (!song) return null;

  const hasNext = currentIndex < songs.length - 1;
  const hasPrev = currentIndex > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      
      {/* Main Modal Container */}
      <div 
        className={`relative bg-[#0a0a0a] border border-white/10 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${isMinimized ? 'md:h-20' : ''}`}
        {...swipeHandlers}
      >
        {/* Top Navigation Bar - Always Visible */}
        <div className="flex items-center justify-between p-4 bg-black border-b border-white/5 shrink-0 z-20">
          <div className="flex items-center gap-3">
            {/* Navigation Arrows */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <button 
                onClick={goToPrev}
                disabled={!hasPrev}
                className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs font-bold text-white/60 px-2 min-w-[60px] text-center">
                {currentIndex + 1} / {songs.length}
              </span>
              <button 
                onClick={goToNext}
                disabled={!hasNext}
                className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-md transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Song List Toggle */}
            {songs.length > 0 && (
              <button 
                onClick={() => setShowSongList(!showSongList)}
                className={`p-2 rounded-lg transition-all ${showSongList ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <List size={18} />
              </button>
            )}
          </div>

          {/* Title - Hidden when minimized */}
          <div className={`flex-1 text-center transition-all duration-300 ${isMinimized ? 'opacity-0 md:opacity-100' : ''}`}>
            <h2 className="text-lg font-black italic tracking-tighter truncate">{song.title}</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">
              {category} • {song.original_key} → {currentKey}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Minimize Toggle (Desktop only) */}
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="hidden md:flex p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
            >
              {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            
            <button 
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Song List Dropdown */}
        {showSongList && songs.length > 0 && (
          <div className="absolute top-16 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-30 max-h-64 overflow-y-auto">
            <div className="p-2">
              {songs.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onNavigate?.(idx);
                    setShowSongList(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                    idx === currentIndex 
                      ? 'bg-white text-black' 
                      : 'hover:bg-white/5 text-white'
                  }`}
                >
                  <span className="text-xs font-black italic opacity-50">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{s.title}</p>
                    <p className="text-[10px] opacity-60 uppercase">{s.original_key}</p>
                  </div>
                  {idx === currentIndex && <Music size={14} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Content */}
        <div className={`flex-1 overflow-hidden transition-all duration-300 ${isMinimized ? 'h-0 opacity-0' : 'opacity-100'}`}>
          <div className="h-full overflow-y-auto grid grid-cols-1 lg:grid-cols-3">
            {/* Left Panel - Controls */}
            <div className="p-6 border-b lg:border-b-0 lg:border-r border-white/5 bg-[#050505] flex flex-col gap-6 shrink-0">
              {/* Key Transposition */}
              <div className="text-center space-y-4">
                <p className="text-[10px] uppercase font-black tracking-widest text-white/20">Current Key</p>
                <div className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-2xl">
                  {currentKey}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button 
                    onClick={() => setTransposeOffset(prev => prev - 1)} 
                    className="p-2 border border-white/10 rounded-lg hover:bg-white hover:text-black transition-all"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="text-sm font-bold min-w-[40px]">
                    {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset}
                  </span>
                  <button 
                    onClick={() => setTransposeOffset(prev => prev + 1)} 
                    className="p-2 border border-white/10 rounded-lg hover:bg-white hover:text-black transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <button 
                  onClick={() => setTransposeOffset(0)} 
                  className="text-[10px] uppercase font-bold text-white/20 hover:text-white flex items-center gap-2 mx-auto pt-2"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              {/* Resources */}
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <p className="text-[10px] uppercase font-black tracking-widest text-white/20">Resources</p>
                  {song.reference_url ? (
                    <a 
                      href={song.reference_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex items-center justify-between w-full p-3 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-all"
                    >
                      Open Reference <ExternalLink size={14} />
                    </a>
                  ) : (
                    <p className="text-[10px] text-white/20 italic">No external link available.</p>
                  )}
                </div>
              </div>

              {/* Metronome */}
              <Metronome initialBpm={songBpm} songTitle={song.title} />
            </div>

            {/* Right Panel - Chord Sheet */}
            <div className="lg:col-span-2 p-6 bg-black/40 relative min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 italic uppercase">
                  <Music size={18} className="text-white/40" /> Chord Sheet
                </h3>
                <button 
                  onClick={() => navigator.clipboard.writeText(transposedSheet)} 
                  className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-white text-white/30 transition-colors"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              
              {/* Swipe Hint for Mobile */}
              <div className="absolute top-1/2 left-2 md:hidden opacity-20 pointer-events-none">
                {hasPrev && <ChevronLeft size={32} />}
              </div>
              <div className="absolute top-1/2 right-2 md:hidden opacity-20 pointer-events-none">
                {hasNext && <ChevronRight size={32} />}
              </div>

              <div className="bg-[#050505] p-4 md:p-6 rounded-2xl border border-white/5 h-full min-h-[300px] overflow-y-auto">
                <pre className="font-mono text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
                  {transposedSheet || "No lyrics/chords available."}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar - Quick Access */}
        {!isMinimized && songs.length > 0 && (
          <div className="p-3 bg-black border-t border-white/5 flex items-center justify-between shrink-0">
            <button 
              onClick={goToPrev}
              disabled={!hasPrev}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-all text-xs font-bold uppercase tracking-widest"
            >
              <ChevronLeft size={14} /> Prev Song
            </button>

            <div className="text-center hidden sm:block">
              <p className="text-xs text-white/40">{song.title}</p>
            </div>

            <button 
              onClick={goToNext}
              disabled={!hasNext}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-all text-xs font-bold uppercase tracking-widest"
            >
              Next Song <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongDetailModal;