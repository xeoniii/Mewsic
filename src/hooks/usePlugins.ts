import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { initPluginApi } from "../utils/pluginApi";
import { useStore } from "../store";

let minecraftWs: WebSocket | null = null;
let minecraftReconnectTimer: any = null;

function runMinecraftPlugin() {
  function sendIfOpen(ws: WebSocket, event: string, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data }));
    }
  }

  function sanitizeTitle(title: string) {
    return title.replace(/\s+/g, "_");
  }

  function connect() {
    if (window.Mewsic) window.Mewsic.minecraftConnected = false;
    window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));

    const ws = new WebSocket("ws://127.0.0.1:3012");
    minecraftWs = ws;

    ws.onopen = () => {
      if (window.Mewsic) {
        window.Mewsic.minecraftConnected = true;
        window.Mewsic.ui.addNotification("Connected to Minecraft!", "success", 3000);
      }
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: true }));

      if (window.Mewsic?.player.currentTrack) {
        const track = window.Mewsic.player.currentTrack;
        sendIfOpen(ws, "track_changed", { ...track, title: sanitizeTitle(track.title || "") });
      }

      if (window.Mewsic?.library?.tracks) {
        const sanitized = window.Mewsic.library.tracks.map((t: any) => ({
          ...t,
          title: sanitizeTitle(t.title || ""),
        }));
        sendIfOpen(ws, "library_sync", sanitized);
      }

      if (window.Mewsic?.library?.playlists) {
        const sanitized = window.Mewsic.library.playlists.map((pl: any) => ({
          id: pl.id,
          name: sanitizeTitle(pl.name || ""),
        }));
        sendIfOpen(ws, "playlists_sync", sanitized);
      }

      if (window.Mewsic) {
        const currentPlaylist = window.Mewsic.player.currentPlaylistName;
        sendIfOpen(ws, "playlist_changed", currentPlaylist ? sanitizeTitle(currentPlaylist) : "library");
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!window.Mewsic) return;
        if (msg.action === "playNext") window.Mewsic.player.next();
        if (msg.action === "playPrev") window.Mewsic.player.prev();
        if (msg.action === "togglePlay") window.Mewsic.player.togglePlay();
        if (msg.action === "playTrack" && msg.trackId) window.Mewsic.player.playTrack(msg.trackId);
        if (msg.action === "toggleShuffle") window.Mewsic.player.toggleShuffle();
        if (msg.action === "setRepeatMode" && msg.repeatMode) window.Mewsic.player.setRepeatMode(msg.repeatMode);
        if (msg.action === "playPlaylist" && msg.playlistId) window.Mewsic.library.playPlaylist(msg.playlistId);
      } catch (e) { }
    };

    ws.onclose = () => {
      if (window.Mewsic) window.Mewsic.minecraftConnected = false;
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));
      minecraftReconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      if (window.Mewsic) window.Mewsic.minecraftConnected = false;
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));
      ws.close();
    };
  }

  if (window.Mewsic) {
    window.Mewsic.reconnectMinecraft = () => {
      if (minecraftWs) {
        minecraftWs.onclose = null;
        minecraftWs.onerror = null;
        minecraftWs.close();
      }
      if (minecraftReconnectTimer) clearTimeout(minecraftReconnectTimer);
      connect();
    };
  }

  const trackChangedHandler = (track: any) => {
    if (!minecraftWs || minecraftWs.readyState !== WebSocket.OPEN) return;
    const sanitized = track ? { ...track, title: sanitizeTitle(track.title || "") } : null;
    minecraftWs.send(JSON.stringify({ event: "track_changed", data: sanitized }));
  };

  const playbackStateChangedHandler = (isPlaying: any) => {
    if (minecraftWs?.readyState === WebSocket.OPEN)
      minecraftWs.send(JSON.stringify({ event: "playback_state_changed", data: isPlaying }));
  };

  const timeChangedHandler = (currentTime: any) => {
    if (minecraftWs?.readyState === WebSocket.OPEN)
      minecraftWs.send(JSON.stringify({ event: "time_changed", data: currentTime }));
  };

  const shuffleChangedHandler = (shuffleEnabled: any) => {
    if (minecraftWs?.readyState === WebSocket.OPEN)
      minecraftWs.send(JSON.stringify({ event: "shuffle_changed", data: shuffleEnabled }));
  };

  const repeatChangedHandler = (repeatMode: any) => {
    if (minecraftWs?.readyState === WebSocket.OPEN)
      minecraftWs.send(JSON.stringify({ event: "repeat_changed", data: repeatMode }));
  };

  const playlistChangedHandler = (playlistName: any) => {
    if (minecraftWs?.readyState === WebSocket.OPEN) {
      minecraftWs.send(JSON.stringify({
        event: "playlist_changed",
        data: playlistName ? sanitizeTitle(playlistName) : "library",
      }));
    }
  };

  if (window.Mewsic) {
    window.Mewsic.events.on("track_changed", trackChangedHandler);
    window.Mewsic.events.on("playback_state_changed", playbackStateChangedHandler);
    window.Mewsic.events.on("time_changed", timeChangedHandler);
    window.Mewsic.events.on("shuffle_changed", shuffleChangedHandler);
    window.Mewsic.events.on("repeat_changed", repeatChangedHandler);
    window.Mewsic.events.on("playlist_changed", playlistChangedHandler);

    window.Mewsic.disconnectMinecraft = () => {
      if (minecraftWs) {
        minecraftWs.onclose = null;
        minecraftWs.onerror = null;
        minecraftWs.close();
        minecraftWs = null;
      }
      if (minecraftReconnectTimer) {
        clearTimeout(minecraftReconnectTimer);
        minecraftReconnectTimer = null;
      }
      if (window.Mewsic) {
        window.Mewsic.minecraftConnected = false;
        window.Mewsic.events.off("track_changed", trackChangedHandler);
        window.Mewsic.events.off("playback_state_changed", playbackStateChangedHandler);
        window.Mewsic.events.off("time_changed", timeChangedHandler);
        window.Mewsic.events.off("shuffle_changed", shuffleChangedHandler);
        window.Mewsic.events.off("repeat_changed", repeatChangedHandler);
        window.Mewsic.events.off("playlist_changed", playlistChangedHandler);
      }
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));
    };
  }

  connect();
}

