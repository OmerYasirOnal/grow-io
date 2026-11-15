import { Platform } from 'react-native';
import { loadMeta, updateMeta } from './storage';

// Marketing version from app.json: the review prompt is asked at most once per
// released version, so a new release may ask again.
const APP_VERSION: string = require('../app.json').expo.version;

let inFlight = false;

// Shows the system "rate this app" sheet. The OS decides whether it actually
// appears (Apple caps it at 3 per year), so this is a request, not a guarantee.
// The game only calls this at a happy moment (new best / good run).
export async function requestStoreReview(): Promise<boolean> {
  if (Platform.OS !== 'ios' || inFlight) return false;
  inFlight = true;
  try {
    const meta = await loadMeta();
    if (meta.reviewAskedVersion === APP_VERSION) return false;
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoStoreReview')) return false;
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    await updateMeta({ reviewAskedVersion: APP_VERSION });
    return true;
  } catch {
    return false;
  } finally {
    inFlight = false;
  }
}
