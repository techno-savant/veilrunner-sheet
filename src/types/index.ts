// Foundry VTT global declarations — no external @types dependency.

declare global {
  const game: {
    settings: {
      register(module: string, key: string, options: Record<string, unknown>): void;
      get(module: string, key: string): unknown;
    };
    modules: { get(id: string): { api?: unknown } | undefined };
    user?: { id: string; name: string };
    i18n?: { localize(key: string): string };
  };

  const Hooks: {
    once(event: string, fn: (...args: unknown[]) => void): void;
    on(event: string, fn: (...args: unknown[]) => void): void;
    callAll(event: string, ...args: unknown[]): void;
  };

  const Actors: {
    registerSheet(system: string, cls: unknown, options: Record<string, unknown>): void;
  };

  function loadTemplates(paths: string[]): Promise<void>;

  const renderTemplate: (path: string, data: Record<string, unknown>) => Promise<string>;

  const Handlebars: {
    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;
  };

  class Roll {
    constructor(formula: string, data?: Record<string, unknown>);
    evaluate(options?: Record<string, unknown>): Promise<this>;
    get total(): number;
    get terms(): Array<{ results?: Array<{ result: number }> }>;
  }

  class ChatMessage {
    static create(data: Record<string, unknown>): Promise<unknown>;
    static getSpeaker(options: Record<string, unknown>): Record<string, unknown>;
  }

  class Dialog {
    constructor(data: Record<string, unknown>, options?: Record<string, unknown>);
    render(force?: boolean): this;
    static prompt(options: Record<string, unknown>): Promise<unknown>;
    static confirm(options: Record<string, unknown>): Promise<boolean>;
  }

  class ActorSheetV2 {
    constructor(...args: unknown[]);
    readonly actor: FoundryActor;
    readonly element: HTMLElement;
    readonly isEditable: boolean;
    _mode: number;
    render(force?: boolean, options?: Record<string, unknown>): Promise<this>;
    close(options?: Record<string, unknown>): Promise<this>;
    _attachPartListeners(partId: string, htmlElement: HTMLElement, options: Record<string, unknown>): void;
    static DEFAULT_OPTIONS: Record<string, unknown>;
  }

  class ItemSheetV2 {
    constructor(...args: unknown[]);
    readonly item: FoundryItem;
    readonly isEditable: boolean;
    readonly element: HTMLElement;
    render(force?: boolean, options?: Record<string, unknown>): Promise<this>;
    close(options?: Record<string, unknown>): Promise<this>;
    _attachPartListeners(partId: string, htmlElement: HTMLElement, options: Record<string, unknown>): void;
    static DEFAULT_OPTIONS: Record<string, unknown>;
  }

  const Items: {
    registerSheet(system: string, cls: unknown, options: Record<string, unknown>): void;
  };

  // The mixin returns a constructor that preserves the instance shape of the
  // base class — TypeScript cannot model the full Foundry mixin contract from
  // here, so we intersect the returned constructor with the base type's
  // instance side so members like `actor`, `element`, and `render` remain
  // visible on instances of the mixed class.
  function HandlebarsApplicationMixin<
    T extends abstract new (...args: unknown[]) => object
  >(Base: T): T;

  interface FoundryItem {
    readonly id: string;
    readonly name: string;
    readonly img?: string;
    readonly type: string;
    readonly system: Record<string, unknown>;
    readonly flags: Record<string, unknown>;
    readonly sheet?: { render(force?: boolean): Promise<unknown> };
    update(data: Record<string, unknown>): Promise<FoundryItem>;
  }

  interface FoundryActor {
    readonly id: string;
    name: string;
    img: string;
    readonly system: Record<string, unknown>;
    readonly items: Iterable<FoundryItem> & {
      get(id: string): FoundryItem | undefined;
    };
    update(data: Record<string, unknown>): Promise<FoundryActor>;
    createEmbeddedDocuments(type: string, data: Array<Record<string, unknown>>): Promise<FoundryItem[]>;
    deleteEmbeddedDocuments(type: string, ids: string[]): Promise<FoundryItem[]>;
  }
}

// ---- Module-local exported types ----

export type ResultTier = 'strong-hit' | 'hit' | 'close-hit' | 'glancing' | 'miss';

export interface TierThresholds {
  strongHit: number;
  hit: number;
  closeHit: number;
  glancing: number;
}

export interface RollResult {
  label: string;
  d20: number;
  modifier: number;
  total: number;
  dc: number | null;
  margin: number | null;
  tier: ResultTier | null;
  actorName: string;
  actorImg: string;
}

export interface TalentNodeData {
  id: string;
  name: string;
  description: string;
  tier: number;
  prerequisites: string[];
  unlocked: boolean;
}

export interface PIState {
  autonomy: number;
  empathy: number;
  legality: number;
  label: string;
}

export interface VeilrunnerAttribute {
  value: number;
  max: number;
}

export interface VeilrunnerActorSystem {
  strength: VeilrunnerAttribute;
  agility: VeilrunnerAttribute;
  endurance: VeilrunnerAttribute;
  insight: VeilrunnerAttribute;
  presence: VeilrunnerAttribute;
  tech: VeilrunnerAttribute;
  health: { value: number; max: number };
  autonomylevel: number;
  moralitylevel: number;
  legalitylevel: number;
  personalityindex: string;
  details: Partial<Record<string, string>>;
}
