/**
 * Style Lab — dev-only axis controls, gated behind `?lab` (SPEC §7).
 *
 * Four independent axes live here, plus a "copy locked config" action:
 *
 * - Type: live switching between the three `data-type` presets `tokens.css`
 *   already defines (`grotesk` / `mono` / `clash`).
 * - Tooltip (added in T7): on/off for `data-tooltip`. Per ruling R7-8, this
 *   module only owns the attribute flip — the runtime behaviour it gates
 *   (showing "still hungry" after 3+ feeds) reads `<html data-tooltip>`
 *   elsewhere.
 * - Glow: 4-way `data-glow` swatch (`mint` / `amber` / `white` / `cyan`)
 *   over the tokens `tokens.css` already defines.
 * - Phrase-set: 3-way `data-phrase-set` (`identity` / `punchy` /
 *   `combined`). Same R7-8 split as Tooltip — this module only owns the
 *   flip; wiring it to which phrases Byte actually types is a follow-up
 *   task, not this one.
 *
 * "Copy locked config" reads all four axes off `<html>`'s dataset into one
 * plain object, logs it, and best-effort copies its JSON to the clipboard —
 * a quick way to hand off a fixed combination of the above.
 *
 * Gating: `?lab` absent means production, and `initLab()` does *nothing* —
 * no DOM is created, no listener is attached. `?lab` present renders a
 * small fixed-position panel offering each axis as its own accessible,
 * native radio group (keyboard-operable, labelled, and the checked radio
 * always reflects the active value for free — no extra ARIA bookkeeping
 * needed).
 *
 * Selecting an option just sets the matching `dataset` property on
 * `<html>` (`type`, `tooltip`, `glow`, or `phraseSet`); e.g. `tokens.css`'s
 * `[data-type]`/`[data-glow]` rules swap CSS custom properties live — no
 * reload, no GSAP, no dependency on gsap/lenis. Each axis's radios reflect
 * whichever value is *currently* active on load (read straight off
 * `<html>`'s dataset — for `type` and `glow`, the no-flash script in
 * `index.html` has already set them pre-paint) rather than assuming the
 * default.
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
const TYPE_RADIO_GROUP_NAME = 'lab-type';

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
    input.name = TYPE_RADIO_GROUP_NAME;
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

/** Drives Byte's emissive + halo accent, independent of theme. */
type GlowPreset = 'mint' | 'amber' | 'white' | 'cyan';

const GLOW_PRESETS: ReadonlyArray<{ value: GlowPreset; label: string }> = [
  { value: 'mint', label: 'Mint' },
  { value: 'amber', label: 'Amber' },
  { value: 'white', label: 'White' },
  { value: 'cyan', label: 'Cyan' },
];

/** Mirrors the no-flash script's own default in `index.html`. */
const DEFAULT_GLOW: GlowPreset = 'mint';

const GLOW_RADIO_GROUP_NAME = 'lab-glow';

function isGlowPreset(value: string | undefined): value is GlowPreset {
  return value === 'mint' || value === 'amber' || value === 'white' || value === 'cyan';
}

/**
 * Reads the preset currently active on `<html data-glow>`, falling back to
 * `DEFAULT_GLOW` if it's missing or somehow not one of the four known
 * values — so the panel never renders with nothing selected.
 */
function readActiveGlow(): GlowPreset {
  const current = document.documentElement.dataset.glow;
  return isGlowPreset(current) ? current : DEFAULT_GLOW;
}

/** Applies a preset live — the only thing a selection ever does. */
function applyGlow(preset: GlowPreset): void {
  document.documentElement.dataset.glow = preset;
}

/**
 * Builds the Glow fieldset: a labelled `<fieldset>` of 4 radio `<label>`s,
 * the currently-active preset pre-checked. One delegated `change` listener
 * on the fieldset applies the newly-checked preset — no per-radio listener.
 * Mirrors `buildTypeFieldset` exactly, one axis down.
 */
function buildGlowFieldset(active: GlowPreset): HTMLElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'lab__group';

  const legend = document.createElement('legend');
  legend.className = 'lab__legend';
  legend.textContent = 'Glow';
  fieldset.appendChild(legend);

  for (const preset of GLOW_PRESETS) {
    const label = document.createElement('label');
    label.className = 'lab__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = GLOW_RADIO_GROUP_NAME;
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
    if (target instanceof HTMLInputElement && isGlowPreset(target.value)) {
      applyGlow(target.value);
    }
  });

  return fieldset;
}

/** Which set of phrases Byte's retype cycle draws from. */
type PhraseSet = 'identity' | 'punchy' | 'combined';

const PHRASE_SET_PRESETS: ReadonlyArray<{ value: PhraseSet; label: string }> = [
  { value: 'identity', label: 'Identity' },
  { value: 'punchy', label: 'Punchy' },
  { value: 'combined', label: 'Combined' },
];

/**
 * Unlike `DEFAULT_GLOW`, nothing pre-paints `data-phrase-set` — there is no
 * no-flash script for it — so this default is the sole source of truth for
 * "no `data-phrase-set` yet" (production, and the panel on first load).
 */
const DEFAULT_PHRASE_SET: PhraseSet = 'identity';

