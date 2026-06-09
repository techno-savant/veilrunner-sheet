import type { RollResult } from '../types/index.js';

const CHAT_TEMPLATE_PATH = 'modules/veilrunner-sheet/templates/chat-card.hbs';

const TIER_LABELS: Record<string, string> = {
  'strong-hit': 'Strong Hit',
  hit: 'Hit',
  'close-hit': 'Close Hit',
  glancing: 'Glancing',
  miss: 'Miss',
};

export async function postRollResult(result: RollResult): Promise<void> {
  const tierLabel = result.tier ? TIER_LABELS[result.tier] ?? '' : '';
  const marginDisplay =
    result.margin === null
      ? null
      : result.margin >= 0
        ? `+${result.margin}`
        : `${result.margin}`;

  const content = await renderTemplate(CHAT_TEMPLATE_PATH, {
    label: result.label,
    d20: result.d20,
    modifier: result.modifier,
    total: result.total,
    dc: result.dc,
    margin: result.margin,
    marginDisplay,
    tier: result.tier,
    tierLabel,
    actorName: result.actorName,
    actorImg: result.actorImg,
  });

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ alias: result.actorName }),
  });
}
