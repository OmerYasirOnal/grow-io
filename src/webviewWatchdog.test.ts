import { WATCHDOG, newWatchdogState, shouldRecover } from './webviewWatchdog';

describe('webview watchdog policy', () => {
  it('does nothing while the page keeps answering', () => {
    const s = newWatchdogState(0);
    s.lastPongAt = 10000;
    expect(shouldRecover(s, 12000, true, false)).toBe(false);
  });

  it('recovers once the page has been silent longer than STALE_MS', () => {
    const s = newWatchdogState(0);
    expect(shouldRecover(s, WATCHDOG.STALE_MS - 1, true, false)).toBe(false);
    expect(shouldRecover(s, WATCHDOG.STALE_MS + 1, true, false)).toBe(true);
  });

  it('never recovers in the background or while a full-screen ad is up', () => {
    const s = newWatchdogState(0);
    const late = WATCHDOG.STALE_MS * 3;
    expect(shouldRecover(s, late, false, false)).toBe(false);
    expect(shouldRecover(s, late, true, true)).toBe(false);
  });

  it('does not loop: a second recovery waits MIN_RECOVERY_GAP_MS', () => {
    const s = newWatchdogState(0);
    s.lastRecoveryAt = 20000;
    s.lastPongAt = 0;
    expect(shouldRecover(s, 20000 + WATCHDOG.MIN_RECOVERY_GAP_MS - 1, true, false)).toBe(false);
    expect(shouldRecover(s, 20000 + WATCHDOG.MIN_RECOVERY_GAP_MS + 1, true, false)).toBe(true);
  });
});
