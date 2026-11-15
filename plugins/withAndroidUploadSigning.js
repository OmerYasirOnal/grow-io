// Signs Android release builds with the Play upload key, on every prebuild.
//
// The key and its passwords never enter the repo: they live in
// ~/.growio-signing/signing.properties (GROWIO_UPLOAD_STORE_FILE, _KEY_ALIAS,
// _STORE_PASSWORD, _KEY_PASSWORD), or the same names as environment variables.
// Without them the release build falls back to the debug key, so a fresh
// checkout still builds; such an artifact cannot be uploaded to Play.
const { withAppBuildGradle } = require('@expo/config-plugins');

const TAG = '// growio-upload-signing';

const SIGNING_CONFIG = `        upload {
            ${TAG}
            def p = new Properties()
            def f = new File(System.getProperty('user.home'), '.growio-signing/signing.properties')
            if (f.exists()) f.withInputStream { p.load(it) }
            def v = { k -> System.getenv(k) ?: p.getProperty(k) }
            if (v('GROWIO_UPLOAD_STORE_FILE')) {
                storeFile file(v('GROWIO_UPLOAD_STORE_FILE'))
                storePassword v('GROWIO_UPLOAD_STORE_PASSWORD')
                keyAlias v('GROWIO_UPLOAD_KEY_ALIAS')
                keyPassword v('GROWIO_UPLOAD_KEY_PASSWORD')
            }
        }
`;

module.exports = function withAndroidUploadSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(TAG)) return cfg;
    const open = src.indexOf('signingConfigs {');
    if (open < 0) throw new Error('withAndroidUploadSigning: signingConfigs block not found');
    const insertAt = src.indexOf('\n', open) + 1;
    src = src.slice(0, insertAt) + SIGNING_CONFIG + src.slice(insertAt);
    // Release: the upload key when configured, else debug (local smoke builds).
    const release = src.indexOf('release {', src.indexOf('buildTypes {'));
    const line = src.indexOf('signingConfig signingConfigs.debug', release);
    if (release < 0 || line < 0) throw new Error('withAndroidUploadSigning: release signingConfig not found');
    src = src.slice(0, line) +
      'signingConfig signingConfigs.upload.storeFile ? signingConfigs.upload : signingConfigs.debug' +
      src.slice(line + 'signingConfig signingConfigs.debug'.length);
    cfg.modResults.contents = src;
    return cfg;
  });
};
