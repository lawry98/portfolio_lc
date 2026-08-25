/**
 * Style Lab — dev-only axis controls, gated behind `?lab` (SPEC §7).
 *
 * Two independent axes live here so far:
 *
 * - Type: live switching between the three `data-type` presets `tokens.css`
 *   already defines (`grotesk` / `mono` / `clash`).
 * - Tooltip (added in T7): on/off for `data-tooltip`. Per ruling R7-8, this
 *   module only owns the attribute flip — the runtime behaviour it gates
 *   (showing "still hungry" after 3+ feeds) reads `<html data-tooltip>`
 *   elsewhere.
 *
 * T8 grows this further still (a glow axis, a phrase-set axis, lock/export).
 *
 * Gating: `?lab` absent means production, and `initLab()` does *nothing* —
 * no DOM is created, no listener is attached. `?lab` present renders a
 * small fixed-position panel offering each axis as its own accessible,
 * native radio group (keyboard-operable, labelled, and the checked radio
 * always reflects the active value for free — no extra ARIA bookkeeping
 * needed).
 *
 * Selecting an option just sets the matching `dataset` property on
 * `<html>` (`type` or `tooltip`); e.g. `tokens.css`'s `[data-type]` rules
 * swap `--font-display`/`--font-mono` live via CSS custom properties — no
 * reload, no GSAP, no dependency on gsap/lenis. Each axis's radios reflect
 * whichever value is *currently* active on load (read straight off
 * `<html>`'s dataset — for `type`, the no-flash script in `index.html` has
 * already set it pre-paint) rather than assuming the default.
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
 * Builds the Type fieldset: a labelled `<fieldset>` of 3 radio `<label>`s,
 * the currently-active preset pre-checked. One delegated `change` listener
 * on the fieldset applies the newly-checked preset — no per-radio listener.
 */
function buildTypeFieldset(active: TypePreset): HTMLElement {
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

  return fieldset;
}

/** `On` shows the tooltip; `Off` (the default) suppresses it. */
type TooltipPref = 'on' | 'off';

const TOOLTIP_PRESETS: ReadonlyArray<{ value: TooltipPref; label: string }> = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

/**
 * Unlike `DEFAULT_PRESET`, nothing pre-paints `data-tooltip` — there is no
 * no-flash script for it — so this default is the sole source of truth for
 * "no `data-tooltip` yet" (production, and the panel on first load).
 */
const DEFAULT_TOOLTIP: TooltipPref = 'off';

const TOOLTIP_RADIO_GROUP_NAME = 'lab-tooltip';

function isTooltipPref(value: string | undefined): value is TooltipPref {
  return value === 'on' || value === 'off';
}

/**
 * Reads the preference currently active on `<html data-tooltip>`, falling
 * back to `DEFAULT_TOOLTIP` if it's missing or somehow not one of the two
 * known values — so the panel never renders with nothing selected.
 */
function readActiveTooltip(): TooltipPref {
  const current = document.documentElement.dataset.tooltip;
  return isTooltipPref(current) ? current : DEFAULT_TOOLTIP;
}

/**
 * Applies a preference live — the only thing a selection ever does. Per
 * ruling R7-8, this module only owns the flip; whatever reads
 * `data-tooltip` to decide when to actually show a tooltip lives elsewhere.
 */
function applyTooltip(pref: TooltipPref): void {
  document.documentElement.dataset.tooltip = pref;
}

/**
 * Builds the Tooltip fieldset: a labelled `<fieldset>` of 2 radio
 * `<label>`s (`On` / `Off`), the currently-active preference pre-checked.
 * One delegated `change` listener on the fieldset applies the
 * newly-checked preference — no per-radio listener. Mirrors
 * `buildTypeFieldset` exactly, one axis down.
 */
function buildTooltipFieldset(active: TooltipPref): HTMLElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'lab__group';

  const legend = document.createElement('legend');
  legend.className = 'lab__legend';
  legend.textContent = 'Tooltip';
  fieldset.appendChild(legend);

  for (const preset of TOOLTIP_PRESETS) {
    const label = document.createElement('label');
    label.className = 'lab__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = TOOLTIP_RADIO_GROUP_NAME;
    input.value = preset.value;
    input.className = 'lab__input';
    input.checked = preset.value === active;

    const text = document.createElement('span');
    text.textContent = preset.label;

    label.append(input, text);
    fieldset.appendChild(label);
  }

  fieldset.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && isTooltipPref(target.value)) {
      applyTooltip(target.value);
    }
  });

  return fieldset;
}

/**
 * Builds the panel DOM: one wrapper `<div>` holding both axis fieldsets
 * (Type, then Tooltip), each pre-checked to whichever value is currently
 * active.
 */
function buildPanel(activeType: TypePreset, activeTooltip: TooltipPref): HTMLElement {
  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;
  panel.append(buildTypeFieldset(activeType), buildTooltipFieldset(activeTooltip));
  return panel;
}

/**
 * Boots the Style Lab. Reads `?lab` off the current URL
 * (`new URLSearchParams(window.location.search).has('lab')`); absent means
 * do nothing at all. Present means build the panel (idempotent — a second
 * call is a no-op, mirroring `initGrain()`'s own guard) and append it to
 * `<body>`, pre-selecting whichever values `<html>`'s dataset currently
 * carries for each axis.
 */
export function initLab(): void {
  if (!new URLSearchParams(window.location.search).has('lab')) {
    return;
  }

  if (document.querySelector(`.${PANEL_CLASS}`)) {
    return;
  }

  const panel = buildPanel(readActiveType(), readActiveTooltip());
  document.body.appendChild(panel);
}
