import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Play, Shuffle, Trash2, Music2, ListMusic, MinusCircle, PlusCircle, Pencil, Share2, Download, List, LayoutGrid
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard, SortableMusicCard } from "../Dashboard/MusicCard";
import { downloadTrack, importFiles } from "../../utils/tauriApi";
import { listen } from "@tauri-apps/api/event";
import { useLibrary } from "../../hooks/useLibrary";
import { formatDuration, pluralize, shuffleArray } from "../../utils/helpers";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { getCoverArtSync } from "../../utils/tauriApi";
import { ManagePlaylistTracksModal } from "./ManagePlaylistTracksModal";
import { EditPlaylistModal } from "./EditPlaylistModal";
import type { Track } from "../../types";

import { useDisplayData } from "../../hooks/useDisplayData";

import { useSmoothScroll } from "../../hooks/useSmoothScroll";

export function PlaylistView() {
  const {
    activePlaylistId,
    setQueue,
    setIsPlaying,
    setActiveView,
    setAddTrack,
    playlistViewMode,
    setPlaylistViewMode,
    setSharePlaylist,
    musicDir,
    addNotification,
    updateNotification,
    removeNotification,
    addTracks,
  } = useStore(
    useShallow((s) => ({
      activePlaylistId: s.activePlaylistId,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
      setActiveView: s.setActiveView,
      setAddTrack: s.setAddTrack,
      playlistViewMode: s.playlistViewMode,
      setPlaylistViewMode: s.setPlaylistViewMode,
      setSharePlaylist: s.setSharePlaylist,
      musicDir: s.musicDir,
      addNotification: s.addNotification,
      updateNotification: s.updateNotification,
      removeNotification: s.removeNotification,
      addTracks: s.addTracks,
      updateTrack: s.updateTrack,
    }))
  );

  const { displayPlaylists, displayTracks } = useDisplayData();
  const { 
    removePlaylistData, 
    removeTrackFromPlaylist, 
    updatePlaylistData, 
    renamePlaylist,
    rehydratePlaylist
  } = useLibrary();

  const [showManageTracks, setShowManageTracks] = useState(false);
  const [showEditPlaylist, setShowEditPlaylist] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  useSmoothScroll(containerRef);

  useEffect(() => {
    if (!activePlaylistId) return;
    isRestoringRef.current = true;
    const saved = useStore.getState().playlistScrollOffsets[activePlaylistId] || 0;
    let attempts = 0;
    let frame: number;
    let timer: any;

    const tryRestore = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = saved;
      }
      
      if (attempts < 5) {
        attempts++;
        frame = requestAnimationFrame(tryRestore);
      } else {
        timer = setTimeout(() => {
          isRestoringRef.current = false;
        }, 150);
      }
    };

    tryRestore();

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [activePlaylistId]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoringRef.current) return;
    if (activePlaylistId) {
      useStore.getState().setPlaylistScrollOffset(activePlaylistId, e.currentTarget.scrollTop);
    }
  }, [activePlaylistId]);

  const playlist = useMemo(
    () => displayPlaylists.find((p) => p.id === activePlaylistId),
    [displayPlaylists, activePlaylistId]
  );

  const playlistTracks = useMemo(() => {
    if (!playlist) return [];
    const trackMap = new Map(displayTracks.map((t) => [t.id, t]));
    const playlistTrackMap = new Map((playlist.tracks || []).map((t) => [t.id, t]));
    return (playlist.trackIds || [])
      .map((id) => trackMap.get(id) || playlistTrackMap.get(id))
      .filter(Boolean) as Track[];
  }, [playlist, displayTracks]);

  const totalDuration = useMemo(
    () => playlistTracks.reduce((acc, t) => acc + t.duration, 0),
    [playlistTracks]
  );

  const handlePlay = () => {
    if (!playlist || !playlistTracks.length) return;
    setQueue(playlistTracks, 0, playlist.id);
    setIsPlaying(true);
  };

  const handleShuffle = useCallback(async () => {
    if (!playlist || !playlistTracks.length) return;
    
    const shuffledTracks = shuffleArray([...playlistTracks]);
    const shuffledIds = shuffledTracks.map((t) => t.id);

    // Sync the player queue if it's currently playing this playlist
    useStore.getState().syncQueue(shuffledTracks, playlist.id);

    await updatePlaylistData({
      ...playlist,
      trackIds: shuffledIds,
    });
  }, [playlistTracks, playlist, updatePlaylistData]);

  const handleDelete = async () => {
    if (!playlist) return;
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return;
    const plToDelete = playlist;
    setActiveView("library");
    await removePlaylistData(plToDelete);
  };

  const handleEdit = () => {
    setShowEditPlaylist(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!playlist) return;
    if (over && active.id !== over.id) {
      const oldIndex = playlistTracks.findIndex((t) => t.id === active.id);
      const newIndex = playlistTracks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTracks = arrayMove(playlistTracks, oldIndex, newIndex);
        const newTrackIds = newTracks.map((t) => t.id);

        // Sync the player queue if it's currently playing this playlist
        useStore.getState().syncQueue(newTracks, playlist.id);

        await updatePlaylistData({
          ...playlist,
          trackIds: newTrackIds,
        });
      }
    }
  };

  const handleAddToPlaylist = useCallback((t: Track) => {
    setAddTrack(t);
  }, [setAddTrack]);

  const handleRemoveFromPlaylist = useCallback(async (t: Track) => {
    if (!playlist) return;
    if (confirm(`Remove "${t.title}" from this playlist?`)) {
      await removeTrackFromPlaylist(playlist, t.id);
    }
  }, [playlist, removeTrackFromPlaylist]);

  const isVirtualPlaylist = playlist ? !playlist.filePath : false;
  const currentCachePlaylistIdRef = useRef<string | null>(null);

  // Background caching for virtual playlists
  useEffect(() => {
    if (!isVirtualPlaylist || !musicDir) return;
    if (currentCachePlaylistIdRef.current === activePlaylistId) return;
    
    const uncachedTracks = playlistTracks.filter(t => t.filePath.startsWith("ytsearch:"));
    if (uncachedTracks.length === 0) return;

    currentCachePlaylistIdRef.current = activePlaylistId;
    const cacheDir = `${musicDir}/.mewsic_cache`;

    const cacheTracks = async () => {
      const CONCURRENCY = 3;
      let i = 0;
      
      const processNext = async (): Promise<void> => {
        if (currentCachePlaylistIdRef.current !== activePlaylistId) return;
        if (i >= uncachedTracks.length) return;
        const track = uncachedTracks[i++];
        try {
          const cachedPath = await downloadTrack(
            cacheDir, track.title, track.artist, track.album || playlist!.name, track.coverArt || playlist!.coverArt || "", `cache_${track.id}`, undefined
          );
          
          if (currentCachePlaylistIdRef.current !== activePlaylistId) return;
          useStore.getState().updateTrack({
            ...track,
            filePath: cachedPath,
          });
        } catch (e) {
          console.error(`Failed to cache ${track.title}:`, e);
        }
        return processNext();
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, uncachedTracks.length) }, () => processNext());
      await Promise.all(workers);
    };

    cacheTracks();
  }, [isVirtualPlaylist, playlistTracks, musicDir, activePlaylistId]);

  const handleSaveVirtual = async () => {
    if (!playlist || !musicDir) return;
    const notifId = addNotification(`Saving ${playlistTracks.length} tracks to disk...`, "info", 0, true);
    
    let unlisten: any = null;
    try {
      unlisten = await listen("download-progress", (e: any) => {
        const { id, progress } = e.payload;
        if (id.startsWith("virt_dl_")) {
          updateNotification(notifId, { message: `Downloading... ${progress.toFixed(0)}%`, loading: true });
        }
      });

      const finalTracksToLibrary: Track[] = [];
      const succeededIds = new Set<string>();
      const trackIdMap = new Map<string, string>();
      
      for (let i = 0; i < playlistTracks.length; i++) {
        const t = playlistTracks[i];
        updateNotification(notifId, { message: `Processing (${i+1}/${playlistTracks.length}): ${t.title}...`, loading: true });
        
        let finalPath = "";
        try {
          // Check if there is already a scanned track with the same title and artist in the library
          const existingTrack = useStore.getState().tracks.find(st => 
            !st.isVirtual && 
            !st.filePath.startsWith("ytsearch:") &&
            st.title.toLowerCase().trim() === t.title.toLowerCase().trim() &&
            st.artist.toLowerCase().trim() === t.artist.toLowerCase().trim()
          );

          if (existingTrack) {
            trackIdMap.set(t.id, existingTrack.id);
            succeededIds.add(t.id);
            continue;
          }

          if (!t.filePath.startsWith("ytsearch:")) {
            // Already cached! Just copy it from .mewsic_cache to musicDir
            await importFiles([t.filePath], musicDir);
            finalPath = `${musicDir}/${t.filePath.split(/[\\/]/).pop()}`;
          } else {
            // Not cached yet, download directly to musicDir
            finalPath = await downloadTrack(
              musicDir, t.title, t.artist, t.album || playlist!.name, t.coverArt || playlist!.coverArt || "", `virt_dl_${i}`, undefined
            );
          }
          
          if (finalPath) {
            const newTrackId = "mewsify_" + (t.sourceId || finalPath).replace(/[^a-z0-9]/gi, "_");
            const realTrack: Track = {
              ...t,
              id: newTrackId,
              filePath: finalPath,
              fileName: finalPath.split(/[\\/]/).pop() || t.title,
              isVirtual: false,
              provider: "spotify",
              dateAdded: Date.now(),
            };
            finalTracksToLibrary.push(realTrack);
            trackIdMap.set(t.id, newTrackId);
            succeededIds.add(t.id);
          }
        } catch (e) {
          console.error(`Failed to save ${t.title}:`, e);
        }
      }

      if (succeededIds.size > 0) {
        // We use addTracks to insert the real tracks into the library
        if (finalTracksToLibrary.length > 0) {
          useStore.getState().addTracks(finalTracksToLibrary);
        }
        
        // Clean up the old virtual tracks from the library if they succeeded
        for (const t of playlistTracks) {
          if (succeededIds.has(t.id)) {
            useStore.getState().removeVirtualTrack(t.id);
          }
        }
        
        const cleanName = playlist!.name.replace(" (Virtual)", "");
        const newPl = {
          ...playlist!,
          name: cleanName,
          trackIds: playlistTracks.map(t => {
            if (succeededIds.has(t.id)) {
              return trackIdMap.get(t.id) || t.id;
            }
            return t.id;
          }),
        };
        
        // Remove the virtual suffix and save to disk
        await rehydratePlaylist(newPl);
        
        updateNotification(notifId, { message: `Saved playlist to library!`, type: "success", loading: false });
      } else {
        updateNotification(notifId, { message: "Failed to save tracks.", type: "error", loading: false });
      }
    } catch (e: any) {
      updateNotification(notifId, { message: `Error: ${e.message}`, type: "error", loading: false });
    } finally {
      if (unlisten) unlisten();
      setTimeout(() => removeNotification(notifId), 5000);
    }
  };

  if (!playlist) {
    return (
      <div className="empty-state h-full">
        <ListMusic size={40} className="text-text-muted" />
        <p className="text-text-secondary">Playlist not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {
  // This is the header section
}
      <div className="relative px-6 py-6 border-b border-border-subtle flex-shrink-0">
        {
  // This is the blurred bg part
}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 0% 100%, var(--accent) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {
  // This is the playlist icon part
}
            <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center flex-shrink-0 overflow-hidden border border-border-subtle">
              {playlist.coverArt ? (
                <img src={playlist.coverArt} alt="Playlist cover" className="w-full h-full object-cover" />
              ) : playlistTracks.length > 0 ? (
                <img src={getCoverArtSync(playlistTracks[0].filePath, 128) || undefined} alt="Playlist cover" className="w-full h-full object-cover" />
              ) : (
                <ListMusic size={28} className="text-accent" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs text-text-muted uppercase tracking-widest mb-0.5">
                Playlist
              </p>
              <h1 className="font-display font-bold text-xl text-text-primary truncate">
                {playlist.name}
              </h1>
              <p className="text-sm text-text-secondary mt-0.5 truncate">
                {pluralize(playlistTracks.length, "track")}
                {playlistTracks.length > 0 && ` · ${formatDuration(totalDuration)}`}
              </p>
            </div>
          </div>

          {
  // This is the actions part
}
          <div className="flex flex-wrap items-center gap-3 lg:justify-end mt-2 lg:mt-0 w-full lg:w-auto">
            <div className="flex gap-2">
              <button
                onClick={handlePlay}
                disabled={!playlistTracks.length}
                className="btn-accent px-6"
              >
                <Play size={14} fill="currentColor" />
                Play
              </button>
              {isVirtualPlaylist ? (
                <button
                  onClick={handleSaveVirtual}
                  className="btn-accent bg-accent-muted text-accent border-accent/20 px-6"
                  title="Download all tracks to your library"
                >
                  <Download size={14} />
                  Save to Disk
                </button>
              ) : (
                <button
                  onClick={() => setShowManageTracks(true)}
                  className="btn-accent bg-accent-muted text-accent border-accent/20 px-6"
                  title="Add songs to this playlist"
                >
                  <PlusCircle size={14} />
                  Add
                </button>
              )}
            </div>

            <div className="flex flex-1 justify-end min-w-max">
              <div className="flex items-center gap-1 bg-surface-raised border border-border-subtle p-1 rounded-xl">
                {
  // This is the view toggle part
}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPlaylistViewMode("list")}
                    className={`btn-icon ${playlistViewMode === "list" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                    title="List view"
                  >
                    <List size={15} />
                  </button>
                  <button
                    onClick={() => setPlaylistViewMode("grid")}
                    className={`btn-icon ${playlistViewMode === "grid" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                    title="Grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>

                <div className="h-5 w-px bg-border-subtle mx-1" />

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleShuffle}
                    disabled={!playlistTracks.length}
                    className="btn-icon"
                    title="Shuffle"
                  >
                    <Shuffle size={15} />
                  </button>
                  <button
                    onClick={handleEdit}
                    className="btn-icon"
                    title="Edit playlist"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setSharePlaylist(playlist)}
                    className="btn-icon"
                    title="Share playlist"
                  >
                    <Share2 size={15} />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn-icon text-red-400 hover:bg-red-500/10"
                    title="Delete playlist"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {
  // This is the track list part
}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        {playlistTracks.length === 0 ? (
          <div className="empty-state pt-16">
            <Music2 size={40} className="text-text-muted" />
            <div className="text-center">
              <p className="text-text-secondary font-medium">
                This playlist is empty
              </p>
              <p className="text-text-muted text-sm mt-1">
                Add tracks from the Library view
              </p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToWindowEdges]}
          >
            <SortableContext
              items={playlistTracks.map((t) => t.id)}
              strategy={playlistViewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
            >
              {playlistViewMode === "grid" ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {playlistTracks.map((track, i) => (
                    <SortableMusicCard
                      key={track.id}
                      track={track}
                      allTracks={playlistTracks}
                      trackIndex={i}
                      sourceId={playlist.id}
                      viewMode="grid"
                      onAddToPlaylist={handleAddToPlaylist}
                      onRemoveFromPlaylist={handleRemoveFromPlaylist}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {playlistTracks.map((track, i) => (
                    <SortableMusicCard
                      key={track.id}
                      track={track}
                      allTracks={playlistTracks}
                      trackIndex={i}
                      sourceId={playlist.id}
                      viewMode="list"
                      onAddToPlaylist={handleAddToPlaylist}
                      onRemoveFromPlaylist={handleRemoveFromPlaylist}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>
        )}
      </div>
      {showManageTracks && (
        <ManagePlaylistTracksModal
          playlist={playlist}
          onClose={() => setShowManageTracks(false)}
        />
      )}
      {showEditPlaylist && (
        <EditPlaylistModal
          playlist={playlist}
          onClose={() => setShowEditPlaylist(false)}
        />
      )}
    </div>
  );
}
