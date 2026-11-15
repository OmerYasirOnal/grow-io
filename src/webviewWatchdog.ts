// Detects a frozen or crashed game WebView so the host can bring it back
// instead of leaving the player on a dead screen until they kill the app.
//
// The host pings the page every PING_MS with injectJavaScript; the page answers
// with a PONG message. If the page stops answering for STALE_MS while the app is
// in the foreground and no full-screen ad is up, the WebView is remounted.
// Pure policy (no React Native imports) so it is unit-tested.

export const WATCHDOG = {
  PING_MS: 3000,
  STALE_MS: 12000,
  // Never remount twice within this window (a page that hangs again right after
  // a reload should not turn into a reload loop).
  MIN_RECOVERY_GAP_MS: 60000,
} as const;

export type WatchdogState = {
  lastPongAt: number;
  lastRecoveryAt: number;
};

export function newWatchdogState(now: number): WatchdogState {
  return { lastPongAt: now, lastRecoveryAt: -Infinity };
}

export function shouldRecover(
  s: WatchdogState, now: number, appActive: boolean, adOpen: boolean,
): boolean {
  if (!appActive || adOpen) return false;
  if (now - s.lastRecoveryAt < WATCHDOG.MIN_RECOVERY_GAP_MS) return false;
  return now - s.lastPongAt > WATCHDOG.STALE_MS;
}

// Script injected on every ping. Runs on the page's main thread, so a hung page
// never answers.
export const PING_JS = `try{window.ReactNativeWebView.postMessage('{"type":"PONG"}');}catch(e){}true;`;
