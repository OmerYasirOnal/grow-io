# Google Play: Snake Grow.io: Battle Arena

Package `com.omeryasir.growio`, version 1.4.0, versionCode 1 (from `app.json`). Listing texts and
images for fastlane `supply` are in `fastlane/metadata/android/{en-US,tr-TR}` (default language en-US).

## Status (2026-11-15)

- The Play developer account on engomeryasironal@gmail.com was closed by Google on 11 Oct 2024 for
  inactivity (fee not refundable). A new developer account is needed (owner action: USD 25, identity and
  phone verification). onalomer44@gmail.com has no developer account.
- New personal accounts must run a closed test with at least 12 opted-in testers for 14 days before they can
  apply for production access.
- Signed AAB: `android/app/build/outputs/bundle/release/app-release.aab` (rebuild with
  `npx expo prebuild --platform android --clean && cd android && ./gradlew bundleRelease`, JAVA_HOME =
  Homebrew openjdk@17). Upload key: `~/.growio-signing/upload.jks` + `signing.properties` (never commit;
  back it up). Use Play App Signing; this key is only the upload key.
- AdMob: Android app and ad units not created yet. Until then `androidAppId` is Google's sample ID and
  Android serves test ads (no revenue). Create them, then fill `AD_UNITS.android` and `androidAppId`.

## Store listing

| Field | Value |
|---|---|
| App name | Snake Grow.io: Battle Arena |
| Category | Game > Action (tag: Casual, Arcade) |
| Contact email | contact@akisgames.com |
| Website | https://omeryasironal.com/grow-io/ |
| Privacy policy | https://omeryasironal.com/grow-io/privacy/ |
| Short / full description | `fastlane/metadata/android/*/short_description.txt`, `full_description.txt` |
| Icon 512, feature graphic 1024x500, 7 phone screenshots 1080x1920 | `fastlane/metadata/android/*/images/` (no device frames) |

## App content answers

- **Privacy policy:** URL above.
- **Ads:** Yes, the app contains ads (Google AdMob).
- **App access:** All functionality available without special access (no login).
- **Target audience:** 13-15, 16-17, 18+ (not designed for children; avoids the Families program).
- **Content rating (IARC):** Game. No violence beyond abstract cartoon snakes colliding, no blood, no sexual
  content, no profanity, no drugs, no gambling or simulated gambling, no user-generated content or chat,
  no sharing of location, no digital purchases.
- **News / COVID-19 / government / financial / health apps:** No.
- **Advertising ID:** Yes, used for Advertising and Analytics (AD_ID permission is declared by the ads SDK).

## Data safety

Collected (none is shared beyond the SDK providers acting for us; data is encrypted in transit; there is
no account, so deletion requests go to contact@akisgames.com):

| Data type | Collected | Purpose | Optional |
|---|---|---|---|
| Location > Approximate location (IP-derived) | Yes | Analytics, Advertising | No |
| App activity > App interactions | Yes | Analytics | No |
| App info and performance > Diagnostics | Yes | Analytics | No |
| Device or other IDs (Advertising ID, app instance ID) | Yes | Advertising, Analytics, Fraud prevention | No |

Not collected: personal info (name, email, phone, address), financial info, precise location, messages,
photos, contacts, health, files. Game progress stays on the device.

Permissions in the release manifest: INTERNET, ACCESS_NETWORK_STATE, VIBRATE, WAKE_LOCK, AD_ID and the
AdServices permissions added by the ads SDK. Storage and overlay permissions are blocked in `app.json`.