function runMewsifyPlugin() {
  if (!window.Mewsic) return;

  window.Mewsic.ui.registerSidebarComponent("mewsify", {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5s.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`,
    name: "Mewsify",
    viewId: "plugin:mewsify"
  });

  window.Mewsic.ui.registerTab("plugin:mewsify", {
    render: (container: HTMLElement) => {
      container.className = "h-full w-full overflow-y-auto";
      let unlistenFn: (() => void) | null = null;

      const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5s.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/></svg>`;

      const CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#1DB954"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      const SPIN = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
      const FAIL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ef4444"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

      // Initialize global state cache if it doesn't exist
      if (!(window as any).Mewsic._mewsifyState) {
        (window as any).Mewsic._mewsifyState = { stage: "home" };
      }

      // ── Stage 1: URL input ──────────────────────────────────────────────────
      const renderHome = () => {
        (window as any).Mewsic._mewsifyState = { stage: "home" };
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center min-h-full p-8 text-center page">
            <div class="w-24 h-24 rounded-full bg-surface-overlay border border-border-subtle flex items-center justify-center text-[#1DB954] mb-6 shadow-2xl shadow-[#1DB954]/20">${ICON}</div>
            <div class="flex items-center justify-center gap-3 mb-2">
              <h1 class="text-4xl font-black text-text-primary tracking-tight">Mewsify Importer</h1>
              <span class="text-[10px] font-bold uppercase tracking-widest text-purple-400 bg-purple-400/15 px-2 py-1 rounded-md mt-1">Experimental</span>
            </div>
            <p class="text-text-muted max-w-md mx-auto leading-relaxed mb-8">Paste a public Spotify playlist, album, or track URL to import it directly to your library.</p>
            <div class="bg-surface-raised border border-border-subtle p-6 rounded-2xl w-full max-w-md shadow-lg">
              <input type="text" id="mfy-url" placeholder="https://open.spotify.com/..." class="w-full bg-surface-overlay border border-border-subtle rounded-lg px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent mb-4"/>
              <button id="mfy-preview-btn" class="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(29,185,84,0.3)] active:scale-95">
               Import
              </button>
            </div>
          </div>`;
        document.getElementById("mfy-preview-btn")?.addEventListener("click", async () => {
          const url = (document.getElementById("mfy-url") as HTMLInputElement)?.value?.trim();
          if (!url) { window.Mewsic.ui.addNotification("Enter a Spotify URL", "error"); return; }
          const nid = window.Mewsic.ui.addNotification("Fetching link…", "info", 0);
          try {
            const raw = await invoke("fetch_spotify_playlist", { url });
            const entity = JSON.parse(raw as string)?.props?.pageProps?.state?.data?.entity;
            if (!entity) throw new Error("Could not read URL. Is it public?");

            let tracks = [];
            let name = "Imported Media";
            let cover = "";

            if (entity.type === "track") {
              const artistStr = entity.artists?.map((a: any) => a.name).join(", ");
              tracks = [{
                title: entity.title || entity.name,
                subtitle: artistStr,
                duration: entity.duration,
                audioPreview: entity.audioPreview,
                uri: entity.uri,
                isPlayable: entity.isPlayable,
              }].filter(t => t.isPlayable && t.title);
              name = `${entity.title || entity.name}`;
              cover = entity.visualIdentity?.image?.[0]?.url || entity.coverArt?.sources?.[0]?.url || "";
            } else {
              tracks = (entity.trackList || []).filter((t: any) => t.isPlayable && t.title);
              name = entity.name || "Imported Playlist";
              cover = entity.coverArt?.sources?.[0]?.url || "";
            }

            if (!tracks.length) throw new Error("No playable tracks found.");
            window.Mewsic.ui.dismissNotification(nid);
            
            (window as any).Mewsic._mewsifyState = {
              stage: "preview",
              url,
              name,
              cover,
              tracks
            };
            renderPreview(url, name, cover, tracks);
          } catch (e: any) {
            window.Mewsic.ui.dismissNotification(nid);
            window.Mewsic.ui.addNotification("Failed: " + (e.message || e), "error");
          }
        });
      };

      // ── Stage 2: Track preview ──────────────────────────────────────────────
      const renderPreview = (url: string, name: string, cover: string, tracks: any[]) => {
        const dur = (ms: number) => ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}` : "";
        container.innerHTML = `
          <div class="flex flex-col min-h-full page">
            <div class="flex items-center gap-4 p-4 border-b border-border-subtle sticky top-0 bg-surface z-10">
              <button id="mfy-back" class="p-2 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              </button>
              ${cover ? `<img src="${cover}" class="w-12 h-12 rounded-lg object-cover"/>` : ""}
              <div class="flex-1 min-w-0"><div class="font-black text-text-primary truncate">${name}</div><div class="text-text-muted text-sm">${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}</div></div>
              <div class="flex items-center gap-2">
                <button id="mfy-virt-btn" class="border border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Load Virtually
                </button>
                <button id="mfy-dl-btn" class="bg-[#1DB954] hover:bg-[#1ed760] text-black font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  ${tracks.length === 1 ? 'Download' : 'Download All'}
                </button>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-0.5">
              ${tracks.map((t, i) => `
                <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-raised transition-colors">
                  <span class="text-text-muted text-xs w-5 text-right flex-shrink-0">${i + 1}</span>
                  <div class="flex-1 min-w-0"><div class="text-sm font-semibold text-text-primary truncate">${t.title}</div><div class="text-xs text-text-muted truncate">${t.subtitle || ""}</div></div>
                  <span class="text-xs text-text-muted flex-shrink-0">${dur(t.duration)}</span>
                </div>`).join("")}
            </div>
          </div>`;
        document.getElementById("mfy-back")?.addEventListener("click", renderHome);
        document.getElementById("mfy-virt-btn")?.addEventListener("click", () => loadVirtually(name, cover, tracks));
        document.getElementById("mfy-dl-btn")?.addEventListener("click", () => startDownload(url, name, cover, tracks));
      };

      const loadVirtually = (name: string, cover: string, tracks: any[]) => {
        const playlistId = "mewsify_virt_" + Date.now();
        const existingTracks = [...window.Mewsic.library.tracks, ...window.Mewsic.library.virtualTracks];
        
        const virtualTracks = tracks.map((t: any) => {
          const match = existingTracks.find(et => et.sourceId === t.uri || et.sourceId === t.id);
          if (match) return match;
          
          return {
            id: "mewsify_" + (t.uri || Math.random()).toString().replace(/[^a-z0-9]/gi, "_"),
            title: t.title || "Unknown",
            artist: t.subtitle || "Unknown Artist",
            album: name,
            albumArtist: t.subtitle || "Unknown Artist",
            genre: "Spotify",
            duration: Math.floor((t.duration || 0) / 1000),
            filePath: `ytsearch:${t.subtitle || "Unknown Artist"} ${t.title || "Unknown Title"} official audio`,
            fileName: (t.title || "Unknown") + ".spotify",
            fileSize: 0,
            format: t.audioPreview?.url ? "mp3" : "spotify",
            provider: "spotify",
            isVirtual: true,
            coverArt: cover,
            sourceId: t.uri || "",
            dateAdded: Date.now(),
          };
        });

        virtualTracks.forEach((vt: any) => {
          const exists = existingTracks.find(et => et.id === vt.id);
          if (!exists) {
            window.Mewsic.library.addVirtualTrack(vt);
          }
        });

        if (virtualTracks.length > 1) {
          window.Mewsic.library.addPlaylist({
            id: playlistId,
            name: name + " (Virtual)",
            filePath: "",
            trackIds: virtualTracks.map((t: any) => t.id),
            createdAt: Date.now(),
            coverArt: cover,
          });
          window.Mewsic.library.playPlaylist(playlistId);
          window.Mewsic.ui.addNotification(`"${name}" loaded as virtual playlist (${virtualTracks.length} tracks)`, "success");

          // Instantly start background downloading of playlist tracks
          const musicDir = useStore.getState().musicDir;
          if (musicDir) {
            const cacheDir = `${musicDir}/.mewsic_cache`;
            const uncached = virtualTracks.filter((t: any) => t.filePath.startsWith("ytsearch:"));
            (async () => {
              const CONCURRENCY = 3;
              let index = 0;
              const worker = async () => {
                while (index < uncached.length) {
                  const track = uncached[index++];
                  try {
                    const cachedPath = await invoke<string>("download_track", {
                      musicDir: cacheDir,
                      title: track.title,
                      artist: track.artist,
                      album: track.album || name,
                      coverArt: track.coverArt || cover,
                      downloadId: `cache_${track.id}`,
                    });
                    
                    useStore.getState().updateTrack({
                      ...track,
                      filePath: cachedPath,
                    });
                  } catch (err) {
                    console.error("Failed to pre-cache track:", err);
                  }
                }
              };
              await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uncached.length) }, worker));
            })();
          }
        } else if (virtualTracks.length === 1) {
          window.Mewsic.player.setQueue(virtualTracks);
          window.Mewsic.player.setIsPlaying(true);
          window.Mewsic.ui.addNotification(`"${name}" loaded as virtual track`, "success");

          // Instantly start background downloading of the single track
          const musicDir = useStore.getState().musicDir;
          const track = virtualTracks[0];
          if (musicDir && track.filePath.startsWith("ytsearch:")) {
            const cacheDir = `${musicDir}/.mewsic_cache`;
            (async () => {
              try {
                const cachedPath = await invoke<string>("download_track", {
                  musicDir: cacheDir,
                  title: track.title,
                  artist: track.artist,
                  album: track.album || name,
                  coverArt: track.coverArt || cover,
                  downloadId: `cache_${track.id}`,
                });
                
                useStore.getState().updateTrack({
                  ...track,
                  filePath: cachedPath,
                });
              } catch (err) {
                console.error("Failed to pre-cache single track:", err);
              }
            })();
          }
        }

        window.Mewsic.ui.setView("player");
      };

      // ── Stage 3: Downloading with live progress ─────────────────────────────
      const startDownload = async (url: string, name: string, cover: string, tracks: any[], existingPlaylistId?: string) => {
        const playlistId = existingPlaylistId || "mewsify_" + Date.now();
        const musicDir = window.Mewsic.library.musicDir;

        // Initialize progress state in cache if not present
        if (!(window as any).Mewsic._mewsifyState.progress) {
          (window as any).Mewsic._mewsifyState.progress = {};
        }

        const stateObj = (window as any).Mewsic._mewsifyState;
        stateObj.stage = "downloading";
        stateObj.url = url;
        stateObj.name = name;
        stateObj.cover = cover;
        stateObj.tracks = tracks;
        stateObj.playlistId = playlistId;

        container.innerHTML = `
          <div class="flex flex-col min-h-full p-6 page">
            <div class="flex items-center gap-3 mb-4">
              ${cover ? `<img src="${cover}" class="w-12 h-12 rounded-lg object-cover"/>` : ""}
              <div><div class="font-black text-text-primary">${name}</div><div id="mfy-lbl" class="text-text-muted text-sm">Starting…</div></div>
            </div>
            <div class="w-full bg-surface-overlay rounded-full h-2 mb-4 overflow-hidden">
              <div id="mfy-bar" class="h-full bg-[#1DB954] transition-all duration-300 rounded-full" style="width:0%"></div>
            </div>
            <div class="flex-1 overflow-y-auto space-y-0.5">
              ${tracks.map((t, i) => {
                const prog = stateObj.progress[i];
                let icon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>`;
                if (prog) {
                  icon = prog.error ? FAIL : prog.file_path ? CHECK : SPIN;
                }
                return `
                <div class="flex items-center gap-3 px-3 py-2 rounded-lg">
                  <div id="mfy-ic-${i}" class="w-4 h-4 flex-shrink-0 text-text-muted">
                    ${icon}
                  </div>
                  <div class="flex-1 min-w-0"><div class="text-sm font-medium text-text-primary truncate">${t.title}</div><div class="text-xs text-text-muted truncate">${t.subtitle || ""}</div></div>
                </div>`;
              }).join("")}
            </div>
          </div>`;

        // Update progress bar and label for initial/restored state
        const updateUIFromCache = () => {
          const progressMap = stateObj.progress;
          const completedCount = Object.values(progressMap).filter((p: any) => p.file_path).length;
          const currentDownloading = Object.values(progressMap).find((p: any) => !p.file_path && !p.error);
          
          const initialPct = Math.round((completedCount / tracks.length) * 100);
          const bar = document.getElementById("mfy-bar");
          const lbl = document.getElementById("mfy-lbl");
          if (bar) bar.style.width = initialPct + "%";
          if (lbl) {
            if (currentDownloading) {
              lbl.textContent = `Downloading: ${(currentDownloading as any).track_title}`;
            } else if (completedCount > 0) {
              lbl.textContent = `${completedCount} / ${tracks.length} done`;
            }
          }
        };
        updateUIFromCache();

        const { listen } = await import("@tauri-apps/api/event");
        if (unlistenFn) unlistenFn();
        unlistenFn = await listen("spotify-import-progress", (evt: any) => {
          const p = evt.payload;
          if (p.playlist_id !== playlistId) return;

          // Save to cache
          if ((window as any).Mewsic._mewsifyState?.playlistId === playlistId) {
            (window as any).Mewsic._mewsifyState.progress[p.track_index] = p;
          }

          const done = p.file_path ? 1 : 0.5;
          const pct = Math.round(((p.track_index + done) / p.track_total) * 100);
          const bar = document.getElementById("mfy-bar");
          const lbl = document.getElementById("mfy-lbl");
          if (bar) bar.style.width = pct + "%";
          if (lbl) lbl.textContent = p.file_path ? `${p.track_index + 1} / ${p.track_total} done` : `Downloading: ${p.track_title}`;
          const ic = document.getElementById(`mfy-ic-${p.track_index}`);
          if (ic) ic.innerHTML = p.error ? FAIL : p.file_path ? CHECK : SPIN;
        });

        if (!existingPlaylistId) {
          try {
            const result: any = await invoke("import_spotify_playlist", { url, musicDir, playlistId });
            if (unlistenFn) { unlistenFn(); unlistenFn = null; }

            const savedTracks: any[] = [];
            for (const t of (result.tracks || [])) {
              const track = {
                id: "mewsify_" + (t.spotifyUri || t.filePath).replace(/[^a-z0-9]/gi, "_"),
                title: t.title, artist: t.artist, album: t.album, albumArtist: t.artist,
                genre: "Spotify", duration: t.duration, filePath: t.filePath,
                fileName: t.filePath.split("/").pop() || t.title,
                fileSize: 0, format: "mp3", provider: "spotify",
                isVirtual: false, coverArt: t.coverArt, dateAdded: Date.now(),
                sourceId: t.spotifyUri,
              };
              window.Mewsic.library.addTracks([track]);
              savedTracks.push(track);
            }

            if (savedTracks.length > 1) {
              window.Mewsic.library.addPlaylist({
                id: playlistId, name: result.playlistName || name, filePath: "",
                trackIds: savedTracks.map((t: any) => t.id), createdAt: Date.now(), coverArt: result.coverArt || cover,
              });
            }

            const bar = document.getElementById("mfy-bar");
            const lbl = document.getElementById("mfy-lbl");
            if (bar) bar.style.width = "100%";
            if (lbl) lbl.textContent = `Done! ${savedTracks.length} tracks saved.`;

            if (savedTracks.length > 1) {
              window.Mewsic.ui.addNotification(`"${result.playlistName}" imported — ${savedTracks.length} tracks!`, "success");
            } else if (savedTracks.length === 1) {
              window.Mewsic.ui.addNotification(`"${savedTracks[0].title}" imported successfully!`, "success");
            }

            // Clear state cache
            (window as any).Mewsic._mewsifyState = { stage: "home" };

            setTimeout(() => {
              if (savedTracks.length > 1) {
                window.Mewsic.library.playPlaylist(playlistId);
                window.Mewsic.ui.setView("player");
              } else if (savedTracks.length === 1) {
                window.Mewsic.player.setQueue(savedTracks);
                window.Mewsic.player.setIsPlaying(true);
                window.Mewsic.ui.setView("player");
              }
            }, 1500);
          } catch (e: any) {
            if (unlistenFn) { unlistenFn(); unlistenFn = null; }
            window.Mewsic.ui.addNotification("Import failed: " + (e.message || e), "error");
            (window as any).Mewsic._mewsifyState = { stage: "home" };
          }
        }
      };

      // Restore stage from cache
      const state = (window as any).Mewsic._mewsifyState;
      if (state && state.stage === "downloading") {
        startDownload(state.url, state.name, state.cover, state.tracks, state.playlistId);
      } else if (state && state.stage === "preview") {
        renderPreview(state.url, state.name, state.cover, state.tracks);
      } else {
        renderHome();
      }
    },
    cleanup: () => { }
  });
}

export interface PluginManifest {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  [key: string]: any;
}

export interface PluginData {
  id: string;
  manifest: PluginManifest;
  js_content: string | null;
  css_content: string | null;
}

let cachedPlugins: PluginData[] | null = null;
let inFlightFetch: Promise<PluginData[]> | null = null;
const pluginListeners = new Set<(plugins: PluginData[]) => void>();

export async function fetchPlugins(force = false): Promise<PluginData[]> {
  if (!force && cachedPlugins) {
    return cachedPlugins;
  }
  if (!force && inFlightFetch) {
    return inFlightFetch;
  }
  inFlightFetch = (async () => {
    try {
      const loaded = await invoke<PluginData[]>("get_plugins");
      cachedPlugins = loaded;
      pluginListeners.forEach((fn) => {
        try { fn(loaded); } catch (e) { console.error("Plugin listener error:", e); }
      });
      return loaded;
    } finally {
      inFlightFetch = null;
    }
  })();
  return inFlightFetch;
}

export function invalidatePluginCache() {
  return fetchPlugins(true);
}

export function usePlugins(isRoot = false) {
  const [plugins, setPlugins] = useState<PluginData[]>(() => cachedPlugins || []);
  const [error, setError] = useState<string | null>(null);
  const pluginsRef = useRef<PluginData[]>(cachedPlugins || []);
  const minecraftIntegrationEnabled = useStore(s => s.minecraftIntegrationEnabled);
  const mewsifyIntegrationEnabled = useStore(s => s.mewsifyIntegrationEnabled);

  useEffect(() => {
    let isCancelled = false;

    const onUpdate = (updated: PluginData[]) => {
      if (isCancelled) return;
      setPlugins(updated);
      pluginsRef.current = updated;
    };
    pluginListeners.add(onUpdate);

    async function loadPlugins() {
      try {
        const loadedPlugins = await fetchPlugins();
        if (isCancelled) return;
        setPlugins(loadedPlugins);
        pluginsRef.current = loadedPlugins;

        if (!isRoot) return;

        initPluginApi();
        if (mewsifyIntegrationEnabled) {
          runMewsifyPlugin();
        } else {
          if (window.Mewsic) {
            window.Mewsic.ui.unregisterSidebarComponent("mewsify");
            window.Mewsic.ui.unregisterTab("plugin:mewsify");
          }
        }

        if (minecraftIntegrationEnabled) {
          if (window.Mewsic && typeof window.Mewsic.disconnectMinecraft !== "function") {
            try {
              runMinecraftPlugin();
            } catch (e) {
              console.error("Error executing Minecraft plugin:", e);
            }
          }
        } else {
          if (window.Mewsic && typeof window.Mewsic.disconnectMinecraft === "function") {
            try { window.Mewsic.disconnectMinecraft(); } catch (e) { }
          }
        }

        const disabledPlugins: string[] = JSON.parse(localStorage.getItem("mewsic_disabled_plugins") || "[]");

        for (const plugin of loadedPlugins) {
          if (disabledPlugins.includes(plugin.id)) continue;

          if (plugin.css_content) {
            const styleId = `plugin-style-${plugin.id}`;
            if (!document.getElementById(styleId)) {
              const style = document.createElement("style");
              style.id = styleId;
              style.innerHTML = plugin.css_content;
              document.head.appendChild(style);
            }
          }

          if (plugin.js_content) {
            const scriptId = `plugin-script-${plugin.id}`;
            if (!document.getElementById(scriptId)) {
              try {
                const blob = new Blob([plugin.js_content], { type: "application/javascript" });
                const url = URL.createObjectURL(blob);
                const script = document.createElement("script");
                script.id = scriptId;
                script.src = url;
                script.onload = () => {
                  URL.revokeObjectURL(url);
                };
                script.onerror = (e) => {
                  URL.revokeObjectURL(url);
                  console.error(`Plugin script error (${plugin.id}):`, e);
                };
                document.body.appendChild(script);
              } catch (e) {
                console.error(`Failed to execute plugin ${plugin.id}:`, e);
              }
            }
          }
        }
      } catch (e: any) {
        if (isCancelled) return;
        console.error("Failed to load external plugins:", e);
        setError(e.toString());
      }
    }

    loadPlugins();

    return () => {
      isCancelled = true;
      pluginListeners.delete(onUpdate);
      if (!isRoot) return;

      for (const plugin of pluginsRef.current) {
        document.getElementById(`plugin-style-${plugin.id}`)?.remove();
        document.getElementById(`plugin-script-${plugin.id}`)?.remove();
      }
      if (window.Mewsic && typeof window.Mewsic.disconnectMinecraft === "function") {
        try { window.Mewsic.disconnectMinecraft(); } catch (e) { }
      }
      if (window.Mewsic) {
        window.Mewsic.ui.unregisterSidebarComponent("mewsify");
        window.Mewsic.ui.unregisterTab("plugin:mewsify");
      }
    };
  }, [minecraftIntegrationEnabled, mewsifyIntegrationEnabled, isRoot]);

  const refetch = useCallback(() => fetchPlugins(true), []);

  return { plugins, error, refetch };
}
