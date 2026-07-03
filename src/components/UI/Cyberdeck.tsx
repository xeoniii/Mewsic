import React, { useState, useEffect, useRef } from "react";
import { Terminal, Cpu, HardDrive, Trash2, RefreshCw, X, Command } from "lucide-react";
import { useStore } from "../../store";
import { useLibrary } from "../../hooks/useLibrary";
import { clearImageCache, getOSName, savePlaylist } from "../../utils/tauriApi";
import { useShallow } from "zustand/react/shallow";
import { version } from "../../../package.json";
import type { Track } from "../../types";

interface LogEntry {
  type: "info" | "success" | "error" | "input" | "component";
  text: React.ReactNode;
}
export function Cyberdeck({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([
    { type: "info", text: `MEWSIC CYBERDECK v${version} INITIALIZED...` },
    { type: "info", text: "TYPE 'HELP' FOR AVAILABLE COMMANDS." },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    tracks, playlists, accentColor, setAccentColor, isPlaying, setIsPlaying, skipForward, skipBackward, playNext, playPrev,
    volume, setVolume, shuffleEnabled, toggleShuffle, repeatMode, setRepeatMode,
    toggleMute, theme, setTheme, guiScale, setGuiScale,
    trayEnabled, setTrayEnabled, customTitlebar, setCustomTitlebar,
    discordEnabled, setDiscordEnabled, lowEndMode, setLowEndMode,
    systemNotifications, setSystemNotifications,
    musicDir, setMusicDir, playlistsDir, setPlaylistsDir, coversDir, setCoversDir,
    isDemoMode, setDemoMode,
    isDevMode, setDevMode,
    sharonMode, setSharonMode,
    purgeVirtualTracks
  } = useStore(useShallow((s) => ({
    tracks: s.tracks, playlists: s.playlists, accentColor: s.accentColor, setAccentColor: s.setAccentColor,
    isPlaying: s.isPlaying, setIsPlaying: s.setIsPlaying, skipForward: s.skipForward, skipBackward: s.skipBackward,
    playNext: s.playNext, playPrev: s.playPrev, volume: s.volume, setVolume: s.setVolume,
    shuffleEnabled: s.shuffleEnabled, toggleShuffle: s.toggleShuffle, repeatMode: s.repeatMode, setRepeatMode: s.setRepeatMode,
    toggleMute: s.toggleMute, theme: s.theme, setTheme: s.setTheme, guiScale: s.guiScale, setGuiScale: s.setGuiScale,
    trayEnabled: s.trayEnabled, setTrayEnabled: s.setTrayEnabled, customTitlebar: s.customTitlebar, setCustomTitlebar: s.setCustomTitlebar,
    discordEnabled: s.discordEnabled, setDiscordEnabled: s.setDiscordEnabled, lowEndMode: s.lowEndMode, setLowEndMode: s.setLowEndMode,
    systemNotifications: s.systemNotifications, setSystemNotifications: s.setSystemNotifications,
    musicDir: s.musicDir, setMusicDir: s.setMusicDir, playlistsDir: s.playlistsDir, setPlaylistsDir: s.setPlaylistsDir,
    coversDir: s.coversDir, setCoversDir: s.setCoversDir, isDemoMode: s.isDemoMode, setDemoMode: s.setDemoMode,
    isDevMode: s.isDevMode, setDevMode: s.setDevMode,
    sharonMode: s.sharonMode, setSharonMode: s.setSharonMode,
    purgeVirtualTracks: s.purgeVirtualTracks
  })));
  const { rescanDirectory } = useLibrary();
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLog = (text: React.ReactNode, type: LogEntry["type"] = "info") => {
    setLogs(prev => [...prev, { type, text }]);
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim().toLowerCase();
    const args = cmd.split(" ");
    const action = args[0];

    addLog(`> ${input}`, "input");
    setInput("");

    switch (action) {
      case "help":
        addLog("--- SYSTEM COMMANDS ---");
        addLog("  MEWFETCH      - APP INFO");
        addLog("  STATS         - TELEMETRY");
        addLog("  DEVMODE       - UNLOCK EXPERIMENTAL TOOLS");
        addLog("  DEMO-MODE     - TOGGLE PRIVACY MODE");
        addLog("  CLEAR         - RESET TERMINAL LOGS");
        addLog("  REFRESHPLAYLIST - REGENERATE PLAYLIST FILES");
        addLog("  PURGE-VIRTUAL - REMOVE ALL VIRTUAL TRACKS FROM LIBRARY");
        addLog("  EXIT / QUIT   - CLOSE");
        addLog("--- SETTINGS CONTROL ---");
        addLog("  SET <KEY> <VAL> - CONFIGURE APP");
        addLog("--- TRANSPORT ---");
        addLog("  PLAY / PAUSE / NEXT / PREV");
        addLog("  VOL <0-100> / MUTE");
        addLog("--- DEV TOOLS ---");
        addLog("  CONFIG        - DUMP FULL STORE JSON");
        addLog("  INSPECT <ID>  - DUMP TRACK METADATA");
        addLog("  RELOAD        - FORCE WINDOW REFRESH");
        addLog("  BENCH         - PERFORMANCE TEST");
        addLog("  INJECT-MOCK   - UI STRESS TEST");
        addLog("  CLEAR CACHE   - PURGE IMAGES");
        addLog("TIP: TYPE '<COMMAND> HELP' FOR DETAILS.");
        break;


      case "devmode":
        if (args[1] === "help") {
          addLog("USAGE: DEVMODE <ON/OFF>");
          addLog("UNLOCKS EXPERIMENTAL FEATURES LIKE THE AUDIO ENGINE.");
          break;
        }
        const devState = args[1] === "on";
        setDevMode(devState);
        addLog(`DEVELOPER MODE: ${devState ? 'ENABLED' : 'DISABLED'}`, "success");
        break;

      case "demo-mode":
        if (args[1] === "help") {
          addLog("USAGE: DEMO-MODE <ON/OFF>");
          addLog("PRIVACY MODE OBFUSCATES TRACK TITLES, ARTISTS, AND PATHS.");
          break;
        }
        const demoState = args[1] === "on";
        setDemoMode(demoState);
        addLog(`DEMO MODE: ${demoState ? 'ENABLED' : 'DISABLED'}`, "success");
        break;

      case "secretmode":
        if (args[1] === "sharon") {
          setSharonMode(!sharonMode);
          addLog("ACCESS GRANTED. WELCOME TO SHITVILLE.", "success");
        } else {
          addLog(`UNKNOWN COMMAND: ${action}. TYPE 'HELP' FOR LIST.`, "error");
        }
        break;

      case "set":
        if (args[1] === "help") {
          addLog("USAGE: SET <KEY> <VALUE>");
          addLog("KEYS & VALID VALUES:");
          addLog("  THEME    - DARK | LIGHT");
          addLog("  ACCENT   - MINT | SAPPHIRE | VIOLET | ROSE | AMBER | CYAN");
          addLog("             ORANGE | FUCHSIA | EMERALD | INDIGO");
          addLog("  SCALE    - 0.8 TO 1.5 (GUI SCALE MULTIPLIER)");
          addLog("  TRAY     - ON | OFF (SYSTEM TRAY ICON)");
          addLog("  DISCORD  - ON | OFF (RICH PRESENCE)");
          addLog("  TITLEBAR - ON | OFF (CUSTOM DECORATIONS)");
          addLog("  LOWEND   - ON | OFF (DISABLE ANIMATIONS)");
          addLog("  NOTIFS   - ON | OFF (SYSTEM NOTIFICATIONS)");
          break;
        }
        const key = args[1];
        const val = args[2];
        if (!key || !val) { addLog("ERROR: MISSING KEY OR VALUE. TYPE 'SET HELP'.", "error"); break; }

        switch (key) {
          case "theme":
            if (val === "dark" || val === "light") { setTheme(val); addLog(`THEME -> ${val.toUpperCase()}`, "success"); }
            else addLog("INVALID THEME (DARK/LIGHT).", "error");
            break;
          case "accent":
            const presets = ["mint", "sapphire", "violet", "rose", "amber", "cyan", "orange", "fuchsia", "emerald", "custom"];
            if (presets.includes(val.toLowerCase())) {
              setAccentColor(val.toLowerCase() as any);
              addLog(`ACCENT -> ${val.toUpperCase()}`, "success");
            } else {
              addLog(`INVALID ACCENT. VALID: ${presets.join(", ").toUpperCase()}`, "error");
            }
            break;
          case "scale":
            const s = parseFloat(val);
            if (!isNaN(s) && s >= 0.8 && s <= 1.5) { setGuiScale(s); addLog(`SCALE -> ${s}x`, "success"); }
            else addLog("INVALID SCALE (0.8-1.5).", "error");
            break;
          case "tray":
            setTrayEnabled(val === "on");
            addLog(`TRAY -> ${val.toUpperCase()}`, "success");
            break;
          case "discord":
            setDiscordEnabled(val === "on");
            addLog(`DISCORD RPC -> ${val.toUpperCase()}`, "success");
            break;
          case "titlebar":
            setCustomTitlebar(val === "on");
            addLog(`CUSTOM TITLEBAR -> ${val.toUpperCase()}`, "success");
            break;
          case "lowend":
            setLowEndMode(val === "on");
            addLog(`LOW-END MODE -> ${val.toUpperCase()}`, "success");
            break;
          case "notifs":
            setSystemNotifications(val === "on");
            addLog(`NOTIFICATIONS -> ${val.toUpperCase()}`, "success");
            break;
          default:
            addLog(`UNKNOWN SETTING: ${key}`, "error");
        }
        break;

      // --- Direct Command Shortcuts ---
      case "lowend":
        const leState = args[1] === "on";
        setLowEndMode(leState);
        addLog(`LOW-END MODE: ${leState ? 'ON' : 'OFF'}`, "success");
        break;

      case "dark":
      case "light":
        setTheme(action as any);
        addLog(`THEME -> ${action.toUpperCase()}`, "success");
        break;

      case "mint":
      case "sapphire":
      case "violet":
      case "rose":
      case "amber":
      case "cyan":
      case "orange":
      case "fuchsia":
      case "emerald":
      case "custom":
        setAccentColor(action as any);
        addLog(`ACCENT -> ${action.toUpperCase()}`, "success");
        break;

      case "config":
        addLog("DUMPING GLOBAL STORE...");
        console.log("FULL STORE DUMP:", useStore.getState());
        addLog(JSON.stringify(useStore.getState(), null, 2).substring(0, 500) + "...", "info");
        addLog("FULL OBJECT EMITTED TO BROWSER CONSOLE.", "success");
        break;

      case "inspect":
        if (args[1] === "help") {
          addLog("USAGE: INSPECT <TRACK_ID>");
          addLog("DUMPS THE FULL RAW METADATA OBJECT FOR A TRACK.");
          addLog("TIP: COPY THE TRACK ID FROM THE BROWSER CONSOLE OR APP STATE.");
          break;
        }
        if (!args[1]) { addLog("ERROR: TRACK ID REQUIRED.", "error"); break; }
        const track = tracks.find(t => t.id === args[1]);
        if (track) {
          addLog(`METADATA FOR ${track.id}:`);
          addLog(JSON.stringify(track, null, 2), "info");
        } else {
          addLog("TRACK NOT FOUND.", "error");
        }
        break;

      case "reload":
        addLog("FORCING WINDOW RELOAD...");
        window.location.reload();
        break;

      case "bench":
        addLog("STARTING SCAN BENCHMARK...");
        const start = performance.now();
        await rescanDirectory();
        const end = performance.now();
        addLog(`SCAN COMPLETED IN ${(end - start).toFixed(2)}ms`, "success");
        break;

      case "inject-mock":
        const mockTracks: any[] = Array.from({ length: 50 }).map((_, i) => ({
          id: `mock-${i}`,
          title: `Mock Track ${i + 1}`,
          artist: "The Testers",
          album: "Stress Test",
          duration: 120 + i,
          filePath: `/mock/path/${i}.mp3`,
          dateAdded: Date.now(),
          format: "mp3"
        }));
        useStore.getState().addTracks(mockTracks);
        addLog("INJECTED 50 MOCK TRACKS", "success");
        break;

      case "clear-mocks":
        addLog("PURGING MOCK DATA...", "info");
        const realTracks = tracks.filter(t => !t.id.startsWith("mock-"));
        useStore.getState().setTracks(realTracks);
        addLog("MOCK TRACKS REMOVED", "success");
        break;

      case "purge-virtual":
        if (args[1] === "help") {
          addLog("USAGE: PURGE-VIRTUAL");
          addLog("REMOVES ALL VIRTUAL TRACKS (E.G. PLUGINS/STREAMED TRACKS) FROM THE LIBRARY.");
          break;
        }
        addLog("PURGING ALL VIRTUAL TRACKS FROM LIBRARY...", "info");
        purgeVirtualTracks();
        addLog("VIRTUAL TRACKS PURGED SUCCESSFULLY.", "success");
        break;

      case "play":
        setIsPlaying(true);
        addLog("PLAYBACK INITIATED.", "success");
        break;

      case "pause":
        setIsPlaying(false);
        addLog("PLAYBACK SUSPENDED.", "success");
        break;

      case "next":
        playNext();
        addLog("SKIPPING TO NEXT TRACK.");
        break;

      case "prev":
        playPrev();
        addLog("REVERTING TO PREVIOUS TRACK.");
        break;

      case "vol":
        if (args[1] === "help") {
          addLog("USAGE: VOL <0-100>");
          addLog("SETS THE MASTER VOLUME LEVEL.");
          break;
        }
        if (args[1]) {
          const v = parseInt(args[1]) / 100;
          if (!isNaN(v) && v >= 0 && v <= 1) {
            setVolume(v);
            addLog(`VOLUME LEVEL SET TO: ${args[1]}%`, "success");
          } else {
            addLog("ERROR: INVALID VOLUME RANGE (0-100).", "error");
          }
        } else {
          addLog(`CURRENT VOLUME: ${Math.round(volume * 100)}%`);
        }
        break;

      case "mute":
        toggleMute();
        addLog("AUDIO MUTE TOGGLED.");
        break;

      case "ls":
        if (args[1] === "help") {
          addLog("USAGE: LS <CATEGORY>");
          addLog("CATEGORIES:");
          addLog("  PLAYLISTS - LIST ALL COLLECTIONS");
          break;
        }
        if (args[1] === "playlists") {
          addLog("REGISTERED PLAYLISTS:");
          playlists.forEach(p => addLog(`  - ${p.name.toUpperCase()} [${p.trackIds.length} TRACKS]`));
        } else {
          addLog("USAGE: LS PLAYLISTS");
        }
        break;

      case "mewfetch":
        if (args[1] === "help") {
          addLog("USAGE: MEWFETCH");
          addLog("DISPLAYS SYSTEM TELEMETRY AND APP BRANDING.");
          break;
        }
        addLog(
          <div className="flex gap-12 py-4 items-center">
            <div className="text-accent font-black whitespace-pre leading-[1.1] text-[26px] drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]">
{`    ,    ,
   | \\--/ |
   ( (0_0)(
    \\==Y==/
    /'-"-'>
  _/ < ; (;
 / ,_ |_|_\\
( _,,)\\,,),)
\\ '.___
 '-----'`}
            </div>
             <div className="flex flex-col justify-center">
              <p className="text-accent font-black text-sm uppercase tracking-[0.3em] mb-4">
                {sharonMode ? "Mewsic Cyberdick" : "Mewsic Cyberdeck"}
              </p>

              <div className="flex gap-6 font-mono text-xs">
                <div className="flex flex-col gap-1.5 text-accent/90 font-medium tracking-widest">
                  <span>OS</span>
                  <span>VER</span>
                  <span>THEME</span>
                  <span>ACCENT</span>
                  <span>TRACKS</span>
                  <span>PLAYLISTS</span>
                  <span>STATUS</span>
                </div>
                <div className="flex flex-col gap-1.5 text-text-secondary tracking-wide">
                  <span>{getOSName().toUpperCase()}-X64</span>
                  <span>v{version}</span>
                  <span>{theme.toUpperCase()}</span>
                  <span>{accentColor.toUpperCase()}</span>
                  <span>{tracks.length}</span>
                  <span>{playlists.length}</span>
                  <span>{isPlaying ? "PLAYING" : "IDLE"}</span>
                </div>
              </div>
            </div>
          </div>,
          "component"
        );
        break;

      case "stats":
        addLog("LIBRARY TELEMETRY:");
        addLog(`  TOTAL TRACKS: ${tracks.length}`);
        addLog(`  TOTAL PLAYLISTS: ${playlists.length}`);
        addLog(`  ACCENT COLOR: ${accentColor}`);
        addLog(`  GUI SCALE: ${guiScale}x`);
        break;

      case "clear":
        if (args[1] === "cache") {
          await clearImageCache();
          addLog("IMAGE CACHE PURGED SUCCESSFULLY.", "success");
        } else {
          setLogs([]);
        }
        break;

      case "rescan":
        addLog("INITIATING BACKGROUND RESCAN...");
        rescanDirectory();
        addLog("RESCAN TASK DISPATCHED.", "success");
        break;

      case "refreshplaylist":
        if (args[1] === "help") {
          addLog("USAGE: REFRESHPLAYLIST [PLAYLIST_NAME]");
          addLog("REGENERATES THE PHYSICAL JSON FILE ON DISK FOR A PLAYLIST");
          addLog("WITHOUT LOSING ANY TRACKS OR METADATA.");
          addLog("IF NO NAME IS GIVEN, ALL REGISTERED PLAYLISTS ARE REGENERATED.");
          break;
        }

        const playlistNameArg = args.slice(1).join(" ").trim().toLowerCase();

        if (playlistNameArg) {
          const target = playlists.find(p => p.name.toLowerCase() === playlistNameArg || p.id.toLowerCase() === playlistNameArg);
          if (!target) {
            addLog(`ERROR: PLAYLIST "${playlistNameArg}" NOT FOUND.`, "error");
            break;
          }
          addLog(`REGENERATING PLAYLIST "${target.name}" ON DISK...`, "info");
          try {
            const hydrated = {
              ...target,
              tracks: target.trackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => !!t)
            };
            await savePlaylist(hydrated);
            addLog(`SUCCESSFULLY REGENERATED "${target.name}" JSON FILE.`, "success");
          } catch (err) {
            addLog(`FAILED TO SAVE PLAYLIST: ${err}`, "error");
          }
        } else {
          if (playlists.length === 0) {
            addLog("NO PLAYLISTS FOUND TO REGENERATE.", "error");
            break;
          }
          addLog(`REGENERATING ${playlists.length} PLAYLISTS...`, "info");
          let count = 0;
          for (const pl of playlists) {
            try {
              const hydrated = {
                ...pl,
                tracks: pl.trackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => !!t)
              };
              await savePlaylist(hydrated);
              addLog(`  - REGENERATED "${pl.name}"`, "success");
              count++;
            } catch (err) {
              addLog(`  - FAILED "${pl.name}": ${err}`, "error");
            }
          }
          addLog(`COMPLETED: ${count}/${playlists.length} PLAYLISTS REGENERATED.`, "success");
        }
        break;

      case "setversion":
        if (args[1] === "help") {
          addLog("USAGE: SETVERSION <VERSION>");
          addLog("MOCKS THE APP VERSION TO TEST UPDATER LOGIC. (E.G. '0.0.1' TO TRIGGER UPDATE)");
          addLog("TYPE 'SETVERSION CLEAR' TO REMOVE MOCK.");
          break;
        }
        if (!args[1]) {
          addLog("ERROR: NO VERSION PROVIDED", "error");
          break;
        }
        if (args[1] === "clear") {
          localStorage.removeItem("mewsic-mock-version");
          addLog("MOCK VERSION CLEARED.", "success");
        } else {
          localStorage.setItem("mewsic-mock-version", args[1]);
          addLog(`APP VERSION MOCKED TO v${args[1]}`, "success");
        }
        addLog("RELOAD APP (CTRL+R) FOR CHANGES TO TAKE EFFECT.", "info");
        break;

      case "setos":
        if (args[1] === "help") {
          addLog("USAGE: SETOS <WINDOWS|MACOS|LINUX>");
          addLog("MOCKS THE SYSTEM OS TO TEST PLATFORM-SPECIFIC UI.");
          addLog("TYPE 'SETOS CLEAR' TO REMOVE MOCK.");
          break;
        }
        if (!args[1]) {
          addLog("ERROR: NO OS PROVIDED", "error");
          break;
        }

        const osArg = args[1].toLowerCase();
        if (osArg === "clear") {
          localStorage.removeItem("mewsic-mock-os");
          addLog("MOCK OS CLEARED.", "success");
        } else if (osArg === "windows") {
          localStorage.setItem("mewsic-mock-os", "Windows");
          addLog("OS MOCKED TO WINDOWS.", "success");
        } else if (osArg === "macos") {
          localStorage.setItem("mewsic-mock-os", "macOS");
          addLog("OS MOCKED TO MACOS.", "success");
        } else if (osArg === "linux") {
          localStorage.setItem("mewsic-mock-os", "Linux");
          addLog("OS MOCKED TO LINUX.", "success");
        } else {
          addLog("ERROR: INVALID OS. VALID: WINDOWS, MACOS, LINUX.", "error");
        }
        addLog("RELOAD APP (CTRL+SHIFT+R) FOR CHANGES TO TAKE EFFECT.", "info");
        break;

      case "exit":
      case "quit":
        onClose();
        break;

      default:
        addLog(`UNKNOWN COMMAND: ${action}. TYPE 'HELP' FOR LIST.`, "error");
    }
  };

  const COMMAND_SUGGESTIONS = [
    { cmd: "help", desc: "List all available system commands" },
    { cmd: "mewfetch", desc: "Display app information and stats" },
    { cmd: "stats", desc: "Show telemetry and system stats" },
    { cmd: "devmode on", desc: "Unlock experimental features" },
    { cmd: "devmode off", desc: "Disable experimental features" },
    { cmd: "demo-mode on", desc: "Enable privacy mode (obfuscate tracks)" },
    { cmd: "demo-mode off", desc: "Disable privacy mode" },
    { cmd: "clear", desc: "Reset terminal logs" },
    { cmd: "refreshplaylist", desc: "Regenerate playlist files" },
    { cmd: "purge-virtual", desc: "Remove all virtual tracks from library" },
    { cmd: "exit", desc: "Close the application" },
    { cmd: "quit", desc: "Close the application" },
    { cmd: "set theme dark", desc: "Set theme to dark mode" },
    { cmd: "set theme light", desc: "Set theme to light mode" },
    { cmd: "set accent mint", desc: "Change accent color to mint" },
    { cmd: "set accent sapphire", desc: "Change accent color to sapphire" },
    { cmd: "set accent violet", desc: "Change accent color to violet" },
    { cmd: "set accent rose", desc: "Change accent color to rose" },
    { cmd: "set accent amber", desc: "Change accent color to amber" },
    { cmd: "set accent cyan", desc: "Change accent color to cyan" },
    { cmd: "set accent emerald", desc: "Change accent color to emerald" },
    { cmd: "set scale 1.0", desc: "Adjust GUI scale multiplier (0.8 - 1.5)" },
    { cmd: "set tray on", desc: "Enable system tray icon" },
    { cmd: "set tray off", desc: "Disable system tray icon" },
    { cmd: "set discord on", desc: "Enable Discord Rich Presence" },
    { cmd: "set discord off", desc: "Disable Discord Rich Presence" },
    { cmd: "set titlebar on", desc: "Enable custom window decorations" },
    { cmd: "set titlebar off", desc: "Disable custom window decorations" },
    { cmd: "set lowend on", desc: "Enable low-end mode (disable animations)" },
    { cmd: "set lowend off", desc: "Disable low-end mode" },
    { cmd: "set notifs on", desc: "Enable system notifications" },
    { cmd: "set notifs off", desc: "Disable system notifications" },
    { cmd: "play", desc: "Resume playback" },
    { cmd: "pause", desc: "Pause playback" },
    { cmd: "next", desc: "Skip to next track" },
    { cmd: "prev", desc: "Return to previous track" },
    { cmd: "vol ", desc: "Set playback volume (0 - 100)" },
    { cmd: "mute", desc: "Toggle mute state" },
    { cmd: "config", desc: "Dump full store JSON to console" },
    { cmd: "inspect ", desc: "Dump raw track metadata (needs track ID)" },
    { cmd: "reload", desc: "Force window refresh" },
    { cmd: "bench", desc: "Run directory scan benchmark" },
    { cmd: "inject-mock", desc: "Inject 50 mock tracks for UI stress test" },
    { cmd: "clear cache", desc: "Purge image cache" },
    { cmd: "setversion ", desc: "Mock the app version for testing update dialogs" },
    { cmd: "setos ", desc: "Mock the operating system name (windows/macos/linux)" },
  ];

  const filteredSuggestions = input.trim()
    ? COMMAND_SUGGESTIONS.filter(s => s.cmd.startsWith(input.toLowerCase())).slice(0, 5)
    : [];

  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredSuggestions.length === 0) return;

    if (e.key === "Tab") {
      e.preventDefault();
      setInput(filteredSuggestions[selectedSuggestionIndex].cmd + " ");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex(i => (i > 0 ? i - 1 : filteredSuggestions.length - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex(i => (i < filteredSuggestions.length - 1 ? i + 1 : 0));
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-[80vh] bg-black/95 backdrop-blur-3xl border-2 rounded-[2rem] overflow-hidden shadow-[0_0_80px_rgba(var(--accent-rgb),0.2)] relative animate-in zoom-in-95 duration-500 flex flex-col font-mono"
        style={{ borderColor: 'var(--accent)' }}
        onClick={e => e.stopPropagation()}
      >
        {
  // This is the header section
}
        <div
          className="flex items-center justify-between px-8 py-5 border-b bg-accent/10"
          style={{ borderBottomColor: 'rgba(var(--accent-rgb), 0.4)' }}
        >
          <div className="flex items-center gap-3">
            <Terminal size={16} className="text-accent animate-pulse" />
            <span className="text-[11px] font-black text-accent tracking-[0.4em] uppercase shadow-accent">
              {sharonMode ? "Mewsic Cyberdick" : "Mewsic Cyberdeck"}
            </span>
          </div>
          <button onClick={onClose} className="text-accent/60 hover:text-accent transition-all hover:scale-110 p-1">
            <X size={20} />
          </button>
        </div>

        {
  // This is the output part
}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-3 scrollbar-hide select-text"
        >
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 text-[12px] leading-relaxed group">
              <span className={`
                ${log.type === 'success' ? 'text-accent font-bold' : ''}
                ${log.type === 'error' ? 'text-red-500 font-bold' : ''}
                ${log.type === 'input' ? (theme === 'dark' ? 'text-white font-bold' : 'text-black font-bold') : (theme === 'dark' ? 'text-white/80' : 'text-black/80')}
              `}>
                {log.text}
              </span>
            </div>
          ))}
        </div>

        {
  // This is the suggestions part
}
        {filteredSuggestions.length > 0 && (
          <div
            className="border-t flex flex-col gap-0.5 p-2 bg-surface-overlay backdrop-blur-3xl"
            style={{ borderTopColor: 'rgba(var(--accent-rgb), 0.3)' }}
          >
            {filteredSuggestions.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-2 cursor-pointer rounded-lg transition-colors group ${i === selectedSuggestionIndex ? 'bg-accent/20' : 'hover:bg-accent/10'}`}
                onClick={() => {
                  setInput(s.cmd + " ");
                  inputRef.current?.focus();
                }}
              >
                <span className={`font-bold transition-colors ${i === selectedSuggestionIndex ? 'text-white' : 'text-accent group-hover:text-white'}`}>{s.cmd}</span>
                <span className={`text-xs truncate transition-colors ${i === selectedSuggestionIndex ? 'text-accent' : 'text-text-muted group-hover:text-accent/80'}`}>{s.desc}</span>
              </div>
            ))}
          </div>
        )}

        {
  // This is the input area part
}
        <form
          onSubmit={handleCommand}
          className="p-5 border-t bg-accent/10 flex items-center gap-4"
          style={{ borderTopColor: 'rgba(var(--accent-rgb), 0.6)' }}
        >
          <Command size={16} className="text-accent/60" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`flex-1 bg-transparent border-none outline-none text-sm font-bold placeholder:opacity-20 ${theme === 'dark' ? 'text-white placeholder:text-white' : 'text-black placeholder:text-black'}`}
            placeholder="ENTER COMMAND..."
            spellCheck={false}
            autoComplete="off"
          />
        </form>

        {
  // This is the status bar part
}
        <div
          className="px-6 py-3 bg-accent/20 border-t flex items-center justify-between rounded-b-[calc(1rem-2px)]"
          style={{ borderTopColor: 'rgba(var(--accent-rgb), 0.6)' }}
        >
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-accent opacity-80" />
              <span className="text-[10px] text-accent opacity-80 font-black tracking-widest uppercase">CPU: OPTIMAL</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive size={12} className="text-accent opacity-80" />
              <span className="text-[10px] text-accent opacity-80 font-black tracking-widest uppercase">DISK: {tracks.length} OBJ</span>
            </div>
          </div>
          <span className="text-[10px] text-accent opacity-30 font-mono tracking-tighter">NODE_MWS_CORE_v{version}</span>
        </div>
      </div>
    </div>
  );
}
