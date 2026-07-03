import React, { useState, useEffect } from "react";
import { X, Puzzle, Box, Info, RefreshCw, FolderOpen, Power, Trash2, Sliders, Terminal, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { useStore } from "../../store";
import { usePlugins, type PluginData } from "../../hooks/usePlugins";


const DiscordIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" className="text-white">
    <path fill="currentColor" d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.1.1 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02 0.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06 0.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02M8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12m6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12" />
  </svg>
);

const MinecraftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" className="text-white">
    <path fill="currentColor" d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m2 4v4h4v2H8v6h2v-2h4v2h2v-6h-2v-2h4V6h-4v4h-4V6z" />
  </svg>
);

const MewsifyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white">
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5s.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/>
  </svg>
);

const BUILT_IN_PLUGINS = [
  {
    id: "discord-rpc",
    name: "Discord Rich Presence",
    version: "1.0.0",
    author: "Mewsic Team",
    description:
      "Updates your Discord status in real time with the currently playing track, artist name, album art, and a live progress bar. Other users can see what you're listening to and click a button to download Mewsic.",
    icon: <DiscordIcon />,
    accentColor: "#5865F2",
    tags: ["Social", "Presence", "Core"],
    features: [
      "Real-time status updates on your Discord profile",
      "Embedded artwork cache and album art mapping",
      "Dynamic play state and track progress timelines",
      "Zero-config setup with automatic presence discovery"
    ]
  },
  {
    id: "minecraft-bridge",
    name: "Minecraft Bridge",
    version: "1.0.0",
    author: "Mewsic Team",
    description: "Bridges the Mewsic desktop music player with Minecraft via a local WebSocket server. Displays the currently playing track on the Game Menu Screen. This plugin works alongside the Mewsic-Bridge Minecraft mod to connect and control the Mewsic app within Minecraft itself. This can be useful if you're just chilling and don't want to switch apps to change music or if you're recording and don't want to reveal your desktop to viewers. Download the companion mod on Modrinth.",
    icon: <MinecraftIcon />,
    accentColor: "#2b714b",
    tags: ["Integration", "Gaming", "Local Link"],
    features: [
      "Local WebSocket server host on port 3012",
      "Clean title normalization (spaces replaced with underscores)",
      "Syncs full track library and playlist structures to Minecraft on connect",
      "Receives control instructions (play, next, previous, specific track) from game"
    ]
  },
  {
    id: "mewsify",
    name: "Mewsify",
    version: "1.0.0",
    author: "Mewsic Team",
    description: "Import any public Spotify playlist, album, or track directly into your Mewsic library for offline listening.",
    icon: <MewsifyIcon />,
    accentColor: "#1DB954",
    tags: ["Integration", "Importer", "Experimental"],
    features: [
      "No Spotify account required",
      "One-click full album/playlist importing",
      "Automatic high-quality metadata & lyrics tagging",
      "Listen instantly with Virtual Playlists",
    ]
  },
];

