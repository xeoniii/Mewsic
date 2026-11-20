import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Puzzle,
  Info,
  RefreshCw,
  FolderOpen,
  FolderDown,
  Store,
  Power,
  Trash2,
  Sliders,
  ExternalLink,
  FileText,
  Zap,
  Radio,
  Copy,
  Check,
  Terminal,
  Sparkles,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useStore } from "../../store";
import { usePlugins, invalidatePluginCache } from "../../hooks/usePlugins";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { ConfirmationModal } from "../UI/ConfirmationModal";
import { PluginConfigForm } from "./PluginConfigForm";
import { PluginMarketplace } from "./PluginMarketplace";

// ── SVG Brand Icons ──
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
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5s.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2" />
  </svg>
);

const BUILT_IN_PLUGINS = [
  {
    id: "discord-rpc",
    name: "Discord Rich Presence",
    version: "1.2.7",
    author: "xeoniii.dev",
    description:
      "Broadcasts your currently playing track in real time to your Discord profile with song name, artist, album artwork, and time duration.",
    icon: <DiscordIcon />,
    accentColor: "#5865F2",
    ambientColor: "#5865F2",
    tags: ["Social", "Presence", "Tracking"],
    features: [
      "Real-time status updates on your Discord profile",
      "Smart cover art discovery and caching",
      "Multiple dynamic RPC states",
      "Playlist visiblity support",
    ],
  },
  {
    id: "minecraft-bridge",
    name: "Minecraft Bridge",
    version: "1.2.0",
    author: "xeoniii.dev",
    description:
      "Bridges Mewsic with Minecraft via a local WebSocket server on port 3012. Displays the currently playing track on the Game Menu Screen and allows in-game music controls using the companion mod on Modrinth.",
    icon: <MinecraftIcon />,
    accentColor: "#2b714b",
    ambientColor: "#2b714b",
    tags: ["Integration", "Gaming", "Local Link"],
    features: [
      "Local WebSocket server host on port 3012",
      "Advanced connectivity system to ensure seamless bridging",
      "Syncs full track library and playlist structures to Minecraft on connect",
      "Instant in-game control command execution (play, pause, next, previous)",
    ],
  },
  {
    id: "mewsify",
    name: "Mewsify",
    version: "1.1.0",
    author: "xeoniii.dev",
    description:
      "Import any public Spotify playlist, album, or track directly into your Mewsic library. Also load songs and playlists virtual to listen without downloading.",
    icon: <MewsifyIcon />,
    accentColor: "#1DB954",
    ambientColor: "#1DB954",
    tags: ["Integration", "Importer", "Spotify"],
    features: [
      "No Spotify account or API credentials required",
      "Easy album and playlist importing",
      "Load songs and playlists virtual to listen without downloading",
      "Integrated extractor for high quality metadata",
    ],
  },
];

type DetailTab = "overview" | "config" | "features" | "specs";
type FilterCategory = "all" | "builtin" | "external" | "active";

interface PluginsViewProps {
  initialView?: "installed" | "marketplace";
}

