import type {
  RollResult,
  TalentNodeData,
  VeilrunnerActorSystem,
  VeilrunnerAttribute,
} from '../types/index.js';
import { piLabel, clampAxis } from '../components/PITracker.js';
import { buildTreeSVG } from '../components/TalentTree.js';
import { openRollDialog } from '../roll/RollDialog.js';
import { rollCheck } from '../roll/RollEngine.js';
import { postRollResult } from '../roll/ChatCard.js';

type AttributeKey = 'strength' | 'agility' | 'endurance' | 'insight' | 'presence' | 'tech';
type PIAxis = 'autonomy' | 'empathy' | 'legality';

const ATTRIBUTE_DEFS: ReadonlyArray<{ key: AttributeKey; label: string }> = [
  { key: 'strength', label: 'Strength' },
  { key: 'agility', label: 'Agility' },
  { key: 'endurance', label: 'Endurance' },
  { key: 'insight', label: 'Insight' },
  { key: 'presence', label: 'Presence' },
  { key: 'tech', label: 'Tech' },
];

const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'action', label: 'Action' },
  { id: 'talents', label: 'Talents' },
  { id: 'gear', label: 'Gear' },
  { id: 'character', label: 'Character' },
];

const DETAIL_KEYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'species', label: 'Species' },
  { key: 'origin', label: 'Origin' },
  { key: 'background', label: 'Background' },
  { key: 'archetype', label: 'Archetype' },
  { key: 'class', label: 'Class' },
  { key: 'discipline', label: 'Discipline' },
];

const PI_AXIS_TO_SYSTEM_FIELD: Record<PIAxis, keyof VeilrunnerActorSystem> = {
  autonomy: 'autonomylevel',
  empathy: 'moralitylevel',
  legality: 'legalitylevel',
};

interface SkillItemShape {
  id: string;
  name: string;
  attribute: AttributeKey;
  rank: number;
}

interface TalentItemShape {
  id: string;
  name: string;
  description: string;
  treeId: string;
  treeName: string;
  tier: number;
  prerequisites: string[];
  unlocked: boolean;
}

interface SimpleItemShape {
  id: string;
  name: string;
  description: string;
  img: string;
}

function isAttributeKey(value: unknown): value is AttributeKey {
  return (
    value === 'strength' ||
    value === 'agility' ||
    value === 'endurance' ||
    value === 'insight' ||
    value === 'presence' ||
    value === 'tech'
  );
}

function isPIAxis(value: unknown): value is PIAxis {
  return value === 'autonomy' || value === 'empathy' || value === 'legality';
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') out.push(entry);
  }
  return out;
}

function readAttribute(system: VeilrunnerActorSystem, key: AttributeKey): VeilrunnerAttribute {
  return system[key];
}

function classifySkill(item: FoundryItem): SkillItemShape | null {
  const sys = item.system;
  const attributeRaw = (sys as Record<string, unknown>)['attribute'];
  if (!isAttributeKey(attributeRaw)) return null;
  return {
    id: item.id,
    name: item.name,
    attribute: attributeRaw,
    rank: asNumber((sys as Record<string, unknown>)['rank'], 0),
  };
}

function classifyTalent(item: FoundryItem): TalentItemShape | null {
  const sys = item.system as Record<string, unknown>;
  const flags = item.flags as Record<string, unknown>;
  const vrFlags = (flags['veilrunner'] as Record<string, unknown> | undefined) ?? {};
  const talentFlags = (vrFlags['talent'] as Record<string, unknown> | undefined) ?? {};

  const treeId = asString(talentFlags['treeId'], '');
  if (treeId === '') return null;

  const treeNameRaw = asString(talentFlags['treeName'], '');
  return {
    id: item.id,
    name: item.name,
    description: asString(sys['description'], ''),
    treeId,
    treeName: treeNameRaw !== '' ? treeNameRaw : treeId,
    tier: asNumber(talentFlags['tier'], 0),
    prerequisites: asStringArray(talentFlags['prerequisites']),
    unlocked: talentFlags['unlocked'] === true,
  };
}

function classifySimpleItem(item: FoundryItem): SimpleItemShape {
  const sys = item.system as Record<string, unknown>;
  return {
    id: item.id,
    name: item.name,
    description: asString(sys['description'], ''),
    img: asString(item.img, ''),
  };
}

