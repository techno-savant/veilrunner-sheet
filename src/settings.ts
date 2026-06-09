const MODULE_ID = 'veilrunner-sheet';

interface ThresholdSettingSpec {
  key: string;
  default: number;
  nameKey: string;
  hintKey: string;
}

const THRESHOLD_SETTINGS: ReadonlyArray<ThresholdSettingSpec> = [
  { key: 'strongHitThreshold', default: 8, nameKey: 'VEILRUNNER.Settings.StrongHit.Name', hintKey: 'VEILRUNNER.Settings.StrongHit.Hint' },
  { key: 'hitThreshold', default: 2, nameKey: 'VEILRUNNER.Settings.Hit.Name', hintKey: 'VEILRUNNER.Settings.Hit.Hint' },
  { key: 'closeHitThreshold', default: 0, nameKey: 'VEILRUNNER.Settings.CloseHit.Name', hintKey: 'VEILRUNNER.Settings.CloseHit.Hint' },
  { key: 'glancingThreshold', default: -4, nameKey: 'VEILRUNNER.Settings.Glancing.Name', hintKey: 'VEILRUNNER.Settings.Glancing.Hint' },
];

export function registerSettings(): void {
  for (const spec of THRESHOLD_SETTINGS) {
    game.settings.register(MODULE_ID, spec.key, {
      name: spec.nameKey,
      hint: spec.hintKey,
      scope: 'world',
      config: true,
      type: Number,
      default: spec.default,
    });
  }
}

export function getSettingNumber(key: string, fallback: number): number {
  const raw = game.settings.get(MODULE_ID, key);
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return fallback;
}