export function PluginsView({ initialView = "installed" }: PluginsViewProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const [viewMode, setViewMode] = useState<"installed" | "marketplace">(initialView);
  const [filterTab, setFilterTab] = useState<FilterCategory>("all");
  const [selectedPluginId, setSelectedPluginId] = useState<string>("discord-rpc");
  const [selectedDetailTab, setSelectedDetailTab] = useState<DetailTab>("overview");
  const [disabledExternalPlugins, setDisabledExternalPlugins] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [reconnectingMc, setReconnectingMc] = useState(false);
  const [reloading, setReloading] = useState(false);

  const {
    minecraftIntegrationEnabled,
    setMinecraftIntegrationEnabled,
    discordEnabled,
    setDiscordEnabled,
    mewsifyIntegrationEnabled,
    setMewsifyIntegrationEnabled,
    addNotification,
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
    setDisabledExternalPlugins(
      JSON.parse(localStorage.getItem("mewsic_disabled_plugins") || "[]")
    );

    const handleOpenDetails = (e: any) => {
      if (e.detail?.pluginId) {
        setSelectedPluginId(e.detail.pluginId);
      }
      if (e.detail?.tab) {
        const tab = e.detail.tab;
        if (tab === "about") setSelectedDetailTab("overview");
        else if (tab === "details") setSelectedDetailTab("specs");
        else if (
          tab === "overview" ||
          tab === "config" ||
          tab === "features" ||
          tab === "specs"
        ) {
          setSelectedDetailTab(tab);
        }
      }
    };
    window.addEventListener("open-plugin-details" as any, handleOpenDetails);
    return () => {
      window.removeEventListener("open-plugin-details" as any, handleOpenDetails);
    };
  }, []);

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  const [customAmbientColors, setCustomAmbientColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleAmbientChange = (e: any) => {
      if (e.detail?.pluginId) {
        if (e.detail.color) {
          setCustomAmbientColors((prev) => ({ ...prev, [e.detail.pluginId]: e.detail.color }));
        } else {
          setCustomAmbientColors((prev) => {
            const next = { ...prev };
            delete next[e.detail.pluginId];
            return next;
          });
        }
      }
    };
    window.addEventListener("plugin-ambient-color-changed" as any, handleAmbientChange);
    return () =>
      window.removeEventListener("plugin-ambient-color-changed" as any, handleAmbientChange);
  }, []);

  const getAmbientColor = useCallback(
    (plugin: { id: string; ambientColor?: string; accentColor?: string }) => {
      return (
        customAmbientColors[plugin.id] ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`mewsic_plugin_ambient_${plugin.id}`)
          : null) ||
        plugin.ambientColor ||
        plugin.accentColor ||
        "#6366f1"
      );
    },
    [customAmbientColors]
  );

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
      } catch {
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
    mewsify: mewsifyIntegrationEnabled,
  };

  const builtinSetters: Record<string, (v: boolean) => void> = {
    "discord-rpc": setDiscordEnabled,
    "minecraft-bridge": setMinecraftIntegrationEnabled,
    mewsify: setMewsifyIntegrationEnabled,
  };

  const handleOpenPluginsFolder = async () => {
    try {
      const result = await invoke<string>("get_plugins_dir");
      await invoke("show_in_folder", { path: result });
    } catch (e) {
      console.error("Failed to open plugins folder:", e);
      addNotification?.("Failed to open plugins directory", "error", 3500);
    }
  };

  const handleImportPlugin = async () => {
    try {
      const selected = await openDialog({
        title: "Import Plugin",
        multiple: false,
        filters: [
          {
            name: "Plugin Archive (*.zip)",
            extensions: ["zip", "mewsic"],
          },
        ],
      });

      if (!selected) return;
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) return;

      await invoke("install_plugin_from_path", { path: filePath });
      await invalidatePluginCache();
      addNotification?.(
        "Plugin imported successfully! Reload Mewsic to activate.",
        "success",
        4000,
        false,
        "Plugin Installed"
      );
    } catch (e: any) {
      console.error("Failed to import plugin:", e);
      addNotification?.(`Failed to import plugin: ${e?.message || e}`, "error", 4000);
    }
  };

  const handleOpenMarketplace = () => {
    setViewMode("marketplace");
  };

  const handleReloadApp = () => {
    setReloading(true);
    localStorage.setItem("returnToPlugins", "true");
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleReconnectMinecraft = () => {
    setReconnectingMc(true);
    if (window.Mewsic && typeof window.Mewsic.reconnectMinecraft === "function") {
      window.Mewsic.reconnectMinecraft();
      addNotification?.("Minecraft connection request sent", "success", 3000);
    } else {
      addNotification?.("Minecraft bridge plugin is not active", "error", 3500);
    }
    setTimeout(() => setReconnectingMc(false), 1200);
  };

  // Compile all plugins with metadata
  const allPlugins = useMemo(() => {
    return [
      ...BUILT_IN_PLUGINS.map((p) => ({
        ...p,
        type: "builtin" as const,
        isEnabled: builtinStates[p.id] ?? false,
        isDisabled: false,
      })),
      ...externalPlugins.map((p: any) => {
        if (typeof window !== "undefined" && window.Mewsic?.config) {
          const cfg = p.manifest?.config || p.manifest?.settings;
          if (
            cfg &&
            Array.isArray(cfg) &&
            window.Mewsic.config.getSchema(p.id).length === 0
          ) {
            window.Mewsic.config.register(p.id, cfg);
          }
        }
        const rawColor = p.manifest?.ambientColor || p.manifest?.accentColor || "#6366f1";
        return {
          id: p.id,
          name: p.manifest?.name ?? p.id,
          version: p.manifest?.version ?? "1.0.0",
          author: p.manifest?.author ?? "Unknown",
          description: p.manifest?.description ?? "No description provided.",
          icon: <Puzzle />,
          accentColor: rawColor,
          ambientColor: rawColor,
          tags: p.manifest?.tags ?? ["External", "User Plugin"],
          features: p.manifest?.features ?? [
            "Custom JavaScript execution",
            "Custom UI Styles (CSS)",
          ],
          type: "external" as const,
          isEnabled: !disabledExternalPlugins.includes(p.id),
          isDisabled: false,
        };
      }),
    ];
  }, [
    builtinStates,
    externalPlugins,
    disabledExternalPlugins,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__mewsic_all_plugins = allPlugins;
    }
  }, [allPlugins]);

  // Filter plugins based on selected category
  const filteredPlugins = useMemo(() => {
    return allPlugins.filter((p) => {
      if (filterTab === "builtin" && p.type !== "builtin") return false;
      if (filterTab === "external" && p.type !== "external") return false;
      if (filterTab === "active" && !p.isEnabled) return false;
      return true;
    });
  }, [allPlugins, filterTab]);

  // Keep selection valid
  const selectedPlugin =
    allPlugins.find((p) => p.id === selectedPluginId) || filteredPlugins[0] || allPlugins[0];

  const activePluginsCount = useMemo(
    () => allPlugins.filter((p) => p.isEnabled).length,
    [allPlugins]
  );

  const togglePlugin = useCallback(
    (plugin: typeof allPlugins[0], enable: boolean) => {
      if (plugin.isDisabled) return;
      if (plugin.type === "builtin") {
        const setter = builtinSetters[plugin.id];
        if (setter) {
          setter(enable);
          addNotification?.(
            `${plugin.name} ${enable ? "enabled" : "disabled"}.`,
            "info",
            3000
          );
        }
      } else {
        const newDisabled = enable
          ? disabledExternalPlugins.filter((id) => id !== plugin.id)
          : [...disabledExternalPlugins, plugin.id];
        setDisabledExternalPlugins(newDisabled);
        localStorage.setItem(
          "mewsic_disabled_plugins",
          JSON.stringify(newDisabled)
        );
        addNotification?.(
          `Plugin "${plugin.name}" ${enable ? "enabled" : "disabled"}. Reload to apply changes.`,
          "info",
          3500
        );
      }
    },
    [builtinSetters, disabledExternalPlugins, addNotification]
  );

  const handleDeletePlugin = async () => {
    if (!selectedPlugin || selectedPlugin.type !== "external") return;
    try {
      await invoke("delete_plugin", { pluginId: selectedPlugin.id });
      addNotification?.(
        `Plugin "${selectedPlugin.name}" uninstalled successfully`,
        "success",
        3000
      );
      setShowDeleteModal(false);
      setTimeout(() => {
        localStorage.setItem("returnToPlugins", "true");
        window.location.reload();
      }, 600);
    } catch (e: any) {
      console.error("Delete plugin error:", e);
      addNotification?.(`Failed to delete plugin: ${e}`, "error", 4000);
    }
  };

  if (viewMode === "marketplace") {
    return (
      <PluginMarketplace
        onBack={() => setViewMode("installed")}
        onOpenPluginsFolder={handleOpenPluginsFolder}
        onReloadApp={handleReloadApp}
        reloading={reloading}
      />
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto page select-none">
      <div className="flex flex-col gap-6 md:gap-8 p-6 md:p-8 pb-16 w-full">
        {/* ── 1. HERO HEADER WITH QUICK ACTIONS ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-text-primary">
                Plugins & Extensions
              </h1>
            </div>
            <p className="text-sm text-text-muted mt-1.5 max-w-2xl">
              Mod mewsic to your likings.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleOpenMarketplace}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Explore community plugins & extensions"
            >
              <Store size={15} className="text-accent" />
              <span>Marketplace</span>
            </button>
            <button
              onClick={handleImportPlugin}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Import plugin from .zip file"
            >
              <FolderDown size={15} className="text-accent" />
              <span>Import Plugin</span>
            </button>
            <button
              onClick={handleOpenPluginsFolder}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Open plugins directory on disk"
            >
              <FolderOpen size={15} className="text-accent" />
              <span>Plugins Folder</span>
            </button>
            <button
              onClick={handleReloadApp}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Reload Mewsic interface and plugins"
            >
              <RefreshCw
                size={14}
                className={reloading ? "animate-spin text-accent" : "text-text-muted"}
              />
              <span>Reload App</span>
            </button>
          </div>
        </div>

        {/* ── 3. FILTER PILLS & UNIVERSAL SEARCH BAR ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-overlay border border-border-subtle overflow-x-auto">
            {([
              { id: "all", label: "All Plugins", count: allPlugins.length },
              { id: "builtin", label: "Built-in", count: BUILT_IN_PLUGINS.length },
              { id: "external", label: "Community", count: externalPlugins.length },
              { id: "active", label: "Active", count: activePluginsCount },
            ] as const).map((filter) => {
              const isActive = filterTab === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setFilterTab(filter.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${isActive
                    ? "bg-accent text-black shadow-sm font-extrabold"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-raised/60"
                    }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? "bg-black/20 text-black font-bold" : "bg-surface-raised text-text-muted"
                      }`}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 4. TWO-COLUMN WORKSPACE: EXPLORER & SHOWCASE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN: PLUGIN EXPLORER (col-span-5) ── */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                Plugins ({filteredPlugins.length})
              </span>
            </div>

            {filteredPlugins.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 border border-border-subtle">
                <div className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center text-text-muted">
                  <Puzzle size={20} className="opacity-50" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-primary">No plugins found</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Drop a .zip plugin into the plugins folder or click Import.
                  </p>
                </div>
                <button
                  onClick={handleImportPlugin}
                  className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-semibold transition-all cursor-pointer"
                >
                  <FolderDown size={13} className="text-accent" />
                  <span>Import Plugin</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredPlugins.map((plugin) => {
                  const isSelected = selectedPlugin && plugin.id === selectedPlugin.id;
                  const pluginAmbientColor = getAmbientColor(plugin);

                  return (
                    <div
                      key={plugin.id}
                      onClick={() => setSelectedPluginId(plugin.id)}
                      className={`p-4 sm:p-4.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-4 ${isSelected
                        ? "bg-surface-raised shadow-lg border-[var(--accent-glow)]"
                        : "bg-surface-overlay/30 hover:bg-surface-raised/50 border-border-subtle hover:border-border-glass"
                        }`}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10 shadow-sm"
                          style={{ backgroundColor: `${plugin.accentColor}25` }}
                        >
                          {React.cloneElement(plugin.icon as React.ReactElement, {
                            size: 22,
                          })}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`text-base font-bold truncate transition-colors ${isSelected ? "text-accent" : "text-text-primary"
                                }`}
                            >
                              {plugin.name}
                            </span>
                            <span className="text-[11px] font-mono text-text-muted shrink-0 font-medium">
                              v{plugin.version}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted truncate mt-1 font-medium">
                            by {plugin.author}
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 flex items-center pl-3"
                        title={plugin.isEnabled ? "Click to disable" : "Click to enable"}
                      >
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={plugin.isEnabled}
                            disabled={plugin.isDisabled}
                            onChange={(e) => togglePlugin(plugin, e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-surface-base rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-border-subtle peer-disabled:opacity-40" />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ── RIGHT COLUMN: PLUGIN SHOWCASE & CONTROLS (col-span-7) ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {selectedPlugin ? (
              (() => {
                const selectedAmbientColor = getAmbientColor(selectedPlugin);
                return (
                  <div className="glass rounded-3xl border border-white/5 overflow-hidden shadow-2xl flex flex-col">
                    {/* ── SHOWCASE HERO BANNER ── */}
                    <div
                      className="relative p-6 md:p-7 border-b border-border-subtle flex flex-col gap-5"
                      style={{
                        background: `radial-gradient(ellipse at 15% 0%, ${selectedPlugin.accentColor}24 0%, transparent 70%)`,
                      }}
                    >
                      {/* Top Details & Controls Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {/* Big Icon */}
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative text-accent"
                            style={{
                              backgroundColor: `${selectedPlugin.accentColor}25`,
                              boxShadow: `0 0 24px ${selectedPlugin.accentColor}30`,
                            }}
                          >
                            {React.cloneElement(selectedPlugin.icon as React.ReactElement, {
                              size: 32,
                            })}
                          </div>

                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-xl md:text-2xl font-display font-black text-text-primary tracking-tight">
                                  {selectedPlugin.name}
                                </h2>
                                <span className="text-[10px] font-mono text-text-muted bg-surface-raised px-2 py-0.5 rounded-lg">
                                  v{selectedPlugin.version}
                                </span>
                              </div>

                              <p className="text-xs text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
                                <span>
                                  Created by <strong className="text-text-primary">{selectedPlugin.author}</strong>
                                </span>
                                <span className="text-text-muted">•</span>
                                {selectedPlugin.type === "builtin" ? (
                                  <span className="text-[10px] font-bold text-accent">Built-in plugin</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-indigo-400">External plugin</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Primary Power Action Button */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                              onClick={() => togglePlugin(selectedPlugin, !selectedPlugin.isEnabled)}
                              disabled={selectedPlugin.isDisabled}
                              className={`flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm ${selectedPlugin.isDisabled
                                ? "opacity-50 cursor-not-allowed bg-surface-raised border border-border-subtle text-text-muted"
                                : selectedPlugin.isEnabled
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25"
                                  : "btn-accent"
                                }`}
                            >
                              <Power size={15} />
                              <span>{selectedPlugin.isEnabled ? "Disable Plugin" : "Enable Plugin"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Secondary Action Toolbar & Status Bar */}
                        <div className="flex items-center justify-between gap-3 pt-3 flex-wrap">
                          {/* Live Status Pill */}
                          <div className="flex items-center gap-2">
                            {selectedPlugin.isEnabled ? (
                              <>
                                {selectedPlugin.id === "discord-rpc" && (
                                  <div
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${discordConnected
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                      }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${discordConnected
                                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                                        : "bg-amber-400"
                                        }`}
                                    />
                                    <span>
                                      {discordConnected
                                        ? "Connected to Discord Client"
                                        : "Waiting for Discord App..."}
                                    </span>
                                  </div>
                                )}

                                {selectedPlugin.id === "minecraft-bridge" && (
                                  <div
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${minecraftConnected
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                      }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${minecraftConnected
                                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                                        : "bg-amber-400"
                                        }`}
                                    />
                                    <span>
                                      {minecraftConnected
                                        ? "Minecraft Connected (Port 3012)"
                                        : "WebSocket Host Ready (Port 3012)"}
                                    </span>
                                  </div>
                                )}

                                {selectedPlugin.id === "mewsify" && (
                                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    <span>Active</span>
                                  </div>
                                )}

                                {selectedPlugin.type === "external" && (
                                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>Active</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-surface-raised text-text-muted border border-border-subtle">
                                <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
                                <span>Disabled</span>
                              </div>
                            )}

                          </div>

                          {/* Secondary Action Buttons */}
                          <div className="flex items-center gap-2">

                            {selectedPlugin.id === "minecraft-bridge" && (
                              <>
                                {selectedPlugin.isEnabled && (
                                  <button
                                    onClick={handleReconnectMinecraft}
                                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg font-bold text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                                    title="Send WebSocket ping to Minecraft"
                                  >
                                    <RefreshCw
                                      size={13}
                                      className={reconnectingMc ? "animate-spin" : ""}
                                    />
                                    <span>Reconnect</span>
                                  </button>
                                )}
                              </>
                            )}

                            <button
                              onClick={() => setSelectedDetailTab("config")}
                              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg font-bold text-xs border transition-all cursor-pointer ${selectedDetailTab === "config"
                                ? "bg-accent/15 border-accent text-accent shadow-sm"
                                : "bg-surface-raised border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary"
                                }`}
                              title="Configure plugin settings"
                            >
                              <Sliders size={13} />
                              <span>Settings</span>
                            </button>

                            {selectedPlugin.id === "minecraft-bridge" && (
                              <>
                                <button
                                  onClick={() => open("https://modrinth.com/mod/mewsic-bridge")}
                                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg font-bold text-xs bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-glass transition-all cursor-pointer"
                                  title="Download the companion mod on Modrinth"
                                >
                                  <ExternalLink size={13} />
                                  <span>Companion Mod</span>
                                </button>
                              </>
                            )}

                            {selectedPlugin.type === "external" && (
                              <button
                                onClick={() => setShowDeleteModal(true)}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-lg font-bold text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                                title="Uninstall this plugin"
                              >
                                <Trash2 size={13} />
                                <span>Uninstall</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── MODERN SEGMENTED DETAIL TAB BAR ── */}
                      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border-subtle bg-surface-base/40 overflow-x-auto">
                        {([
                          { id: "overview", label: "Description", icon: <Info size={14} /> },
                          { id: "config", label: "Config", icon: <Sliders size={14} /> },
                          { id: "specs", label: "Details", icon: <FileText size={14} /> },
                        ] as const).map((tab) => {
                          const isTabActive = selectedDetailTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setSelectedDetailTab(tab.id)}
                              className={`relative pb-3 px-3.5 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${isTabActive
                                ? "text-accent"
                                : "text-text-muted hover:text-text-primary"
                                }`}
                            >
                              {tab.icon}
                              <span>{tab.label}</span>
                              {isTabActive && (
                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* ── TAB CONTENT PANES ── */}
                      <div className="p-6 md:p-8 flex flex-col gap-6">
                        {/* TAB 1: OVERVIEW */}
                        {selectedDetailTab === "overview" && (
                          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                            {/* Description Box */}
                            <div className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                About this Integration
                              </span>
                              <div className="p-4 rounded-2xl bg-surface-overlay border border-border-subtle leading-relaxed text-sm text-text-secondary">
                                {selectedPlugin.description}
                              </div>
                            </div>

                            {/* Key Highlights Grid */}
                            <div className="flex flex-col gap-3">
                              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                Key Features
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {selectedPlugin.features.map((feature: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-overlay border border-border-subtle"
                                  >
                                    <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                      <Check size={14} />
                                    </div>
                                    <span className="text-xs text-text-secondary leading-snug">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Tags & Categories */}
                            <div className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                Tags
                              </span>
                              <div className="flex items-center gap-2 flex-wrap">
                                {selectedPlugin.tags.map((tag: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-xs font-semibold px-3 py-1 rounded-xl bg-surface-raised border border-border-subtle text-text-secondary"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 2: CONFIGURATION */}
                        {selectedDetailTab === "config" && (
                          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                            <PluginConfigForm key={selectedPlugin.id} pluginId={selectedPlugin.id} />
                          </div>
                        )}


                        {/* TAB 3: TECHNICAL SPECS */}
                        {selectedDetailTab === "specs" && (
                          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                              INFO
                            </span>

                            <div className="rounded-2xl border border-border-subtle bg-surface-overlay overflow-hidden text-xs">
                              <div className="divide-y divide-border-subtle">
                                <div className="flex items-center justify-between p-3.5">
                                  <span className="font-medium text-text-muted">Plugin Identifier</span>
                                  <div className="flex items-center gap-2 font-mono text-text-primary">
                                    <span>{selectedPlugin.id}</span>
                                    <button
                                      onClick={() => handleCopyId(selectedPlugin.id)}
                                      className="p-1 rounded-md bg-surface-raised hover:text-accent transition-colors"
                                      title="Copy Plugin ID"
                                    >
                                      {copiedId ? (
                                        <Check size={12} className="text-emerald-400" />
                                      ) : (
                                        <Copy size={12} />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between p-3.5">
                                  <span className="font-medium text-text-muted">Author / Maintainer</span>
                                  <span className="font-semibold text-text-primary">
                                    {selectedPlugin.author}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between p-3.5">
                                  <span className="font-medium text-text-muted">Plugin Version</span>
                                  <span className="font-mono text-text-primary">
                                    v{selectedPlugin.version}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between p-3.5">
                                  <span className="font-medium text-text-muted">Plugin Source</span>
                                  <span className="font-bold uppercase text-[10px] text-accent">
                                    {selectedPlugin.type === "builtin"
                                      ? "BUILT-IN"
                                      : "EXTERNAL"}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between p-3.5">
                                  <span className="font-medium text-text-muted">Ambient Glow Color</span>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-3.5 h-3.5 rounded-full shadow-sm border border-white/20"
                                      style={{ backgroundColor: selectedAmbientColor }}
                                    />
                                    <span className="font-mono text-text-primary uppercase font-bold text-[11px]">
                                      {selectedAmbientColor}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between p-3.5">
                                  <span className="font-medium text-text-muted">Configuration Options</span>
                                  <span className="font-mono text-text-secondary">
                                    {window.Mewsic?.config?.getSchema(selectedPlugin.id)?.length
                                      ? `${window.Mewsic.config.getSchema(selectedPlugin.id).length} parameters registered`
                                      : "Zero configuration registered"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
            ) : (
              <div className="glass rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4">
                <Puzzle size={40} className="text-text-muted opacity-40" />
                <div>
                  <h3 className="text-base font-bold text-text-primary">No Plugin Selected</h3>
                  <p className="text-xs text-text-muted mt-1">
                    Select a plugin from the list to view its configuration, capabilities, and status.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── UNINSTALL CONFIRMATION MODAL ── */}
      {showDeleteModal && selectedPlugin && (
        <ConfirmationModal
          title={`Uninstall ${selectedPlugin.name}?`}
          message={`Are you sure you want to remove "${selectedPlugin.name}"? This will permanently delete it and its configuration from your computer.`}
          confirmLabel="Uninstall Plugin"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeletePlugin}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
