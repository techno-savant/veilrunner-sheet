import { registerSettings } from './settings.js';
import { HeroSheet } from './sheet/HeroSheet.js';
import { VeilrunnerItemSheet } from './sheet/ItemSheet.js';

const TEMPLATE_PATHS: ReadonlyArray<string> = [
  'modules/veilrunner-sheet/templates/hero-sheet.hbs',
  'modules/veilrunner-sheet/templates/item-sheet.hbs',
  'modules/veilrunner-sheet/templates/partials/header.hbs',
  'modules/veilrunner-sheet/templates/partials/pi-tracker.hbs',
  'modules/veilrunner-sheet/templates/partials/tab-action.hbs',
  'modules/veilrunner-sheet/templates/partials/tab-talents.hbs',
  'modules/veilrunner-sheet/templates/partials/tab-gear.hbs',
  'modules/veilrunner-sheet/templates/partials/tab-character.hbs',
  'modules/veilrunner-sheet/templates/chat-card.hbs',
];

Hooks.once('init', () => {
  registerSettings();

  Handlebars.registerHelper('eq', (...args: unknown[]) => {
    // Handlebars helpers receive (a, b, options) — compare first two args.
    if (args.length < 2) return false;
    return args[0] === args[1];
  });

  Actors.registerSheet('Veilrunner-System', HeroSheet, {
    types: ['hero'],
    makeDefault: true,
    label: 'Veilrunner Hero Sheet',
  });

  Items.registerSheet('Veilrunner-System', VeilrunnerItemSheet, {
    types: ['skill', 'talent', 'gear', 'augmentation'],
    makeDefault: true,
    label: 'Veilrunner Item Sheet',
  });

  void loadTemplates(TEMPLATE_PATHS.slice());
});
