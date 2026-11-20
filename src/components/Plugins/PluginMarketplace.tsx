import React, { useRef } from "react";
import {
  ArrowLeft,
  Zap,
  ShieldCheck,
  Code2,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  Clock,
  Puzzle,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";

interface PluginMarketplaceProps {
  onBack: () => void;
  onOpenPluginsFolder: () => void;
  onReloadApp: () => void;
  reloading: boolean;
}

const PLANNED_FEATURES = [
  {
    icon: <Zap size={22} className="text-accent" />,
    title: "1-Click Installation",
    desc: "Browse, install, and update community plugins instantly without extracting archives or handling manual files.",
  },
  {
    icon: <ShieldCheck size={22} className="text-emerald-400" />,
    title: "Tested & Verified",
    desc: "Only strictly tested and verified to be safe and functioning plugins appear in the marketplace.",
  },
  {
    icon: <Code2 size={22} className="text-violet-400" />,
    title: "Open Developer API",
    desc: "Build plugins with the Mewsic Plugin-API, built for as much customization as we can offer.",
  },
  {
    icon: <RefreshCw size={22} className="text-amber-400" />,
    title: "New Plugins Every Week",
    desc: "New plugins are added to the marketplace every week (we hope), so you can always find something new.",
  },
];

export const PluginMarketplace: React.FC<PluginMarketplaceProps> = ({
  onBack,
  onOpenPluginsFolder,
  onReloadApp,
  reloading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const handleOpenDiscussions = async () => {
    try {
      await open("https://github.com/xeoniii/Mewsic/discussions/categories/plugins");
    } catch (e) {
      console.error("Failed to open URL:", e);
    }
  };

  const handleOpenRepo = async () => {
    try {
      await open("https://xeoniii.github.io/Mewsic/plugin-api/");
    } catch (e) {
      console.error("Failed to open repo:", e);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto page select-none">
      <div className="flex flex-col gap-8 p-6 md:p-8 pb-20 w-full max-w-7xl mx-auto">
        {/* ── 1. HEADER WITH ACTIONS ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-sm group"
              title="Back to installed plugins"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-text-primary">
                  Plugin Marketplace
                </h1>
              </div>
              <p className="text-sm text-text-muted mt-1 max-w-2xl">
                Discover and install verified community plugins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Return to your installed plugins"
            >
              <Puzzle size={15} />
              <span>Installed Plugins</span>
            </button>
            <button
              onClick={onOpenPluginsFolder}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Open plugins directory on disk"
            >
              <FolderOpen size={15} className="text-text-muted" />
              <span>Plugins Folder</span>
            </button>
            <button
              onClick={onReloadApp}
              className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 text-text-secondary hover:text-text-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Reload Mewsic interface"
            >
              <RefreshCw
                size={14}
                className={reloading ? "animate-spin text-accent" : "text-text-muted"}
              />
              <span>Reload</span>
            </button>
          </div>
        </div>

        {/* ── 2. HERO SHOWCASE CARD (COMING SOON) ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-accent/10 via-surface-raised/60 to-surface-base/80 p-8 md:p-12 shadow-xl border border-border-subtle">
          <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl tracking-tight text-text-primary leading-tight">
              Coming soon.
            </h2>

            <p className="text-base sm:text-lg text-text-secondary mt-4 leading-relaxed font-normal">
              We are crafting an integrated community marketplace for Mewsic. Soon you will be able to browse, install, and update community-built plugins directly inside the app with a single click.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-5 h-11 rounded-xl bg-accent text-black font-extrabold text-sm hover:opacity-90 transition-all shadow-lg shadow-accent/20 cursor-pointer"
              >
                <Puzzle size={16} />
                <span>Manage Installed Plugins</span>
              </button>
            </div>

            {/* Timeline status note */}
            <div className="flex items-center gap-2 mt-6 text-xs text-text-muted font-mono">
              <Clock size={13} className="text-accent" />
              <span>Targeted Launch: Upcoming Feature Update (v1.4.0)</span>
            </div>
          </div>
        </div>

        {/* ── 3. ECOSYSTEM PILLARS / PLANNED CAPABILITIES ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-xl text-text-primary">
                What to Expect
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PLANNED_FEATURES.map((feat, i) => (
              <div
                key={i}
                className="p-6 md:p-7 rounded-2xl bg-surface-raised/70 border border-border-subtle hover:border-[var(--accent-glow)] transition-all duration-200 flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {feat.icon}
                </div>
                <div>
                  <h4 className="font-bold text-base text-text-primary">
                    {feat.title}
                  </h4>
                  <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. DEVELOPER CALLOUT BANNER ── */}
        <div className="p-6 md:p-8 rounded-2xl bg-surface-raised/60 border border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div>
              <h4 className="font-bold text-base text-text-primary">
                Want to build your own Mewsic plugin?
              </h4>
              <p className="text-xs text-text-muted mt-1 max-w-xl">
                Check out the plugin documentation and examples in Mewsic docs to start building custom integrations today.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenRepo}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-surface-base border border-border-subtle hover:border-accent/40 text-text-primary font-bold text-xs transition-all shrink-0 cursor-pointer"
          >
            <span>Developer Documentation</span>
            <ExternalLink size={14} className="text-text-muted" />
          </button>
        </div>
      </div>
    </div>
  );
};
