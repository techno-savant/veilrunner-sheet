export interface RollDialogResult {
  modifier: number;
  situational: number;
  dc: number | null;
}

const DIALOG_TEMPLATE = (label: string, prefillModifier: number): string => `
  <form class="veilrunner-roll-dialog">
    <div class="form-group">
      <label>Check</label>
      <div class="readonly-label">${escapeHtml(label)}</div>
    </div>
    <div class="form-group">
      <label for="vr-modifier">Modifier</label>
      <input id="vr-modifier" name="modifier" type="number" value="${prefillModifier}" step="1" />
    </div>
    <div class="form-group">
      <label for="vr-situational">+/− Situational</label>
      <input id="vr-situational" name="situational" type="number" value="0" step="1" />
    </div>
    <div class="form-group">
      <label for="vr-dc">Target DC (optional)</label>
      <input id="vr-dc" name="dc" type="number" placeholder="" step="1" />
    </div>
  </form>
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readNumber(form: HTMLFormElement, name: string): number {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) {
    const parsed = Number(el.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readOptionalNumber(form: HTMLFormElement, name: string): number | null {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) {
    if (el.value.trim() === '') return null;
    const parsed = Number(el.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function openRollDialog(
  label: string,
  prefillModifier: number
): Promise<RollDialogResult | null> {
  try {
    const raw = await Dialog.prompt({
      title: `Roll: ${label}`,
      content: DIALOG_TEMPLATE(label, prefillModifier),
      label: 'Roll',
      rejectClose: false,
      callback: (htmlArg: unknown): RollDialogResult => {
        // Foundry's Dialog passes either an HTMLElement, a jQuery-like object, or null.
        const root = resolveRoot(htmlArg);
        const form = root?.querySelector('form');
        if (!(form instanceof HTMLFormElement)) {
          return { modifier: prefillModifier, situational: 0, dc: null };
        }
        return {
          modifier: readNumber(form, 'modifier'),
          situational: readNumber(form, 'situational'),
          dc: readOptionalNumber(form, 'dc'),
        };
      },
    });
    if (raw && typeof raw === 'object' && 'modifier' in raw && 'situational' in raw && 'dc' in raw) {
      return raw as RollDialogResult;
    }
    return null;
  } catch (_err) {
    // User dismissed the dialog — that's not an error condition, it's a "no roll".
    return null;
  }
}

function resolveRoot(htmlArg: unknown): ParentNode | null {
  if (htmlArg instanceof HTMLElement) return htmlArg;
  if (htmlArg && typeof htmlArg === 'object' && '0' in (htmlArg as Record<string, unknown>)) {
    const first = (htmlArg as Record<string, unknown>)['0'];
    if (first instanceof HTMLElement) return first;
  }
  return null;
}
