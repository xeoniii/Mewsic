// Mewsic Live Presence & Active Listeners Tracker (5-minute Heartbeat)
// Pings Cloudflare Worker when music is playing to track active concurrent listeners.

const DEFAULT_PRESENCE_URL = "https://mewsic-presence.imrishan320.workers.dev";

export function getPresenceUrl(): string {
  let url = (localStorage.getItem("mewsic_presence_url") || DEFAULT_PRESENCE_URL).trim();
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

export function setPresenceUrl(url: string): void {
  localStorage.setItem("mewsic_presence_url", url);
}

class PresenceManager {
  private sessionId: string;
  private intervalId: number | null = null;
  private isEnabled: boolean = true;
  private isListening: boolean = false;
  private isActiveOnServer: boolean = false;

  constructor() {
    this.sessionId = crypto.randomUUID();
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleUnload);
    }
  }

  /**
   * Sync active listener state.
   * Only active when anonymous telemetry is enabled, music is currently playing, and a track is loaded.
   */
  public updateStatus(enabled: boolean, isPlaying: boolean, hasTrack: boolean) {
    this.isEnabled = enabled;
    const shouldBeActive = enabled && isPlaying && hasTrack;

    if (shouldBeActive && !this.isListening) {
      this.startListening();
    } else if (!shouldBeActive && this.isListening) {
      this.stopListening();
    }
  }

  public start(enabled: boolean = true) {
    this.isEnabled = enabled;
  }

  public stop() {
    this.stopListening();
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopListening();
    }
  }

  private startListening() {
    this.isListening = true;

    // Send immediate ping when playback begins
    this.ping();

    // Heartbeat every 5 minutes while music continues playing
    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => {
        if (this.isListening && this.isEnabled) {
          this.ping();
        }
      }, 5 * 60 * 1000);
    }
  }

  private stopListening() {
    this.isListening = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.leave();
  }

  public async ping(): Promise<void> {
    const url = getPresenceUrl();
    if (!url) return;

    try {
      await fetch(`${url}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.sessionId }),
      });
      this.isActiveOnServer = true;
    } catch {
      // Fails silently when offline
    }
  }

  public async leave(): Promise<void> {
    if (!this.isActiveOnServer) return;
    const url = getPresenceUrl();
    if (!url) return;

    try {
      const payload = JSON.stringify({ sessionId: this.sessionId });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`${url}/leave`, blob);
      }
      await fetch(`${url}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Fails silently
    } finally {
      this.isActiveOnServer = false;
    }
  }

  private handleUnload = () => {
    this.leave();
  };

  public async getActiveUsers(): Promise<number | null> {
    const url = getPresenceUrl();
    if (!url) return null;
    try {
      const res = await fetch(`${url}/active-users`);
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.activeUsers === "number" ? data.activeUsers : null;
    } catch {
      return null;
    }
  }
}

export const presence = new PresenceManager();
