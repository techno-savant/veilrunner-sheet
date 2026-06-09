import type { PIState } from '../types/index.js';

export const AXIS_MIN = -10;
export const AXIS_MAX = 10;

export function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < AXIS_MIN) return AXIS_MIN;
  if (value > AXIS_MAX) return AXIS_MAX;
  return Math.trunc(value);
}

function autonomyBucket(autonomy: number): string {
  if (autonomy < -3) return 'Autonomous';
  if (autonomy > 3) return 'Institutional';
  return 'Adaptive';
}

function empathyBucket(empathy: number): string {
  if (empathy < -3) return 'Ruthless';
  if (empathy > 3) return 'Empathetic';
  return 'Neutral';
}

function legalityBucket(legality: number): string {
  if (legality < -3) return 'Criminal';
  if (legality > 3) return 'Lawful';
  return 'Neutral';
}

export function piLabel(input: { autonomy: number; empathy: number; legality: number }): string {
  const autonomy = autonomyBucket(input.autonomy);
  const empathy = empathyBucket(input.empathy);
  const legality = legalityBucket(input.legality);
  const compound =
    empathy === 'Neutral' && legality === 'Neutral'
      ? 'True Neutral'
      : `${empathy} ${legality}`;
  return `${autonomy} ${compound}`;
}

export function piState(input: { autonomy: number; empathy: number; legality: number }): PIState {
  return {
    autonomy: input.autonomy,
    empathy: input.empathy,
    legality: input.legality,
    label: piLabel(input),
  };
}
