/**
 * Runtime film-grain overlay — SPEC §8.7 "global garnish".
 *
 * Builds a small random-noise tile once (an in-memory canvas → data URL, no
 * network request or shipped asset) and paints it as the tiled background of
 * a fixed, full-viewport, `pointer-events:none` overlay appended above all
 * other page content. Positioning, opacity (per `[data-theme]`), and the
 * stepped flicker animation all live in `grain.css`; this module only owns
 * creating the overlay element and generating its background image, once.
 */

const TILE_SIZE = 128;
const OVERLAY_CLASS = 'grain';

/**
 * Renders a `TILE_SIZE`×`TILE_SIZE` tile of random black-or-white pixels,
 * each with an independent random alpha, and returns it as a PNG data URL.
 * Mixing both black and white specks (rather than one fixed colour) keeps
 * the same tile visible — but still subtle — against both light and dark
 * `--paper`, since `grain.css` caps the overlay's own opacity per theme.
 *
 * Returns `null` if a 2D canvas context isn't available, so callers can
 * degrade gracefully instead of throwing (SPEC §12 graceful degradation).
 */
function buildNoiseTileDataUrl(size: number): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const shade = Math.random() < 0.5 ? 0 : 255;
    data[i] = shade;
    data[i + 1] = shade;
    data[i + 2] = shade;
    data[i + 3] = Math.floor(Math.random() * 255);
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL();
}

/**
 * Creates the grain overlay (idempotent — a second call is a no-op) and
 * appends it as the last child of `<body>`. Cheap and meant to run once,
 * from `main.ts`, at bootstrap.
 */
export function initGrain(): void {
  if (document.querySelector(`.${OVERLAY_CLASS}`)) {
    return;
  }

  const tile = buildNoiseTileDataUrl(TILE_SIZE);
  if (!tile) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.backgroundImage = `url(${tile})`;
  document.body.appendChild(overlay);
}
