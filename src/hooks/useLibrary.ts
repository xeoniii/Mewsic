// uselibrary.ts
// orchestrates the initial music scan and playlist loading on startup.
// exposes helpers for rescanning and changing directories.

import { useCallback } from "react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  scanMusicDirectory,
  listPlaylists,
  createPlaylist,
  savePlaylist,
  deletePlaylist,
  pickDirectory,
  importPlaylist as importPlaylistApi,
  importFiles,
  downloadTrack,
  renamePlaylist as renamePlaylistApi,
  fetchTrackMetadata,
} from "../utils/tauriApi";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import type { Playlist, Track } from "../types";

export function useLibrary() {
  const {
    musicDir,
    playlistsDir,
    setTracks,
    setPlaylists,
    addPlaylist,
    updatePlaylist,
    removePlaylist,
    setScanning,
    setMusicDir,
    setPlaylistsDir,
    addNotification,
    updateNotification,
    removeNotification,
    tracks,
    playlists,
  } = useStore(useShallow((s) => ({
    musicDir: s.musicDir,
    playlistsDir: s.playlistsDir,
    setTracks: s.setTracks,
    setPlaylists: s.setPlaylists,
    addPlaylist: s.addPlaylist,
    updatePlaylist: s.updatePlaylist,
    removePlaylist: s.removePlaylist,
    setScanning: s.setScanning,
    setMusicDir: s.setMusicDir,
    setPlaylistsDir: s.setPlaylistsDir,
    addNotification: s.addNotification,
    updateNotification: s.updateNotification,
    removeNotification: s.removeNotification,
    tracks: s.tracks,
    playlists: s.playlists,
  })));

  const initialize = useCallback(async () => {
    try {
      if (!musicDir || !playlistsDir) return;
      
      // If we already have tracks from persistence, don't show scanning state
      // but still refresh in the background.
      const hasTracks = tracks.length > 0;
      
      if (!hasTracks) {
        setScanning(true, 0);
      }

      // Load playlists first as they are usually fast
      const pls = await listPlaylists(playlistsDir);
      setPlaylists(pls);

      // Then scan music
      const result = await scanMusicDirectory(musicDir);
      setTracks(result.tracks);
      
      setScanning(false);
    } catch (err) {
      console.error("Library init error:", err);
      setScanning(false);
    }
  }, [musicDir, playlistsDir, setScanning, setTracks, setPlaylists, tracks.length]);

  const changeMusicDirectory = useCallback(async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setMusicDir(dir);
    setScanning(true, 0);
    try {
      const result = await scanMusicDirectory(dir);
      setTracks(result.tracks);
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  }, [setMusicDir, setScanning, setTracks]);

  const changePlaylistsDirectory = useCallback(async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setPlaylistsDir(dir);
    try {
      const pls = await listPlaylists(dir);
      setPlaylists(pls);
    } catch (err) {
      console.error("Load playlists error:", err);
    }
  }, [setPlaylistsDir, setPlaylists]);

  const rescanDirectory = useCallback(async () => {
    if (!musicDir) return;
    setScanning(true, 0);
    try {
      const result = await scanMusicDirectory(musicDir);
      setTracks(result.tracks);
    } catch (err) {
      console.error("Rescan error:", err);
    } finally {
      setScanning(false);
    }
  }, [musicDir, setScanning, setTracks]);

  const refreshPlaylists = useCallback(async () => {
    if (!playlistsDir) return;
    try {
      const pls = await listPlaylists(playlistsDir);
      setPlaylists(pls);
    } catch (err) {
      console.error("Refresh playlists error:", err);
    }
  }, [playlistsDir, setPlaylists]);

  // ── Playlist CRUD ────────────────────────────────────────────────────────────
  const createNewPlaylist = useCallback(
    async (name: string): Promise<Playlist | null> => {
      if (!playlistsDir) return null;
      try {
        if (playlists.some((p) => p.name === name)) {
          addNotification("A playlist with this name already exists", "error");
          return null;
        }

        const pl = await createPlaylist(playlistsDir, name);
        addPlaylist(pl);
        return pl;
      } catch (err) {
        console.error("Create playlist error:", err);
        return null;
      }
    },
    [playlistsDir, addPlaylist, playlists, addNotification]
  );

  const updatePlaylistData = useCallback(async (pl: Playlist) => {
    try {
      const hydratedTracks = pl.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t);

      const playlistWithTracks = {
        ...pl,
        tracks: hydratedTracks,
      };

      await savePlaylist(playlistWithTracks);
      updatePlaylist(pl);
    } catch (err) {
      console.error("Save playlist error:", err);
    }
  }, [updatePlaylist, tracks]);

  const removePlaylistData = useCallback(async (pl: Playlist) => {
    try {
      if (pl.filePath) {
        await deletePlaylist(pl.filePath);
      }
      removePlaylist(pl.id);
      
      // Clean up virtual tracks if it was a virtual playlist
      if (!pl.filePath) {
        pl.trackIds.forEach(id => {
          useStore.getState().removeVirtualTrack(id);
        });
      }
    } catch (err) {
      console.error("Delete playlist error:", err);
    }
  }, [removePlaylist]);

  const removeTrackFromPlaylist = useCallback(
    async (playlist: Playlist, trackId: string) => {
      const updated = {
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId),
      };
      await updatePlaylistData(updated);
    },
    [updatePlaylistData]
  );

  const renamePlaylist = useCallback(
    async (playlist: Playlist, newName: string) => {
      const notifId = addNotification(`Renaming to "${newName}"...`, "info", 0, true);
      try {
        const updated = await renamePlaylistApi(playlist, newName);
        updatePlaylist(updated);
        updateNotification(notifId, { message: "Renamed successfully!", type: "success", loading: false });
        setTimeout(() => removeNotification(notifId), 3000);
        return updated; // Return the updated object
      } catch (err) {
        console.error("Rename playlist error:", err);
        updateNotification(notifId, { message: `Rename failed: ${err}`, type: "error", loading: false });
        setTimeout(() => removeNotification(notifId), 5000);
        return playlist;
      }
    },
    [updatePlaylist, addNotification, updateNotification, removeNotification]
  );

  
  const rehydratePlaylist = useCallback(async (pl: Playlist) => {
    if (!playlistsDir) {
      console.warn("Cannot save imported playlist: playlistsDir is not set.");
      addNotification("Import warning: Playlist folder not found. Changes may not be saved.", "error", 5000);
      return;
    }

    // Ensure the playlist is saved to a file if it was imported via JSON or has no path
    let activePlaylist = { ...pl };
    
    // Map virtual/imported tracks to existing ones in the local library
    if (activePlaylist.tracks) {
      const updatedTrackIds: string[] = [];
      const updatedTracks: Track[] = [];
      
      for (const t of activePlaylist.tracks) {
        const localMatch = tracks.find(lt => {
          if (!lt.isVirtual && !lt.filePath.startsWith("ytsearch:")) {
            if (t.sourceId && lt.sourceId && t.sourceId === lt.sourceId) return true;
            if (t.title?.toLowerCase().trim() === lt.title?.toLowerCase().trim() && 
                t.artist?.toLowerCase().trim() === lt.artist?.toLowerCase().trim()) return true;
          }
          return false;
        });
        
        if (localMatch) {
          updatedTrackIds.push(localMatch.id);
          updatedTracks.push(localMatch);
        } else {
          updatedTrackIds.push(t.id);
          updatedTracks.push(t);
        }
      }
      
      activePlaylist.trackIds = updatedTrackIds;
      activePlaylist.tracks = updatedTracks;
    }

    const exists = playlists.some(p => p.id === activePlaylist.id);
    const needsNewPath = !activePlaylist.filePath || !activePlaylist.filePath.startsWith(playlistsDir);

    if (!exists || needsNewPath) {
      const safeName = activePlaylist.name.replace(/[<>:"/\\|?*]/g, "").trim() || "Imported Playlist";
      const fileName = `${safeName}.json`;
      const fullPath = await join(playlistsDir, fileName);
      
      const notifId = addNotification(`Creating local file for "${activePlaylist.name}"...`, "info", 0, true);
      try {
        activePlaylist.filePath = fullPath;
        
        if (!activePlaylist.tracks || activePlaylist.tracks.length === 0) {
          activePlaylist.tracks = activePlaylist.trackIds
            .map((id) => tracks.find((lt) => lt.id === id))
            .filter((t): t is Track => !!t);
        }

        if (!exists) {
          addPlaylist(activePlaylist);
        } else {
          updatePlaylist(activePlaylist);
        }
        
        await savePlaylist(activePlaylist);
        
        updateNotification(notifId, { message: "Playlist file created!", type: "success", loading: false });
        setTimeout(() => removeNotification(notifId), 3000);
      } catch (err) {
        updateNotification(notifId, { message: `Failed to create file: ${err}`, type: "error", loading: false });
        setTimeout(() => removeNotification(notifId), 5000);
      }
    } else {
      updatePlaylist(activePlaylist);
      await savePlaylist(activePlaylist);
    }

    // Only proceed to downloading tracks if we have track metadata to work with
    if (activePlaylist.tracks && activePlaylist.tracks.length > 0) {
      const missing = activePlaylist.tracks.filter(t => {
      // Try to find a match in the local library
      const localMatch = tracks.find(lt => {
        // Match by sourceId (best)
        if (t.sourceId && lt.sourceId && t.sourceId === lt.sourceId) return true;
        // Match by title and artist (fallback)
        if (t.title?.toLowerCase() === lt.title?.toLowerCase() && 
            t.artist?.toLowerCase() === lt.artist?.toLowerCase()) return true;
        return false;
      });
      return !localMatch;
    });
    
    if (missing.length > 0) {
      const confirmDownload = confirm(`This playlist contains ${missing.length} tracks not in your library. Download them now?`);
      if (confirmDownload) {
        for (const track of missing) {
          let downloadUrl = track.sourceId;
          let coverArt = track.coverArt;

          // If no URL, try to find one via Harbour search
          if (!downloadUrl) {
            try {
              const query = `${track.title} ${track.artist}`;
              const searchResult = await fetchTrackMetadata(query);
              if (searchResult) {
                if (searchResult.url) downloadUrl = searchResult.url;
                if (searchResult.coverArt) coverArt = searchResult.coverArt;
              }
            } catch (err) {
              console.error("Failed to resolve metadata for", track.title, err);
            }
          }

          if (downloadUrl) {
            const notifId = addNotification(`Downloading ${track.title}...`, "info", 0, true, track.title);
            
            // Listen for progress on this specific download
            const unlisten = await listen("download-progress", (event: any) => {
              const { id, progress } = event.payload;
              if (id === notifId) {
                updateNotification(notifId, { message: `Downloading... ${progress.toFixed(0)}%`, loading: true });
              }
            });

            try {
              await downloadTrack(
                musicDir,
                track.title,
                track.artist,
                track.album || "", 
                coverArt || "", 
                notifId,
                downloadUrl
              );
              updateNotification(notifId, { message: "Download complete!", type: "success", loading: false });
              setTimeout(() => removeNotification(notifId), 3000);
            } catch (err) {
              updateNotification(notifId, { message: "Download failed", type: "error", loading: false });
              setTimeout(() => removeNotification(notifId), 5000);
            } finally {
              unlisten();
            }
          }
        }
        rescanDirectory();
        refreshPlaylists();
      }
    }
  }
}, [musicDir, playlistsDir, tracks, playlists, addNotification, updateNotification, removeNotification, addPlaylist, updatePlaylist, rescanDirectory, refreshPlaylists]);

  const importPlaylist = useCallback(async () => {
    if (!playlistsDir || !musicDir) return;
    try {
      const selected = await open({
        filters: [{ name: "Playlist", extensions: ["json"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const pl = await importPlaylistApi(playlistsDir, selected);
        addPlaylist(pl);
        await rehydratePlaylist(pl);
      }
    } catch (err) {
      console.error("Import playlist error:", err);
    }
  }, [playlistsDir, musicDir, addPlaylist, rehydratePlaylist]);

  const importSongs = useCallback(async () => {
    if (!musicDir) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Music', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'wma', 'aiff'] }]
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const count = await importFiles(selected, musicDir);
        if (count > 0) {
          rescanDirectory();
        }
      }
    } catch (err) {
      console.error("Import error:", err);
    }
  }, [musicDir, rescanDirectory]);

  return {
    initialize,
    rescanDirectory,
    refreshPlaylists,
    changeMusicDirectory,
    changePlaylistsDirectory,
    createNewPlaylist,
    updatePlaylistData,
    removePlaylistData,
    removeTrackFromPlaylist,
    renamePlaylist,
    rehydratePlaylist,
    importPlaylist,
    importSongs,
  };
}
