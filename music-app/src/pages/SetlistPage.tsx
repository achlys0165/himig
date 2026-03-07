import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Music, ExternalLink, Plus, X, Check, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import SongDetailModal from '../components/SongDetailModal';
import CalendarPicker from '../components/CalendarPicker';
import { Song, UserRole } from '../types';
import { useSearchParams } from 'react-router-dom';

// 4 categories for setlist organization (added Special Number)
const SETLIST_CATEGORIES = ['Pre-Service', 'Choir', 'Worship', 'Special Number'] as const;
type SetlistCategory = typeof SETLIST_CATEGORIES[number];

interface SetlistItem {
  song_id: string;
  category: SetlistCategory;
  order: number;
}

interface SongWithAssignment extends Song {
  assignedCategory: SetlistCategory;
  order: number;
}

const SetlistPage: React.FC = () => {
  const { user } = useAuth();
  const { songs, setlists, updateSetlist, loading } = useData();
  const [searchParams] = useSearchParams();
  
  const dateFromUrl = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState<string>(dateFromUrl || '');
  const [activeTab, setActiveTab] = useState<SetlistCategory>('Worship');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
  const [currentCategory, setCurrentCategory] = useState<SetlistCategory>('Worship');
  const [isEditing, setIsEditing] = useState(false);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Track expanded categories (default all expanded)
  const [expandedCategories, setExpandedCategories] = useState<Record<SetlistCategory, boolean>>({
    'Pre-Service': true,
    'Choir': true,
    'Worship': true,
    'Special Number': true
  });

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (dateFromUrl) {
      setSelectedDate(dateFromUrl);
    }
  }, [dateFromUrl]);

  const currentSetlist = useMemo(() => {
    if (!selectedDate) return null;
    return setlists.find(s => s.date === selectedDate);
  }, [setlists, selectedDate]);

  const parsedSetlist = useMemo((): SetlistItem[] => {
    if (!currentSetlist) return [];
    
    return currentSetlist.song_ids.map((item: any, index: number) => {
      if (typeof item === 'string') {
        const song = songs.find(s => s.id === item);
        return {
          song_id: item,
          category: (song?.category as SetlistCategory) || 'Worship',
          order: index
        };
      }
      return item as SetlistItem;
    });
  }, [currentSetlist, songs]);

  const dateSongs = useMemo((): SongWithAssignment[] => {
    if (!parsedSetlist.length) return [];
    
    const result: SongWithAssignment[] = [];
    
    parsedSetlist.forEach(item => {
      const song = songs.find(s => s.id === item.song_id);
      if (song) {
        result.push({
          ...song,
          assignedCategory: item.category,
          order: item.order
        });
      }
    });
    
    return result.sort((a, b) => a.order - b.order);
  }, [parsedSetlist, songs]);

  const groupedByCategory = useMemo(() => {
    const grouped: Record<SetlistCategory, SongWithAssignment[]> = {
      'Pre-Service': [],
      'Choir': [],
      'Worship': [],
      'Special Number': []
    };
    
    dateSongs.forEach(song => {
      const category = song.assignedCategory;
      if (grouped[category]) {
        grouped[category].push(song);
      }
    });
    
    SETLIST_CATEGORIES.forEach(category => {
      grouped[category].sort((a, b) => a.order - b.order);
    });
    
    return grouped;
  }, [dateSongs]);

  // Get current category songs for navigation
  const currentCategorySongs = useMemo(() => {
    return groupedByCategory[currentCategory] || [];
  }, [groupedByCategory, currentCategory]);

  const availableSongs = useMemo(() => {
    const usedSongIds = setlistItems.map(item => item.song_id);
    return songs.filter(song => !usedSongIds.includes(song.id));
  }, [songs, setlistItems]);

  const handleEdit = () => {
    if (!isAdmin) return;
    setSetlistItems(parsedSetlist);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!isAdmin || !selectedDate) return;
    setIsSaving(true);
    try {
      await updateSetlist({ 
        date: selectedDate, 
        song_ids: setlistItems.map(item => ({
          song_id: item.song_id,
          category: item.category,
          order: item.order
        }))
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving setlist:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addSong = (songId: string) => {
    const newItem: SetlistItem = {
      song_id: songId,
      category: activeTab,
      order: setlistItems.filter(i => i.category === activeTab).length
    };
    setSetlistItems([...setlistItems, newItem]);
  };

  const removeSong = (songId: string, category: SetlistCategory) => {
    const newItems = setlistItems.filter(
      item => !(item.song_id === songId && item.category === category)
    );
    const recalculated = newItems.map(item => {
      if (item.category === category) {
        const sameCategory = newItems.filter(i => i.category === category);
        const newOrder = sameCategory.findIndex(i => i.song_id === item.song_id);
        return { ...item, order: newOrder };
      }
      return item;
    });
    setSetlistItems(recalculated);
  };

  const moveSong = (songId: string, category: SetlistCategory, direction: 'up' | 'down') => {
    const categoryItems = setlistItems.filter(i => i.category === category);
    const currentIndex = categoryItems.findIndex(i => i.song_id === songId);
    
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === categoryItems.length - 1)
    ) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentItem = categoryItems[currentIndex];
    const swapItem = categoryItems[swapIndex];

    if (!currentItem || !swapItem) return;

    const newItems = setlistItems.map(item => {
      if (item.song_id === currentItem.song_id && item.category === category) {
        return { ...item, order: swapItem.order };
      }
      if (item.song_id === swapItem.song_id && item.category === category) {
        return { ...item, order: currentItem.order };
      }
      return item;
    });
    
    setSetlistItems(newItems);
  };

  const changeCategory = (songId: string, oldCategory: SetlistCategory, newCategory: SetlistCategory) => {
    const newItems = setlistItems.map(item => {
      if (item.song_id === songId && item.category === oldCategory) {
        return {
          ...item,
          category: newCategory,
          order: setlistItems.filter(i => i.category === newCategory).length
        };
      }
      return item;
    });
    setSetlistItems(newItems);
  };

  const toggleCategory = (category: SetlistCategory) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Enhanced song selection with category context
  const handleSongClick = (song: SongWithAssignment, category: SetlistCategory) => {
    setCurrentCategory(category);
    setCurrentSongIndex(groupedByCategory[category].findIndex(s => s.id === song.id));
    setSelectedSong(song);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tighter">SUNDAY SETLISTS</h1>
          <p className="text-white/40 mt-1 uppercase text-xs tracking-[0.2em]">
            {isAdmin ? 'Plan and manage service setlists' : 'View upcoming service setlists'}
          </p>
        </div>
      </header>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="w-full md:w-80 flex-shrink-0">
            <CalendarPicker
              label="Select Service Date"
              selectedDate={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setIsEditing(false);
              }}
            />
          </div>
          
          {isAdmin && selectedDate && !isEditing && (
            <button 
              onClick={handleEdit}
              className="px-8 py-4 bg-white text-black rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/90 transition-all"
            >
              {currentSetlist ? 'Edit Setlist' : 'Create Setlist'}
            </button>
          )}
          
          {isAdmin && isEditing && (
            <div className="flex gap-3">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-4 border border-white/20 text-white/60 rounded-xl font-black uppercase text-xs tracking-widest hover:border-white/40 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-4 bg-white text-black rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? 'Saving...' : <><Check size={14} /> Save Setlist</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {!selectedDate ? (
        <div className="py-20 text-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
          <Calendar size={48} className="mx-auto mb-4 opacity-20" />
          <p className="italic">Select a date to view the setlist.</p>
        </div>
      ) : isEditing && isAdmin ? (
        <div className="space-y-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3 block">
              Add Songs To Category
            </label>
            <div className="flex flex-wrap gap-2">
              {SETLIST_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === cat
                      ? 'bg-white text-black'
                      : 'bg-black border border-white/10 text-white/60 hover:border-white/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/40">
                Available Songs ({availableSongs.length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {availableSongs.map(song => (
                  <button
                    key={song.id}
                    onClick={() => addSong(song.id)}
                    className="w-full p-4 bg-[#0a0a0a] border border-white/10 rounded-xl hover:border-white/30 hover:bg-white/[0.02] transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">{song.title}</p>
                        <p className="text-[10px] uppercase text-white/40 mt-1">
                          Vault: {song.category} • Key: {song.original_key}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 uppercase">
                          Add to {activeTab}
                        </span>
                        <Plus size={18} className="text-white/40 group-hover:text-white" />
                      </div>
                    </div>
                  </button>
                ))}
                {availableSongs.length === 0 && (
                  <p className="text-white/20 text-center py-8 italic">All songs have been added</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/40">
                Current Setlist ({setlistItems.length})
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {SETLIST_CATEGORIES.map(category => {
                  const categoryItems = setlistItems
                    .filter(item => item.category === category)
                    .sort((a, b) => a.order - b.order);
                  
                  if (categoryItems.length === 0) return null;

                  return (
                    <div key={category} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4">
                      <h4 className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-3 flex items-center justify-between">
                        {category}
                        <span className="bg-white/10 px-2 py-1 rounded-full">{categoryItems.length}</span>
                      </h4>
                      <div className="space-y-2">
                        {categoryItems.map((item, idx) => {
                          const song = songs.find(s => s.id === item.song_id);
                          if (!song) return null;
                          
                          return (
                            <div 
                              key={`${item.song_id}-${category}`}
                              className="flex items-center gap-2 p-3 bg-black border border-white/5 rounded-xl group"
                            >
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => moveSong(item.song_id, category, 'up')}
                                  disabled={idx === 0}
                                  className="text-white/20 hover:text-white disabled:opacity-10 text-xs"
                                >
                                  ▲
                                </button>
                                <button 
                                  onClick={() => moveSong(item.song_id, category, 'down')}
                                  disabled={idx === categoryItems.length - 1}
                                  className="text-white/20 hover:text-white disabled:opacity-10 text-xs"
                                >
                                  ▼
                                </button>
                              </div>
                              
                              <span className="text-lg font-black italic text-white/20 w-6 text-center">
                                {idx + 1}
                              </span>
                              
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate text-white">{song.title}</p>
                                <p className="text-[10px] text-white/40">
                                  {song.original_key} • Vault: {song.category}
                                </p>
                              </div>

                              <select
                                value={category}
                                onChange={(e) => changeCategory(item.song_id, category, e.target.value as SetlistCategory)}
                                className="bg-black border border-white/10 rounded-lg text-[10px] uppercase py-1 px-2 text-white/60 focus:border-white/30 outline-none"
                              >
                                {SETLIST_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>

                              <button
                                onClick={() => removeSong(item.song_id, category)}
                                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors text-white/40"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {setlistItems.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                    <p className="text-white/20 italic text-sm">No songs selected yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-black italic">
            {formatDate(selectedDate)}
          </h2>
          
          {dateSongs.length === 0 ? (
            <div className="py-20 text-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
              <Music size={48} className="mx-auto mb-4 opacity-20" />
              <p className="italic">No songs planned for this service yet.</p>
              {isAdmin && (
                <button 
                  onClick={handleEdit}
                  className="mt-4 px-6 py-3 bg-white/10 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Create Setlist
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {SETLIST_CATEGORIES.map(category => {
                const categorySongs = groupedByCategory[category];
                if (categorySongs.length === 0) return null;

                const isExpanded = expandedCategories[category];

                return (
                  <div 
                    key={category} 
                    className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden"
                  >
                    {/* Collapsible Header */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                          {category}
                        </h3>
                        <span className="text-white/20 text-xs bg-white/5 px-2 py-1 rounded-full">
                          {categorySongs.length} songs
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 uppercase tracking-widest">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={18} className="text-white/40" />
                        ) : (
                          <ChevronDown size={18} className="text-white/40" />
                        )}
                      </div>
                    </button>

                    {/* Collapsible Content */}
                    <div 
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categorySongs.map((song, index) => (
                          <div 
                            key={song.id} 
                            onClick={() => handleSongClick(song, category)}
                            className="group bg-black border border-white/5 p-5 rounded-2xl hover:border-white/40 hover:bg-white/[0.02] transition-all relative overflow-hidden cursor-pointer"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl font-black italic text-white/20">{index + 1}</span>
                                <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white group-hover:text-black transition-all">
                                  <Music size={16} />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {song.reference_url && (
                                  <a 
                                    href={song.reference_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 text-white/30 hover:text-white transition-colors"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border border-white/10 px-2 py-1 rounded">
                                  {song.original_key}
                                </span>
                              </div>
                            </div>
                            <h3 className="text-base font-bold group-hover:translate-x-1 transition-transform truncate">{song.title}</h3>
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-[10px] text-white/40 uppercase tracking-widest px-2 py-1 bg-white/5 rounded">
                                Vault: {song.category}
                              </span>
                              {song.tempo && (
                                <span className="text-[10px] text-white/40 uppercase tracking-widest px-2 py-1 bg-white/5 rounded">
                                  {song.tempo}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Song Detail Modal with Navigation */}
      {selectedSong && (
        <SongDetailModal 
          song={selectedSong} 
          onClose={() => setSelectedSong(null)}
          songs={currentCategorySongs}
          currentIndex={currentSongIndex}
          onNavigate={(index) => {
            setCurrentSongIndex(index);
            setSelectedSong(currentCategorySongs[index]);
          }}
          category={currentCategory}
        />
      )}
    </div>
  );
};

export default SetlistPage;