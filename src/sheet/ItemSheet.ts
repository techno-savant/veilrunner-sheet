type AttributeKey = 'strength' | 'agility' | 'endurance' | 'insight' | 'presence' | 'tech';

const ATTRIBUTE_OPTIONS: ReadonlyArray<{ value: AttributeKey; label: string }> = [
  { value: 'strength',  label: 'Strength'  },
  { value: 'agility',   label: 'Agility'   },
  { value: 'endurance', label: 'Endurance' },
  { value: 'insight',   label: 'Insight'   },
  { value: 'presence',  label: 'Presence'  },
  { value: 'tech',      label: 'Tech'      },
];

export class VeilrunnerItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  declare readonly item: FoundryItem;
  declare readonly isEditable: boolean;
  declare readonly element: HTMLElement;
  declare render: (force?: boolean, options?: Record<string, unknown>) => Promise<this>;
  declare close: (options?: Record<string, unknown>) => Promise<this>;

  static DEFAULT_OPTIONS: Record<string, unknown> = {
    classes: ['veilrunner', 'item-sheet'],
    position: { width: 460, height: 380 },
    window: { resizable: true },
    mode: 1,
    actions: {},
  };

  static PARTS: Record<string, { template: string }> = {
    main: { template: 'modules/veilrunner-sheet/templates/item-sheet.hbs' },
  };

  async _prepareContext(_options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const item       = this.item;
    const sys        = item.system as Record<string, unknown>;
    const flags      = item.flags as Record<string, unknown>;
    const vrFlags    = (flags['veilrunner'] as Record<string, unknown> | undefined) ?? {};
    const talentFlag = (vrFlags['talent']   as Record<string, unknown> | undefined) ?? {};

    const attribute = typeof sys['attribute'] === 'string' ? sys['attribute'] : '';
    const attributeLabel = ATTRIBUTE_OPTIONS.find(o => o.value === attribute)?.label ?? attribute;

    return {
      item,
      system:           sys,
      isSkill:          item.type === 'skill',
      isTalent:         item.type === 'talent',
      isGear:           item.type === 'gear' || item.type === 'augmentation',
      attributeOptions: ATTRIBUTE_OPTIONS,
      attribute,
      attributeLabel,
      rank:             typeof sys['rank']              === 'number'  ? sys['rank']              : 0,
      description:      typeof sys['description']       === 'string'  ? sys['description']       : '',
      treeId:           typeof talentFlag['treeId']     === 'string'  ? talentFlag['treeId']     : '',
      treeName:         typeof talentFlag['treeName']   === 'string'  ? talentFlag['treeName']   : '',
      tier:             typeof talentFlag['tier']       === 'number'  ? talentFlag['tier']       : 0,
      unlocked:         talentFlag['unlocked'] === true,
    };
  }

  override _attachPartListeners(
    partId: string,
    htmlElement: HTMLElement,
    options: Record<string, unknown>,
  ): void {
    super._attachPartListeners(partId, htmlElement, options);

    htmlElement.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input[data-field], select[data-field], textarea[data-field]',
    ).forEach((el) => {
      el.addEventListener('change', () => {
        const field = el.dataset['field'];
        if (!field) return;
        const value = el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
          : el instanceof HTMLInputElement && el.type === 'number'
            ? Number(el.value)
            : el.value;
        void this.item.update({ [field]: value });
      });
    });
  }
}
