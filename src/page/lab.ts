/**
 * Style Lab — typography axis control, gated behind `?lab` (SPEC §7).
 *
 * This is the first Style-Lab axis: live switching between the three
 * `data-type` presets `tokens.css` already defines (`grotesk` / `mono` /
 * `clash`). It grows in T7 (a tooltip) and T8 (the glow axis, phrase-set
 * axis, lock/export) — this ticket is the type axis only.
 *
 * Gating: `?lab` absent means production, and `initLab()` does *nothing* —
 * no DOM is created, no listener is attached. `?lab` present renders a
 * small fixed-position panel offering the three presets as an accessible,
 * native radio group (keyboard-operable, labelled, and the checked radio
 * always reflects the active preset for free — no extra ARIA bookkeeping
 * needed).
 *
 * Selecting a preset just sets `document.documentElement.dataset.type`;
 * `tokens.css`'s `[data-type]` rules swap `--font-display`/`--font-mono`
 * live via CSS custom properties — no reload, no GSAP, no dependency on
 * gsap/lenis. The panel reflects whichever preset is *currently* active on
 * load (read straight off `<html data-type>`, which the no-flash script in
 * `index.html` has already set pre-paint) rather than assuming the default.
 */

type TypePreset = 'grotesk' | 'mono' | 'clash';

const TYPE_PRESETS: ReadonlyArray<{ value: TypePreset; label: string }> = [
  { value: 'grotesk', label: 'Grotesk' },
  { value: 'mono', label: 'Mono' },
  { value: 'clash', label: 'Clash' },
];

/** Mirrors the no-flash script's own default in `index.html`. */
const DEFAULT_PRESET: TypePreset = 'grotesk';

const PANEL_CLASS = 'lab';
const RADIO_GROUP_NAME = 'lab-type';

function isTypePreset(value: string | undefined): value is TypePreset {
  return value === 'grotesk' || value === 'mono' || value === 'clash';
}

/**
 * Reads the preset currently active on `<html data-type>`, falling back to
 * `DEFAULT_PRESET` if it's missing or somehow not one of the three known
 * values — so the panel never renders with nothing selected.
 */
function readActiveType(): TypePreset {
  const current = document.documentElement.dataset.type;
  return isTypePreset(current) ? current : DEFAULT_PRESET;
}

/** Applies a preset live — the only thing a selection ever does. */
function applyType(preset: TypePreset): void {
  document.documentElement.dataset.type = preset;
}

/**
 * Builds the panel DOM: a labelled `<fieldset>` of 3 radio `<label>`s, the
 * currently-active preset pre-checked. One delegated `change` listener on
 * the fieldset applies the newly-checked preset — no per-radio listener.
 */
function buildPanel(active: TypePreset): HTMLElement {
  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'lab__group';

  const legend = document.createElement('legend');
  legend.className = 'lab__legend';
  legend.textContent = 'Type';
  fieldset.appendChild(legend);

  for (const preset of TYPE_PRESETS) {
    const label = document.createElement('label');
    label.className = 'lab__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = RADIO_GROUP_NAME;
    input.value = preset.value;
    input.className = 'lab__input';
    input.checked = preset.value === active;

    const text = document.createElement('span');
    text.className = 'lab__option-label';
    text.textContent = preset.label;

    label.append(input, text);
    fieldset.appendChild(label);
  }

  fieldset.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && isTypePreset(target.value)) {
      applyType(target.value);
    }
  });

  panel.appendChild(fieldset);
  return panel;
}

/**
 * Boots the Style Lab. Reads `?lab` off the current URL
 * (`new URLSearchParams(window.location.search).has('lab')`); absent means
 * do nothing at all. Present means build the panel (idempotent — a second
 * call is a no-op, mirroring `initGrain()`'s own guard) and append it to
 * `<body>`, pre-selecting whichever preset `<html data-type>` currently
 * carries.
 */
export function initLab(): void {
  if (!new URLSearchParams(window.location.search).has('lab')) {
    return;
  }

  if (document.querySelector(`.${PANEL_CLASS}`)) {
    return;
  }

  const panel = buildPanel(readActiveType());
  document.body.appendChild(panel);
}
