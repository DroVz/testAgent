import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';
import { version } from '../../package.json';

/** Projet natif et garde-fous du lot 4 (§4.1, §4.8), vérifiés sans Mac. */

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const read = (...path: string[]) => readFileSync(join(ROOT, ...path), 'utf8');

function files(dir: string, test: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, test);
    return test(name) ? [path] : [];
  });
}

/** Valeur XML qui suit `<key>name</key>` dans un plist, ou undefined. */
function plistValue(plist: string, key: string): string | undefined {
  const match = new RegExp(`<key>${key}</key>\\s*(<(\\w+)\\s*/>|<(\\w+)>[\\s\\S]*?</\\3>)`).exec(plist);
  return match?.[1].replace(/\s+/g, ' ');
}

describe('capacitor.config.ts', () => {
  it('identifiant, dossier web, aucune clé server', () => {
    expect(config.appId).toBe('fr.muscutrack.app');
    expect(config.appName).toBe('MuscuTrack');
    expect(config.webDir).toBe('dist');
    expect(config).not.toHaveProperty('server');
    expect(config.plugins?.SplashScreen).toEqual({ launchAutoHide: false, backgroundColor: '#F5F5FA' });
    expect(config.plugins?.LocalNotifications).toEqual({ presentationOptions: [] });
  });
});

describe('ios/App/App/Info.plist', () => {
  const plist = read('ios', 'App', 'App', 'Info.plist');

  it('chiffrement non soumis à déclaration, nom affiché, région fr', () => {
    expect(plistValue(plist, 'ITSAppUsesNonExemptEncryption')).toBe('<false/>');
    expect(plistValue(plist, 'CFBundleDisplayName')).toBe('<string>MuscuTrack</string>');
    expect(plistValue(plist, 'CFBundleDevelopmentRegion')).toBe('<string>fr</string>');
  });

  it('portrait seul', () => {
    expect(plistValue(plist, 'UISupportedInterfaceOrientations')).toBe(
      '<array> <string>UIInterfaceOrientationPortrait</string> </array>',
    );
    expect(plist).not.toMatch(/UISupportedInterfaceOrientations~ipad/);
  });

  it('aucune clé NS…UsageDescription', () => {
    expect(plist).not.toMatch(/<key>NS\w*UsageDescription<\/key>/);
  });
});

describe('ios/App/App.xcodeproj', () => {
  const pbx = read('ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  const settings = (name: string) => [...pbx.matchAll(new RegExp(`\\b${name} = ([^;]+);`, 'g'))].map((m) => m[1]);

  it('iPhone seul, iOS 15.0, version 1.0.0 (celle de package.json), build 1', () => {
    expect(new Set(settings('TARGETED_DEVICE_FAMILY'))).toEqual(new Set(['1']));
    expect(new Set(settings('IPHONEOS_DEPLOYMENT_TARGET'))).toEqual(new Set(['15.0']));
    expect(new Set(settings('MARKETING_VERSION'))).toEqual(new Set(['1.0.0']));
    expect(version).toBe('1.0.0');
    expect(new Set(settings('CURRENT_PROJECT_VERSION'))).toEqual(new Set(['1']));
  });

  it('le manifeste de confidentialité est copié dans l’app (phase Resources)', () => {
    expect(pbx).toMatch(/\/\* PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile;/);
    const resources = /\/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;[\s\S]*?\};/.exec(pbx)?.[0];
    expect(resources).toMatch(/PrivacyInfo\.xcprivacy in Resources/);
  });
});

describe('ios/App/App/PrivacyInfo.xcprivacy', () => {
  const manifest = read('ios', 'App', 'App', 'PrivacyInfo.xcprivacy');

  it('aucun suivi, aucune donnée collectée', () => {
    expect(plistValue(manifest, 'NSPrivacyTracking')).toBe('<false/>');
    expect(plistValue(manifest, 'NSPrivacyTrackingDomains')).toBe('<array/>');
    expect(plistValue(manifest, 'NSPrivacyCollectedDataTypes')).toBe('<array/>');
    expect(plistValue(manifest, 'NSPrivacyAccessedAPITypes')).toBe('<array/>');
  });
});

describe('garde-fous du code', () => {
  const sources = files(SRC, (name) => /\.tsx?$/.test(name));

  it('pages et composants n’importent jamais @capacitor/* : tout passe par src/platform/', () => {
    const ui = sources.filter((f) => /[\\/]src[\\/](pages|components)[\\/]/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(ui.length).toBeGreaterThan(10);
    for (const file of ui) {
      expect(readFileSync(file, 'utf8'), relative(ROOT, file)).not.toMatch(/['"]@capacitor\//);
    }
  });

  it('aucun lien absolu (http/https) ni target="_blank" dans src/', () => {
    const scanned = files(SRC, (name) => /\.(tsx?|css|html)$/.test(name) && !/\.test\.tsx?$/.test(name));
    const absolute = new RegExp(['href', '\\s*[=:]\\s*[{(]?\\s*[\'"`]https?:'].join(''));
    const blank = new RegExp(['_bl', 'ank'].join(''));
    for (const file of scanned) {
      const code = readFileSync(file, 'utf8');
      expect(code, relative(ROOT, file)).not.toMatch(absolute);
      expect(code, relative(ROOT, file)).not.toMatch(blank);
    }
  });
});
