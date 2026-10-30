// Mewsic Live Presence & Usage Tracker (5-minute Heartbeat)
// Pings Cloudflare Worker to track active concurrent listening sessions.

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

  constructor() {
    this.sessionId = crypto.randomUUID();
  }

  public start(enabled: boolean = true) {
    this.isEnabled = enabled;
    if (!this.isEnabled) return;

    // Send initial launch ping
    this.ping();

    // Resend heartbeat every 5 minutes (300,000 ms)
    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => {
        if (this.isEnabled) {
          this.ping();
        }
      }, 5 * 60 * 1000);
    }

    // Attach leave handler on window close / quit
    window.addEventListener("beforeunload", this.handleUnload);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    window.removeEventListener("beforeunload", this.handleUnload);
    this.leave();
  }

  public setEnabled(enabled: boolean) {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;
    if (enabled) {
      this.start(true);
    } else {
      this.leave();
      if (this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  }

  private ping() {
    const url = getPresenceUrl();
    if (!url) return;

    fetch(`${url}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(() => {
      // Fails silently when offline or server unreachable
    });
  }

  private leave() {
    const url = getPresenceUrl();
    if (!url) return;

    try {
      const payload = JSON.stringify({ sessionId: this.sessionId });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`${url}/leave`, blob);
      } else {
        fetch(`${url}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => { });
      }
    } catch {
      // Silent error handling
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
