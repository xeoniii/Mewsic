import React from "react";
import {
  Home, Library, Settings, Music2, Plus,
  ListMusic, ChevronRight, Loader2, Mic2, Globe, Download, Activity, Puzzle, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "../../hooks/useLibrary";
import type { ViewId, Track } from "../../types";
import { useEffect, useState } from "react";
import { getCoverArtSync } from "../../utils/tauriApi";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: ViewId;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  return (
    <button
      onClick={onClick}
      className={`nav-item w-full justify-center ${!sidebarCollapsed ? "md:justify-start" : ""} ${active ? "active" : ""}`}
      title={label}
    >
      <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
      <span className={`flex-1 text-left hidden truncate ${!sidebarCollapsed ? "md:block" : ""}`}>{label}</span>
    </button>
  );
}

import { useDisplayData } from "../../hooks/useDisplayData";

export function Sidebar() {
  const {
    activeView,
    activePlaylistId,
    isScanning,
    sidebarCollapsed,
    setSidebarCollapsed,
    sharonMode,
    setActiveView,
    setActivePlaylist,
    setShowImportPlaylist,
    setShowCreatePlaylist,
    tracks,
  } = useStore(useShallow((s) => ({
    activeView: s.activeView,
    activePlaylistId: s.activePlaylistId,
    isScanning: s.isScanning,
    sidebarCollapsed: s.sidebarCollapsed,
    setSidebarCollapsed: s.setSidebarCollapsed,
    sharonMode: s.sharonMode,
    setActiveView: s.setActiveView,
    setActivePlaylist: s.setActivePlaylist,
    setShowImportPlaylist: s.setShowImportPlaylist,
    setShowCreatePlaylist: s.setShowCreatePlaylist,
    tracks: s.tracks,
  })));

  const { displayPlaylists } = useDisplayData();
  const { } = useLibrary();

  const [pluginSidebarItems, setPluginSidebarItems] = useState<any[]>([]);

  useEffect(() => {
    const updateItems = () => {
      if (window.Mewsic && window.Mewsic.ui && window.Mewsic.ui.registry) {
        setPluginSidebarItems(Array.from(window.Mewsic.ui.registry.sidebarComponents.values()));
      }
    };

    updateItems();
    window.addEventListener("plugin-ui-updated", updateItems);
    // Also poll so we catch registrations that happen after the event fires
    const poll = setInterval(updateItems, 500);
    return () => {
      window.removeEventListener("plugin-ui-updated", updateItems);
      clearInterval(poll);
    };
  }, []);

  const handleImportPlaylist = () => {
    setShowImportPlaylist(true);
  };

  const handleCreatePlaylist = () => {
    setShowCreatePlaylist(true);
  };

  return (
    <>
    <aside
      className={`flex flex-col h-full glass-heavy !border-y-0 !border-l-0 border-r border-border-glass z-50 !shadow-none w-[64px] min-w-[64px] flex-shrink-0 transition-[width] duration-300 ${!sidebarCollapsed ? "md:w-[224px] md:min-w-[224px]" : ""}`}
    >
      {
  // This is the logo
}
      <div className={`flex items-center justify-center gap-0 px-2 py-6 ${!sidebarCollapsed ? "md:justify-start md:gap-2.5 md:px-4" : ""}`}>
        <div
          className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-accent flex-shrink-0"
          style={{ boxShadow: "0 0 16px var(--accent-glow)" }}
          title="Mewsic"
        >
          <Music2 size={16} color="#000" strokeWidth={2.5} />
        </div>
        <span
          className={`font-display font-bold text-lg tracking-tight hidden ${!sidebarCollapsed ? "md:block" : ""}`}
          style={{ color: "var(--text-primary)" }}
        >
          Mewsic
        </span>
      </div>

      {
  // Just a divider here
}
      <div className="mx-4 h-px bg-border-subtle" />

      {
  // The main navigation menu is right here
}
      <nav className={`flex flex-col gap-0.5 px-2 pt-3 ${!sidebarCollapsed ? "md:px-3" : ""}`}>
        <div className={`flex flex-col items-center justify-between pb-1.5 gap-2 ${!sidebarCollapsed ? "md:flex-row md:px-2 md:gap-0" : ""}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest text-text-muted hidden ${!sidebarCollapsed ? "md:block" : ""}`}>
            Menu
          </p>
          <div className={`flex items-center gap-1.5 flex-col ${!sidebarCollapsed ? "md:flex-row" : ""}`}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="btn-icon w-6 h-6 p-0 hover:text-accent transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>
        </div>
        <NavItem
          icon={<Home size={15} />}
          label="Home"
          view="home"
          active={activeView === "home"}
          onClick={() => setActiveView("home")}
        />
        <NavItem
          icon={<Mic2 size={15} />}
          label="Lyrics"
          view="player"
          active={activeView === "player"}
          onClick={() => setActiveView("player")}
        />
        <NavItem
          icon={<Library size={15} />}
          label="Library"
          view="library"
          active={activeView === "library"}
          onClick={() => setActiveView("library")}
        />
        <NavItem
          icon={<Activity size={15} />}
          label="Audio"
          view="audio"
          active={activeView === "audio"}
          onClick={() => setActiveView("audio")}
        />
        <NavItem
          icon={<Globe size={15} />}
          label="Harbour"
          view="harbour"
          active={activeView === "harbour"}
          onClick={() => setActiveView("harbour")}
        />
        <NavItem
          icon={<Puzzle size={15} />}
          label="Plugins"
          view="plugins"
          active={activeView === "plugins"}
          onClick={() => setActiveView("plugins")}
        />
        <NavItem
          icon={<Settings size={15} />}
          label={sharonMode ? "Shittings" : "Settings"}
          view="settings"
          active={activeView === "settings"}
          onClick={() => setActiveView("settings")}
        />

        {
  // This is the plugin sidebar components part
}
        {pluginSidebarItems.map((item) => (
          <NavItem
            key={item.id || item.viewId}
            icon={
              item.icon ? (
                <div dangerouslySetInnerHTML={{ __html: item.icon }} className="w-[15px] h-[15px] flex items-center justify-center" />
              ) : (
                <Activity size={15} />
              )
            }
            label={item.name}
            view={item.viewId}
            active={activeView === item.viewId}
            onClick={() => setActiveView(item.viewId)}
          />
        ))}
      </nav>

      {
  // This is the playlists part
}
      <div className={`flex flex-col flex-1 min-h-0 px-2 pt-4 ${!sidebarCollapsed ? "md:px-3" : ""}`}>
        <div className={`flex flex-col items-center justify-between pb-1.5 gap-2 ${!sidebarCollapsed ? "md:flex-row md:px-2 md:gap-0" : ""}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest text-text-muted hidden ${!sidebarCollapsed ? "md:block" : ""}`}>
            Playlists
          </p>
          <div className={`flex items-center gap-1.5 flex-col ${!sidebarCollapsed ? "md:flex-row" : ""}`}>
            <button
              onClick={handleImportPlaylist}
              className="btn-icon w-6 h-6 p-0 hover:text-accent transition-colors"
              title="Import playlist (JSON)"
            >
              <Download size={13} />
            </button>
            <button
              onClick={handleCreatePlaylist}
              className="btn-icon w-6 h-6 p-0 hover:text-accent transition-colors"
              title="New playlist"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>


        {
  // This is the playlist list part
}
        <div className={`flex flex-col gap-0.5 overflow-y-auto flex-1 -mx-2 px-2 pb-2 ${!sidebarCollapsed ? "md:-mx-3 md:px-3" : ""}`}>
          {displayPlaylists.length === 0 ? (
            <p className={`text-xs text-text-muted px-2 py-2 italic hidden ${!sidebarCollapsed ? "md:block" : ""}`}>
              No playlists yet
            </p>
          ) : (
            displayPlaylists.map((pl) => {
              const firstTrackId = pl.trackIds[0];
              const firstTrack = firstTrackId ? tracks.find((t: Track) => t.id === firstTrackId) : null;
              const fallbackCover = firstTrack ? getCoverArtSync(firstTrack.filePath, 64) : null;
              const displayCover = pl.coverArt || fallbackCover;

              return (
                <button
                  key={pl.id}
                  onClick={() => setActivePlaylist(pl.id)}
                  className={`nav-item w-full justify-center group ${!sidebarCollapsed ? "md:justify-start" : ""} ${
                    activePlaylistId === pl.id ? "active" : ""
                  }`}
                  title={pl.name}
                  data-playlist-id={pl.id}
                  data-context="playlist-item"
                >
                  <div className="w-5 h-5 rounded-md bg-accent-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {displayCover ? (
                      <img src={displayCover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ListMusic size={12} className="text-accent" />
                    )}
                  </div>
                  <span className={`flex-1 text-left truncate text-sm hidden ${!sidebarCollapsed ? "md:block" : ""}`}>{pl.name}</span>
                  <ChevronRight
                    size={12}
                    className={`opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 hidden ${!sidebarCollapsed ? "md:block" : ""}`}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>

      {
  // This is the scan indicator part
}
      {isScanning && (
        <div className={`px-2 py-3 border-t border-border-subtle flex items-center justify-center gap-2 ${!sidebarCollapsed ? "md:px-4 md:justify-start" : ""}`}>
          <div title="Scanning library…" className="flex items-center justify-center flex-shrink-0">
            <Loader2 size={13} className="animate-spin text-accent" />
          </div>
          <span className={`text-xs text-text-muted hidden truncate ${!sidebarCollapsed ? "md:block" : ""}`}>Scanning library…</span>
        </div>
      )}



      </aside>
    </>
  );
}