export class HeroSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // TypeScript cannot see members of `ActorSheetV2` through the mixin's generic
  // signature, so we re-declare the instance shape we rely on. This is a `declare`
  // — it does NOT emit runtime fields; Foundry's real base class provides them.
  declare readonly actor: FoundryActor;
  declare readonly element: HTMLElement;
  declare render: (force?: boolean, options?: Record<string, unknown>) => Promise<this>;
  declare close: (options?: Record<string, unknown>) => Promise<this>;

  static DEFAULT_OPTIONS: Record<string, unknown> = {
    classes: ['veilrunner', 'hero-sheet'],
    position: { width: 800, height: 660 },
    window: { resizable: true, title: 'Veilrunner Hero' },
    actions: {
      rollSkill:       HeroSheet.#rollSkill,
      rollAttribute:   HeroSheet.#rollAttribute,
      adjustPI:        HeroSheet.#adjustPI,
      changeTab:       HeroSheet.#changeTab,
      showTalentDetail: HeroSheet.#showTalentDetail,
      toggleItemDetail: HeroSheet.#toggleItemDetail,
      addSkill:        HeroSheet.#addSkill,
      deleteSkill:     HeroSheet.#deleteSkill,
      openItem:        HeroSheet.#openItem,
    },
  };

  static PARTS: Record<string, { template: string; scrollable?: string[] }> = {
    main: {
      template: 'modules/veilrunner-sheet/templates/hero-sheet.hbs',
      scrollable: ['.tab-body'],
    },
  };

  tabGroups: { primary: string } = { primary: 'action' };

  async _prepareContext(_options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const actor = this.actor;
    const system = actor.system as unknown as VeilrunnerActorSystem;

    const healthValue = asNumber(system.health?.value, 0);
    const healthMax = asNumber(system.health?.max, 0);
    const healthPct = healthMax > 0 ? Math.max(0, Math.min(100, Math.round((healthValue / healthMax) * 100))) : 0;

    const attributes = ATTRIBUTE_DEFS.map((def) => {
      const attr = readAttribute(system, def.key);
      return {
        key: def.key,
        label: def.label,
        value: asNumber(attr?.value, 0),
        max: asNumber(attr?.max, 0),
      };
    });

    const autonomy = asNumber(system.autonomylevel, 0);
    const empathy = asNumber(system.moralitylevel, 0);
    const legality = asNumber(system.legalitylevel, 0);
    const piLabelStr = piLabel({ autonomy, empathy, legality });

    // Collect items by type.
    const skills: SkillItemShape[] = [];
    const talents: TalentItemShape[] = [];
    const gear: SimpleItemShape[] = [];
    const augmentations: SimpleItemShape[] = [];

    for (const item of actor.items) {
      switch (item.type) {
        case 'skill': {
          const s = classifySkill(item);
          if (s) skills.push(s);
          break;
        }
        case 'talent': {
          const t = classifyTalent(item);
          if (t) talents.push(t);
          break;
        }
        case 'gear':
          gear.push(classifySimpleItem(item));
          break;
        case 'augmentation':
          augmentations.push(classifySimpleItem(item));
          break;
        default:
          break;
      }
    }

    // Group skills by attribute, preserving attribute order.
    const skillsByAttribute = ATTRIBUTE_DEFS.map((def) => {
      const attr = readAttribute(system, def.key);
      const attrValue = asNumber(attr?.value, 0);
      const groupSkills = skills
        .filter((s) => s.attribute === def.key)
        .map((s) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          rollModifier: attrValue + s.rank,
        }));
      return {
        attributeKey: def.key,
        attributeLabel: def.label,
        skills: groupSkills,
      };
    }).filter((group) => group.skills.length > 0);

    // Group talents by treeId, then build SVG.
    const trees = new Map<string, { treeId: string; treeName: string; nodes: TalentNodeData[] }>();
    for (const t of talents) {
      const existing = trees.get(t.treeId);
      const node: TalentNodeData = {
        id: t.id,
        name: t.name,
        description: t.description,
        tier: t.tier,
        prerequisites: t.prerequisites,
        unlocked: t.unlocked,
      };
      if (existing) {
        existing.nodes.push(node);
      } else {
        trees.set(t.treeId, { treeId: t.treeId, treeName: t.treeName, nodes: [node] });
      }
    }
    const talentTrees = Array.from(trees.values()).map((group) => ({
      treeId: group.treeId,
      treeName: group.treeName,
      treeSvg: buildTreeSVG(group.nodes),
    }));

    const detailsSource = (system.details ?? {}) as Partial<Record<string, string>>;
    const details: Record<string, string> = {};
    for (const def of DETAIL_KEYS) {
      const value = detailsSource[def.key];
      if (typeof value === 'string' && value.trim() !== '') {
        details[def.key] = value;
      } else {
        details[def.key] = '';
      }
    }

    const activeTab = this.tabGroups.primary;
    const tabs = TABS.map((t) => ({ ...t, active: t.id === activeTab }));

    return {
      actor,
      system,
      health: { value: healthValue, max: healthMax, pct: healthPct },
      attributes,
      pi: { autonomy, empathy, legality, label: piLabelStr },
      activeTab,
      tabs,
      detailKeys: DETAIL_KEYS,
      skills: skillsByAttribute,
      talentTrees,
      gear,
      augmentations,
      details,
    };
  }

  // ---- Action handlers ----

  static async #rollSkill(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.dataset['itemId'];
    if (typeof itemId !== 'string' || itemId === '') return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const shape = classifySkill(item);
    if (!shape) return;

    const system = this.actor.system as unknown as VeilrunnerActorSystem;
    const attr = readAttribute(system, shape.attribute);
    const baseModifier = asNumber(attr?.value, 0) + shape.rank;
    const label = `${shape.name}`;

    const dialogResult = await openRollDialog(label, baseModifier);
    if (!dialogResult) return;

    const totalModifier = dialogResult.modifier + dialogResult.situational;
    const result = await rollCheck({
      label,
      modifier: totalModifier,
      dc: dialogResult.dc,
      actorName: this.actor.name,
      actorImg: this.actor.img,
    });
    await postRollResult(result);
  }

  static async #rollAttribute(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const attribute = target.dataset['attribute'];
    if (!isAttributeKey(attribute)) return;
    const system = this.actor.system as unknown as VeilrunnerActorSystem;
    const attr = readAttribute(system, attribute);
    const baseModifier = asNumber(attr?.value, 0);
    const label = attribute.charAt(0).toUpperCase() + attribute.slice(1);

    const dialogResult = await openRollDialog(label, baseModifier);
    if (!dialogResult) return;

    const totalModifier = dialogResult.modifier + dialogResult.situational;
    const result: RollResult = await rollCheck({
      label,
      modifier: totalModifier,
      dc: dialogResult.dc,
      actorName: this.actor.name,
      actorImg: this.actor.img,
    });
    await postRollResult(result);
  }

  static async #adjustPI(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const axis = target.dataset['axis'];
    const deltaRaw = target.dataset['delta'];
    if (!isPIAxis(axis)) return;
    const delta = Number(deltaRaw);
    if (!Number.isFinite(delta) || delta === 0) return;

    const system = this.actor.system as unknown as VeilrunnerActorSystem;
    const field = PI_AXIS_TO_SYSTEM_FIELD[axis];
    const current = asNumber(system[field] as unknown, 0);
    const next = clampAxis(current + delta);
    if (next === current) return;

    const newAutonomy = axis === 'autonomy' ? next : asNumber(system.autonomylevel, 0);
    const newEmpathy = axis === 'empathy' ? next : asNumber(system.moralitylevel, 0);
    const newLegality = axis === 'legality' ? next : asNumber(system.legalitylevel, 0);
    const newLabel = piLabel({ autonomy: newAutonomy, empathy: newEmpathy, legality: newLegality });

    const update: Record<string, unknown> = {
      [`system.${field}`]: next,
      'system.personalityindex': newLabel,
    };
    await this.actor.update(update);
    await this.render(false);
  }

  static async #changeTab(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const tab = target.dataset['tab'];
    if (typeof tab !== 'string' || tab === '') return;
    this.tabGroups.primary = tab;

    const root = this.element;
    if (!(root instanceof HTMLElement)) return;

    const buttons = root.querySelectorAll<HTMLElement>('.tab-button');
    buttons.forEach((btn) => {
      if (btn.dataset['tab'] === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const panels = root.querySelectorAll<HTMLElement>('.tab-body .tab');
    panels.forEach((panel) => {
      if (panel.classList.contains(`tab-${tab}`)) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  static async #showTalentDetail(this: HeroSheet, event: Event, target: HTMLElement): Promise<void> {
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;
    const node = target.closest('[data-talent-id]');
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;

    const datasetSource =
      node instanceof HTMLElement ? node.dataset : (node as SVGElement & { dataset: DOMStringMap }).dataset;
    const name = asString(datasetSource['talentName'], '');
    const desc = asString(datasetSource['talentDesc'], '');

    const popover = root.querySelector<HTMLElement>('.talent-popover');
    if (!popover) return;

    popover.innerHTML = `<h4 class="talent-popover-name"></h4><div class="talent-popover-desc"></div>`;
    const nameEl = popover.querySelector('.talent-popover-name');
    const descEl = popover.querySelector('.talent-popover-desc');
    if (nameEl) nameEl.textContent = name;
    if (descEl) descEl.textContent = desc;

    // Position near the click within the sheet's coordinate space.
    const rootRect = root.getBoundingClientRect();
    let clientX = rootRect.left + 32;
    let clientY = rootRect.top + 32;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    const localX = Math.max(8, clientX - rootRect.left + 8);
    const localY = Math.max(8, clientY - rootRect.top + 8);
    popover.style.left = `${localX}px`;
    popover.style.top = `${localY}px`;
    popover.classList.remove('hidden');

    // Dismiss on next outside click.
    const dismiss = (e: Event): void => {
      const t = e.target;
      if (t instanceof Node && popover.contains(t)) return;
      popover.classList.add('hidden');
      document.removeEventListener('click', dismiss, true);
    };
    // Defer one tick so the originating click doesn't immediately dismiss.
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  static async #toggleItemDetail(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.dataset['itemId'];
    if (typeof itemId !== 'string' || itemId === '') return;
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;
    const row = root.querySelector<HTMLElement>(`.item-row[data-item-id="${cssEscape(itemId)}"]`);
    if (!row) return;
    row.classList.toggle('expanded');
  }

  static async #addSkill(this: HeroSheet): Promise<void> {
    await this.actor.createEmbeddedDocuments('Item', [{
      type: 'skill',
      name: 'New Skill',
      system: { attribute: 'strength', rank: 0 },
    }]);
    await this.render(false);
  }

  static async #deleteSkill(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.dataset['itemId'];
    if (typeof itemId !== 'string' || itemId === '') return;
    await this.actor.deleteEmbeddedDocuments('Item', [itemId]);
    await this.render(false);
  }

  static async #openItem(this: HeroSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.dataset['itemId'];
    if (typeof itemId !== 'string' || itemId === '') return;
    const item = this.actor.items.get(itemId);
    await item?.sheet?.render(true);
  }

  _attachPartListeners(
    partId: string,
    htmlElement: HTMLElement,
    options: Record<string, unknown>,
  ): void {
    super._attachPartListeners(partId, htmlElement, options);

    htmlElement.querySelectorAll<HTMLInputElement>('.skill-rank-input').forEach((input) => {
      input.addEventListener('change', () => {
        const itemId = input.dataset['itemId'];
        if (typeof itemId !== 'string' || itemId === '') return;
        const value = parseInt(input.value, 10);
        if (!Number.isFinite(value)) return;
        const item = this.actor.items.get(itemId);
        void item?.update({ 'system.rank': value });
      });
    });

    htmlElement.querySelectorAll<HTMLInputElement>('.attr-value-input').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset['attributeKey'];
        const value = parseInt(input.value, 10);
        if (typeof key !== 'string' || key === '' || !Number.isFinite(value)) return;
        void this.actor.update({ [`system.${key}.value`]: value });
      });
    });
  }
}

function cssEscape(value: string): string {
  // Minimal CSS attribute-value escape — only escapes characters that would terminate the selector.
  return value.replace(/(["\\\]])/g, '\\$1');
}