const PHRASE_SET_RADIO_GROUP_NAME = 'lab-phrase-set';

function isPhraseSet(value: string | undefined): value is PhraseSet {
  return value === 'identity' || value === 'punchy' || value === 'combined';
}

/**
 * Reads the preference currently active on `<html data-phrase-set>`,
 * falling back to `DEFAULT_PHRASE_SET` if it's missing or somehow not one
 * of the three known values — so the panel never renders with nothing
 * selected.
 */
function readActivePhraseSet(): PhraseSet {
  const current = document.documentElement.dataset.phraseSet;
  return isPhraseSet(current) ? current : DEFAULT_PHRASE_SET;
}

/**
 * Applies a preference live — the only thing a selection ever does. Per
 * ruling R7-8, this module only owns the flip; whatever reads
 * `data-phrase-set` to decide which phrases Byte actually types lives
 * elsewhere.
 */
function applyPhraseSet(pref: PhraseSet): void {
  document.documentElement.dataset.phraseSet = pref;
}

/**
 * Builds the Phrase-set fieldset: a labelled `<fieldset>` of 3 radio
 * `<label>`s (`Identity` / `Punchy` / `Combined`), the currently-active
 * preference pre-checked. One delegated `change` listener on the fieldset
 * applies the newly-checked preference — no per-radio listener. Mirrors
 * `buildTypeFieldset` exactly, one axis down.
 */
function buildPhraseSetFieldset(active: PhraseSet): HTMLElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'lab__group';

  const legend = document.createElement('legend');
  legend.className = 'lab__legend';
  legend.textContent = 'Phrase-set';
  fieldset.appendChild(legend);

  for (const preset of PHRASE_SET_PRESETS) {
    const label = document.createElement('label');
    label.className = 'lab__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = PHRASE_SET_RADIO_GROUP_NAME;
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
    if (target instanceof HTMLInputElement && isPhraseSet(target.value)) {
      applyPhraseSet(target.value);
    }
  });

  return fieldset;
}

/** The full snapshot "copy locked config" reads off `<html>`'s dataset. */
interface LockedConfig {
  type: TypePreset;
  glow: GlowPreset;
  phraseSet: PhraseSet;
  tooltip: TooltipPref;
}

/**
 * Snapshots all four axes, each already falling back to its own default
 * when the matching `data-*` attribute is missing/invalid — the same
 * `readActive*` helpers each fieldset uses to pre-check a radio.
 */
function readLockedConfig(): LockedConfig {
  return {
    type: readActiveType(),
    glow: readActiveGlow(),
    phraseSet: readActivePhraseSet(),
    tooltip: readActiveTooltip(),
  };
}

const COPY_BUTTON_LABEL = 'Copy locked config';
const COPY_BUTTON_FEEDBACK_LABEL = 'Copied ✓';
const COPY_BUTTON_FEEDBACK_MS = 1500;

/**
 * Best-effort copies `text` to the clipboard. Guarded on both the
 * synchronous call (some environments throw immediately if the API is
 * blocked) and the returned promise (permission can still be denied async)
 * — this must never throw or reject visibly; the caller already has its own
 * fallback (the console.log in `buildCopyConfigButton`).
 */
function copyToClipboardBestEffort(text: string): void {
  try {
    navigator.clipboard?.writeText(text).catch(() => {
      // Unavailable or denied — best-effort only.
    });
  } catch {
    // Same as above — never let a clipboard failure break the button.
  }
}

/**
 * Builds the "copy locked config" button. A click snapshots the four axes
 * (`readLockedConfig`), logs the result, and best-effort copies its JSON to
 * the clipboard, then gives brief visual feedback by swapping the label to
 * "Copied ✓" and restoring it shortly after. Dev-only, like the rest of the
 * panel — never rendered outside `?lab`.
 */
function buildCopyConfigButton(): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lab__button';
  button.textContent = COPY_BUTTON_LABEL;

  button.addEventListener('click', () => {
    const config = readLockedConfig();
    console.log('[byte] locked config', config);
    copyToClipboardBestEffort(JSON.stringify(config, null, 2));

    button.textContent = COPY_BUTTON_FEEDBACK_LABEL;
    setTimeout(() => {
      button.textContent = COPY_BUTTON_LABEL;
    }, COPY_BUTTON_FEEDBACK_MS);
  });

  return button;
}

/**
 * Builds the panel DOM: one wrapper `<div>` holding all four axis
 * fieldsets (Type, Tooltip, Glow, Phrase-set) plus the copy-locked-config
 * button, each fieldset pre-checked to whichever value is currently active.
 */
function buildPanel(
  activeType: TypePreset,
  activeTooltip: TooltipPref,
  activeGlow: GlowPreset,
  activePhraseSet: PhraseSet,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;
  panel.append(
    buildTypeFieldset(activeType),
    buildTooltipFieldset(activeTooltip),
    buildGlowFieldset(activeGlow),
    buildPhraseSetFieldset(activePhraseSet),
    buildCopyConfigButton(),
  );
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

  const panel = buildPanel(
    readActiveType(),
    readActiveTooltip(),
    readActiveGlow(),
    readActivePhraseSet(),
  );
  document.body.appendChild(panel);
}
