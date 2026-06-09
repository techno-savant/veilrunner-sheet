import type { ResultTier, RollResult, TierThresholds } from '../types/index.js';
import { getSettingNumber } from '../settings.js';

export function getThresholds(): TierThresholds {
  return {
    strongHit: getSettingNumber('strongHitThreshold', 8),
    hit: getSettingNumber('hitThreshold', 2),
    closeHit: getSettingNumber('closeHitThreshold', 0),
    glancing: getSettingNumber('glancingThreshold', -4),
  };
}

export function classifyTier(margin: number, t: TierThresholds): ResultTier {
  if (margin >= t.strongHit) return 'strong-hit';
  if (margin >= t.hit) return 'hit';
  if (margin >= t.closeHit) return 'close-hit';
  if (margin >= t.glancing) return 'glancing';
  return 'miss';
}

function extractD20(roll: Roll): number {
  const terms = roll.terms;
  for (const term of terms) {
    const results = term.results;
    if (Array.isArray(results) && results.length > 0) {
      const first = results[0];
      if (first && typeof first.result === 'number') {
        return first.result;
      }
    }
  }
  // Roll always has one Die term for 1d20 — falling through here means Foundry's contract broke.
  throw new Error('RollEngine: unable to read d20 result from roll terms');
}

export async function rollCheck(params: {
  label: string;
  modifier: number;
  dc: number | null;
  actorName: string;
  actorImg: string;
}): Promise<RollResult> {
  const roll = new Roll('1d20 + @mod', { mod: params.modifier });
  await roll.evaluate({});

  const total = roll.total;
  const d20 = extractD20(roll);

  let margin: number | null = null;
  let tier: ResultTier | null = null;
  if (params.dc !== null && Number.isFinite(params.dc)) {
    margin = total - params.dc;
    tier = classifyTier(margin, getThresholds());
  }

  return {
    label: params.label,
    d20,
    modifier: params.modifier,
    total,
    dc: params.dc,
    margin,
    tier,
    actorName: params.actorName,
    actorImg: params.actorImg,
  };
}
