import type { TalentNodeData } from '../types/index.js';

const NODE_W = 130;
const NODE_H = 48;
const GAP_X = 24;
const GAP_Y = 40;
const PADDING = 16;
const MAX_NAME_CHARS = 18;

const UNLOCKED_FILL = '#2a4a7a';
const UNLOCKED_STROKE = '#5a8ac9';
const LOCKED_FILL = '#222';
const LOCKED_STROKE = '#444';
const EDGE_COLOR = '#555';

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(name: string): string {
  if (name.length <= MAX_NAME_CHARS) return name;
  if (MAX_NAME_CHARS <= 1) return name.slice(0, MAX_NAME_CHARS);
  return `${name.slice(0, MAX_NAME_CHARS - 1)}…`;
}

interface LaidOutNode extends TalentNodeData {
  x: number;
  y: number;
  cx: number;
  topY: number;
  bottomY: number;
}

export function buildTreeSVG(nodes: TalentNodeData[]): string {
  if (nodes.length === 0) {
    // Empty tree: emit a tiny placeholder SVG rather than failing — caller may wrap it in copy.
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PADDING * 2}" height="${PADDING * 2}" class="talent-tree empty"></svg>`;
  }

  // Group by tier.
  const tiers = new Map<number, TalentNodeData[]>();
  for (const node of nodes) {
    const tierKey = Number.isInteger(node.tier) && node.tier >= 0 ? node.tier : 0;
    const bucket = tiers.get(tierKey);
    if (bucket) {
      bucket.push(node);
    } else {
      tiers.set(tierKey, [node]);
    }
  }

  const sortedTierKeys = Array.from(tiers.keys()).sort((a, b) => a - b);
  // Normalize tier indices to a 0-based row sequence so display is compact even with sparse tiers.
  const tierRowIndex = new Map<number, number>();
  sortedTierKeys.forEach((tierKey, rowIdx) => tierRowIndex.set(tierKey, rowIdx));

  const numRows = sortedTierKeys.length;
  let maxNodesInAnyTier = 0;
  for (const tierKey of sortedTierKeys) {
    const tierNodes = tiers.get(tierKey);
    if (tierNodes && tierNodes.length > maxNodesInAnyTier) {
      maxNodesInAnyTier = tierNodes.length;
    }
  }

  const svgWidth = maxNodesInAnyTier * (NODE_W + GAP_X) + PADDING * 2;
  const svgHeight = numRows * (NODE_H + GAP_Y) + PADDING * 2;

  // Layout: for each node, x is its sibling index within its tier; y is its row index.
  const laidOut = new Map<string, LaidOutNode>();
  const nodeByName = new Map<string, LaidOutNode>();
  for (const tierKey of sortedTierKeys) {
    const row = tierRowIndex.get(tierKey) ?? 0;
    const tierNodes = tiers.get(tierKey) ?? [];
    tierNodes.forEach((node, siblingIdx) => {
      const x = siblingIdx * (NODE_W + GAP_X) + PADDING;
      const y = row * (NODE_H + GAP_Y) + PADDING;
      const placed: LaidOutNode = {
        ...node,
        x,
        y,
        cx: x + NODE_W / 2,
        topY: y,
        bottomY: y + NODE_H,
      };
      laidOut.set(node.id, placed);
      nodeByName.set(node.name, placed);
    });
  }

  // Edges: from bottom-center of prerequisite node → top-center of dependent node.
  const edgeParts: string[] = [];
  for (const node of laidOut.values()) {
    for (const prereqName of node.prerequisites) {
      const prereq = nodeByName.get(prereqName);
      if (!prereq) continue; // Prerequisite is outside this tree; skip drawing the edge.
      edgeParts.push(
        `<line x1="${prereq.cx}" y1="${prereq.bottomY}" x2="${node.cx}" y2="${node.topY}" stroke="${EDGE_COLOR}" stroke-width="2" class="talent-edge" />`
      );
    }
  }

  // Nodes.
  const nodeParts: string[] = [];
  for (const node of laidOut.values()) {
    const fill = node.unlocked ? UNLOCKED_FILL : LOCKED_FILL;
    const stroke = node.unlocked ? UNLOCKED_STROKE : LOCKED_STROKE;
    const classes = `talent-node ${node.unlocked ? 'unlocked' : 'locked'}`;
    const display = escapeXmlText(truncate(node.name));
    const textX = node.x + NODE_W / 2;
    const textY = node.y + NODE_H / 2 + 4; // visual baseline correction
    const lockIndicator = node.unlocked
      ? ''
      : `<text x="${node.x + NODE_W - 12}" y="${node.y + 14}" class="talent-lock" fill="#bbb" font-size="12" text-anchor="middle">◆</text>`;

    nodeParts.push(
      `<g class="${classes}" data-action="showTalentDetail" data-talent-id="${escapeXmlAttr(node.id)}" data-talent-name="${escapeXmlAttr(node.name)}" data-talent-desc="${escapeXmlAttr(node.description)}">` +
        `<rect x="${node.x}" y="${node.y}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2" />` +
        `<text x="${textX}" y="${textY}" fill="#fff" font-size="13" text-anchor="middle" font-family="sans-serif">${display}</text>` +
        lockIndicator +
      `</g>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="talent-tree" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">` +
      edgeParts.join('') +
      nodeParts.join('') +
    `</svg>`
  );
}
