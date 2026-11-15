// Raises every Pods target to at least iOS 15.1.
//
// The iOS 27 SDK rejects deployment targets below 15.0, and several pod
// resource-bundle targets (Google-Mobile-Ads-SDK, GoogleUtilities, nanopb,
// PromisesObjC, RNCAsyncStorage...) still declare 9.0-13.4, which fails the
// build. This appends a loop to the Podfile's post_install on every prebuild.
const { withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MIN = '15.1';

const SNIPPET = `    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        cur = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if cur.nil? || Gem::Version.new(cur) < Gem::Version.new('${MIN}')
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end`;

module.exports = function withPodDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    const res = mergeContents({
      tag: 'grow-io-pod-deployment-target',
      src: cfg.modResults.contents,
      newSrc: SNIPPET,
      anchor: /post_install do \|installer\|/,
      offset: 1,
      comment: '#',
    });
    if (!res.didMerge && !res.didClear && !cfg.modResults.contents.includes('grow-io-pod-deployment-target')) {
      throw new Error('withPodDeploymentTarget: post_install anchor not found in Podfile');
    }
    cfg.modResults.contents = res.contents;
    return cfg;
  });
};