export function PluginsView() {
  const [activeTab, setActiveTab] = useState<"builtin" | "external">("builtin");
  const [selectedPluginId, setSelectedPluginId] = useState<string>("discord-rpc");
  const [selectedDetailTab, setSelectedDetailTab] = useState<"about" | "details" | "features">("about");
  const [searchQuery, setSearchQuery] = useState("");
  const [disabledExternalPlugins, setDisabledExternalPlugins] = useState<string[]>([]);

  useEffect(() => {
    setDisabledExternalPlugins(JSON.parse(localStorage.getItem('mewsic_disabled_plugins') || '[]'));
  }, []);

  const {
    minecraftIntegrationEnabled,
    setMinecraftIntegrationEnabled,
    discordEnabled,
    setDiscordEnabled,
    mewsifyIntegrationEnabled,
    setMewsifyIntegrationEnabled,
    addNotification
  } = useStore((s) => ({
    minecraftIntegrationEnabled: s.minecraftIntegrationEnabled,
    setMinecraftIntegrationEnabled: s.setMinecraftIntegrationEnabled,
    discordEnabled: s.discordEnabled,
    setDiscordEnabled: s.setDiscordEnabled,
    mewsifyIntegrationEnabled: s.mewsifyIntegrationEnabled,
    setMewsifyIntegrationEnabled: s.setMewsifyIntegrationEnabled,
    addNotification: s.addNotification,
  }));

  const [minecraftConnected, setMinecraftConnected] = useState(
    typeof window !== "undefined" && window.Mewsic ? !!window.Mewsic.minecraftConnected : false
  );
  const [discordConnected, setDiscordConnected] = useState(false);

  useEffect(() => {
    const handleMcChange = (e: any) => {
      setMinecraftConnected(e.detail);
    };
    window.addEventListener("minecraft-connection-changed" as any, handleMcChange);
    return () => {
      window.removeEventListener("minecraft-connection-changed" as any, handleMcChange);
    };
  }, []);

  useEffect(() => {
    if (!discordEnabled) {
      setDiscordConnected(false);
      return;
    }
    const checkDiscord = async () => {
      try {
        const connected = await invoke<boolean>("is_discord_connected");
        setDiscordConnected(connected);
      } catch (err) {
        setDiscordConnected(false);
      }
    };
    checkDiscord();
    const interval = setInterval(checkDiscord, 2000);
    return () => clearInterval(interval);
  }, [discordEnabled]);

  const { plugins: externalPlugins } = usePlugins();

  const builtinStates: Record<string, boolean> = {
    "discord-rpc": discordEnabled,
    "minecraft-bridge": minecraftIntegrationEnabled,
    "mewsify": mewsifyIntegrationEnabled,
  };

  const builtinSetters: Record<string, (v: boolean) => void> = {
    "discord-rpc": setDiscordEnabled,
    "minecraft-bridge": setMinecraftIntegrationEnabled,
    "mewsify": setMewsifyIntegrationEnabled,
  };

  const handleOpenPluginsFolder = async () => {
    try {
      const result = await invoke<string>("get_plugins_dir");
      await invoke("show_in_folder", { path: result });
    } catch (e) {
      console.error("Failed to open plugins folder:", e);
    }
  };

  // Compile all plugins
  const allPlugins = [
    ...BUILT_IN_PLUGINS.map(p => ({
      ...p,
      type: "builtin" as const,
      isEnabled: builtinStates[p.id] ?? false,
      isDisabled: false
    })),
    ...externalPlugins.map(p => ({
      id: p.id,
      name: p.manifest?.name ?? p.id,
      version: p.manifest?.version ?? "1.0.0",
      author: p.manifest?.author ?? "Unknown",
      description: p.manifest?.description ?? "No description provided.",
      icon: <Puzzle />,
      accentColor: "#6366f1",
      tags: p.manifest?.tags ?? ["External", "User Plugin"],
      features: p.manifest?.features ?? ["Custom JavaScript execution", "Custom UI Styles (CSS)"],
      type: "external" as const,
      isEnabled: !disabledExternalPlugins.includes(p.id),
      isDisabled: false
    }))
  ];

  // Filter plugins
  const filteredPlugins = allPlugins.filter(p => {
    if (activeTab === "builtin" && p.type !== "builtin") return false;
    if (activeTab === "external" && p.type !== "external") return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  // Keep selection valid
  const selectedPlugin = allPlugins.find(p => p.id === selectedPluginId) || filteredPlugins[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col h-full bg-surface-base">

        <div className="px-8 py-6 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center shadow-accent">
              <Puzzle size={20} color="#000" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-text-primary">Plugins</h1>
              <p className="text-text-muted text-sm mt-1">
                Extend Mewsic's functionality with built-in and external plugins
              </p>
            </div>
          </div>
        </div>

        {
  // This is the content body: split layout part
}
        <div className="flex flex-1 overflow-hidden min-h-0">
          
          {
  // This is the left column: sidebar list part
}
          <div className="w-[320px] border-r border-border-subtle flex flex-col h-full bg-surface-base/10 flex-shrink-0">
            {
  // This is the search and tabs part
}
            <div className="p-4 border-b border-border-subtle space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-raised border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-all"
                />
                <X
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted cursor-pointer"
                  onClick={() => setSearchQuery("")}
                />
              </div>

              {
  // This is the tabs part
}
              <div className="flex bg-surface-raised/50 border border-white/5 p-0.5 rounded-xl">
                <button
                  onClick={() => {
                    setActiveTab("builtin");
                    setSelectedPluginId("discord-rpc");
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                    activeTab === "builtin"
                      ? "bg-accent text-black font-black"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Built-in
                </button>
                <button
                  onClick={() => {
                    setActiveTab("external");
                    if (externalPlugins.length > 0) {
                      setSelectedPluginId(externalPlugins[0].id);
                    } else {
                      setSelectedPluginId("");
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                    activeTab === "external"
                      ? "bg-accent text-black font-black"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  External
                </button>
              </div>
            </div>

            {
  // This is the list area part
}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredPlugins.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-xs">No plugins found</div>
              ) : (
                filteredPlugins.map((p) => {
                  const isSelected = selectedPlugin && p.id === selectedPlugin.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPluginId(p.id)}
                      className={`w-full p-3 rounded-xl flex gap-3 text-left transition-all ${
                        isSelected
                          ? "bg-accent/10 border border-white/10"
                          : "border border-transparent hover:bg-surface-raised/40"
                      }`}
                    >
                      {
  // This is the icon part
}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 shadow-sm"
                        style={{ backgroundColor: `${p.accentColor}15` }}
                      >
                        {React.cloneElement(p.icon as React.ReactElement, {
                          size: 18,
                          className: isSelected ? "text-accent" : "text-text-secondary",
                        })}
                      </div>
                      {
  // This is the meta part
}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-accent" : "text-text-primary"}`}>
                            {p.name}
                          </p>
                          {p.isEnabled && !p.isDisabled && (
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              p.id === "discord-rpc"
                                ? (discordConnected ? "bg-green-400" : "bg-amber-500")
                                : p.id === "minecraft-bridge"
                                ? (minecraftConnected ? "bg-green-400" : "bg-amber-500")
                                : "bg-green-400"
                            }`} />
                          )}
                        </div>
                        <p className="text-[9px] text-text-muted mt-0.5 truncate">by {p.author}</p>
                        <div className="flex gap-1 mt-1.5">
                          {p.tags.slice(0, 2).map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-surface-overlay/80 text-text-secondary"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {
  // This is the right column: detailed pane part
}
          <div className="flex-1 flex flex-col h-full bg-surface-overlay/10">
            {selectedPlugin ? (
              <>
                {
  // This is the plugin detail header part
}
                <div className="p-6 border-b border-border-subtle flex items-start justify-between gap-4 flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10 shadow-sm"
                      style={{
                        backgroundColor: `${selectedPlugin.accentColor}15`,
                      }}
                    >
                      {React.cloneElement(selectedPlugin.icon as React.ReactElement, {
                        size: 28,
                        className: "text-text-primary",
                      })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-display font-black text-text-primary">{selectedPlugin.name}</h3>
                        <span className="text-[10px] font-mono text-text-muted bg-surface-raised border border-border-subtle/40 px-1.5 py-0.5 rounded">
                          v{selectedPlugin.version}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        by <span className="text-text-primary font-medium">{selectedPlugin.author}</span>
                        {selectedPlugin.id === "mewsify" && (
                          <span className="ml-2.5 text-[10px] text-purple-400 font-bold bg-purple-400/15 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            Experimental
                          </span>
                        )}
                        {selectedPlugin.isEnabled && !selectedPlugin.isDisabled && (
                          <>
                            <span className={`${selectedPlugin.id === "mewsify" ? "ml-1.5" : "ml-2.5"} text-[10px] text-green-400 font-bold bg-green-400/15 px-2 py-0.5 rounded-full inline-flex items-center gap-1`}>
                              Active
                            </span>
                            {selectedPlugin.id === "discord-rpc" && (
                              <span className={`ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                discordConnected ? "text-green-400 bg-green-400/15" : "text-amber-400 bg-amber-400/15"
                              }`}>
                                {discordConnected ? "Connected" : "Disconnected"}
                              </span>
                            )}
                            {selectedPlugin.id === "minecraft-bridge" && (
                              <span className={`ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                minecraftConnected ? "text-green-400 bg-green-400/15" : "text-amber-400 bg-amber-400/15"
                              }`}>
                                {minecraftConnected ? "Connected" : "Disconnected"}
                              </span>
                            )}
                          </>
                        )}
                        {selectedPlugin.isDisabled && (
                          <span className="ml-2.5 text-[10px] text-amber-500 font-bold bg-amber-500/15 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            In Development
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {
  // This is the actions (blockbench style buttons) part
}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <button
                      disabled={selectedPlugin.isDisabled}
                      onClick={() => {
                        if (selectedPlugin.type === "builtin") {
                          const setter = builtinSetters[selectedPlugin.id];
                          setter(!selectedPlugin.isEnabled);
                        } else {
                          const newDisabled = selectedPlugin.isEnabled
                            ? [...disabledExternalPlugins, selectedPlugin.id]
                            : disabledExternalPlugins.filter(id => id !== selectedPlugin.id);
                          setDisabledExternalPlugins(newDisabled);
                          localStorage.setItem('mewsic_disabled_plugins', JSON.stringify(newDisabled));
                          addNotification?.(`Plugin ${selectedPlugin.name} ${selectedPlugin.isEnabled ? 'disabled' : 'enabled'}. Reload to apply.`, "info");
                        }
                      }}
                      className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all border ${
                        selectedPlugin.isDisabled
                          ? "border-border-subtle bg-surface-overlay/20 text-text-muted/40 cursor-not-allowed"
                          : selectedPlugin.isEnabled
                          ? "border-red-500/20 hover:border-red-500/40 bg-red-500/5 text-red-400 hover:bg-red-500/10 cursor-pointer"
                          : "border-green-500/20 hover:border-green-500/40 bg-green-500/5 text-green-400 hover:bg-green-500/10 cursor-pointer"
                      }`}
                    >
                      <Power size={18} />
                      <span className="text-[9px] font-black uppercase tracking-wider mt-1.5">
                        {selectedPlugin.isEnabled && !selectedPlugin.isDisabled ? "Disable" : "Enable"}
                      </span>
                    </button>

                    {selectedPlugin.id === "minecraft-bridge" && selectedPlugin.isEnabled && (
                      <button
                        onClick={() => {
                          if (window.Mewsic && typeof window.Mewsic.reconnectMinecraft === "function") {
                            window.Mewsic.reconnectMinecraft();
                            addNotification?.("Minecraft connection request sent", "success");
                          } else {
                            addNotification?.("Minecraft plugin is not running", "error");
                          }
                        }}
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl border border-accent/20 hover:border-accent/40 bg-accent/5 text-accent hover:bg-accent/10 transition-all cursor-pointer"
                        title="Reconnect to Minecraft"
                      >
                        <RefreshCw size={18} />
                        <span className="text-[9px] font-black uppercase tracking-wider mt-1.5">Reconnect</span>
                      </button>
                    )}

                    {selectedPlugin.id === "minecraft-bridge" && (
                      <button
                        onClick={() => open("https://modrinth.com/mod/mewsic-bridge")}
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl border border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer"
                        title="Download Mewsic-Bridge mod"
                      >
                        <ExternalLink size={18} />
                        <span className="text-[9px] font-black uppercase tracking-wider mt-1.5">Get Mod</span>
                      </button>
                    )}

                    {selectedPlugin.type === "external" && (
                      <button
                        onClick={async () => {
                          try {
                            await invoke("delete_plugin", { pluginId: selectedPlugin.id });
                            addNotification?.(`Plugin ${selectedPlugin.name} deleted`, "success");
                            setTimeout(() => {
                              localStorage.setItem("returnToPlugins", "true");
                              window.location.reload();
                            }, 1000);
                          } catch (e: any) {
                            addNotification?.(`Failed to delete plugin: ${e}`, "error");
                          }
                        }}
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl border border-red-500/20 hover:border-red-500/40 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                        title="Uninstall plugin"
                      >
                        <Trash2 size={18} />
                        <span className="text-[9px] font-black uppercase tracking-wider mt-1.5">Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {
  // This is the sub tab selectors part
}
                <div className="flex gap-4 px-6 pt-3 border-b border-border-subtle flex-shrink-0">
                  {([
                    { id: "about", label: "About", icon: <Info size={11} /> },
                    { id: "details", label: "Details", icon: <Sliders size={11} /> },
                    { id: "features", label: "Features", icon: <Terminal size={11} /> },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedDetailTab(t.id)}
                      className={`pb-2 text-[10px] font-black uppercase tracking-widest relative flex items-center gap-1.5 transition-all ${
                        selectedDetailTab === t.id ? "text-accent" : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {t.icon}
                      {t.label}
                      {selectedDetailTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
                    </button>
                  ))}
                </div>

                {
  // This is the inner tab panels part
}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selectedDetailTab === "about" && (
                    <div className="space-y-4 text-xs">
                      {selectedPlugin.description && (
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Description</h4>
                          <p className="text-text-secondary leading-relaxed">{selectedPlugin.description}</p>
                        </div>
                      )}
                      
                      {selectedPlugin.isDisabled && (
                        <p className="text-[11px] text-amber-500/95 italic bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl">
                          This plugin is currently in development and is not ready for general use.
                        </p>
                      )}

                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Tags</h4>
                        <div className="flex gap-1.5 flex-wrap">
                          {selectedPlugin.tags.map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-surface-raised text-text-secondary border border-white/5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDetailTab === "details" && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Technical Details</h4>
                      <div className="rounded-xl border border-border-subtle bg-surface-base/30 overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <tbody>
                            <tr className="border-b border-border-subtle">
                              <td className="px-4 py-2.5 font-medium text-text-muted w-1/3">Plugin ID</td>
                              <td className="px-4 py-2.5 font-mono text-text-secondary">{selectedPlugin.id}</td>
                            </tr>
                            <tr className="border-b border-border-subtle">
                              <td className="px-4 py-2.5 font-medium text-text-muted">Author</td>
                              <td className="px-4 py-2.5 text-text-secondary">{selectedPlugin.author}</td>
                            </tr>
                            <tr className="border-b border-border-subtle">
                              <td className="px-4 py-2.5 font-medium text-text-muted">Version</td>
                              <td className="px-4 py-2.5 text-text-secondary">{selectedPlugin.version}</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2.5 font-medium text-text-muted">Source Type</td>
                              <td className="px-4 py-2.5 text-text-secondary font-semibold uppercase text-[10px]">
                                {selectedPlugin.type === "builtin" ? "Core Built-in" : "External Plugin"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedDetailTab === "features" && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-text-muted">Features & Capabilities</h4>
                      <ul className="space-y-2">
                        {selectedPlugin.features.map((feat: string, idx: number) => (
                          <li key={idx} className="flex gap-2.5 items-start text-xs text-text-secondary leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-6">
                <Puzzle size={32} className="text-text-muted opacity-40" />
                <p className="text-xs text-text-muted font-bold">Select a plugin to view its details</p>
              </div>
            )}
          </div>
        </div>

        {
  // This is the footer section
}
        <div className="px-7 py-4 border-t border-border-subtle flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] text-text-muted italic">
            Built-in plugin changes require a reload to take effect.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPluginsFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-border-subtle text-[10px] font-black text-text-muted hover:text-accent hover:border-accent transition-all uppercase tracking-widest cursor-pointer"
            >
              <FolderOpen size={11} />
              Plugins Directory
            </button>
            <button
              onClick={() => {
                localStorage.setItem("returnToPlugins", "true");
                window.location.reload();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-border-subtle text-[10px] font-black text-text-muted hover:text-accent hover:border-accent transition-all uppercase tracking-widest cursor-pointer"
            >
              <RefreshCw size={11} />
              Reload App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
