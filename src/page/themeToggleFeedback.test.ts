import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RING_POP_MS, SPARK_MS, startToggleCharge } from './themeToggleFeedback';

interface FakeAnimation {
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  options: KeyframeAnimationOptions;
  target: Element;
  cancel: ReturnType<typeof vi.fn>;
  finish: () => void;
  finished: Promise<void>;
}

// jsdom has no `Element.animate`; the DOM lib types it as always present, so
// stub it with `Object.defineProperty` and drop it with `Reflect.deleteProperty`
// (same reason as lib/themeReveal.test.ts). Each fake finishes on demand.
let animations: FakeAnimation[] = [];

function stubAnimate(): void {
  animations = [];
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(this: Element, keyframes: FakeAnimation['keyframes'], options: KeyframeAnimationOptions) {
      let finish = (): void => {};
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const a: FakeAnimation = {
        keyframes,
        options,
        target: this,
        cancel: vi.fn(),
        finish,
        finished,
      };
      animations.push(a);
      return a;
    },
  });
}

function makeButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.getBoundingClientRect = () => new DOMRect(300, 10, 44, 44);
  document.body.append(button);
  return button;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate');
});

describe('startToggleCharge', () => {
  it('without WAAPI: a no-op handle that adds nothing', () => {
    const button = makeButton();
    const charge = startToggleCharge(button, { leadMs: 630, target: { x: 100, y: 500 } });
    expect(() => {
      charge.flip();
      charge.cancel();
    }).not.toThrow();
    expect(button.querySelector('svg')).toBeNull();
    expect(document.querySelector('.theme-spark')).toBeNull();
  });

  it('fills the ring around the button over the lead time', () => {
    stubAnimate();
    const button = makeButton();

    startToggleCharge(button, { leadMs: 1230, target: null });

    expect(button.classList.contains('is-charging')).toBe(true);
    const fill = animations.find((a) => a.target.tagName.toLowerCase() === 'circle');
    expect(fill).toBeDefined();
    expect(fill?.options.duration).toBe(1230);
    expect(fill?.options.fill).toBe('forwards');
    const offsets = (fill?.keyframes as Keyframe[]).map((k) => k.strokeDashoffset);
    expect(offsets[offsets.length - 1]).toBe(0);
  });

  it('reuses one ring across switches', () => {
    stubAnimate();
    const button = makeButton();
    startToggleCharge(button, { leadMs: 630, target: null }).cancel();
    startToggleCharge(button, { leadMs: 630, target: null });
    expect(button.querySelectorAll('svg')).toHaveLength(1);
  });

  it('sends a spark from the button to the target, then removes it', async () => {
    stubAnimate();
    const button = makeButton();

    startToggleCharge(button, { leadMs: 630, target: { x: 100, y: 500 } });

    const spark = document.querySelector<HTMLElement>('.theme-spark');
    expect(spark).not.toBeNull();
    const flight = animations.find((a) => a.target === spark);
    expect(flight?.options.duration).toBe(SPARK_MS);
    const frames = flight?.keyframes as Keyframe[];
    expect(frames[0].transform).toMatch(/^translate\(322px, 32px\)/);
    expect(frames[frames.length - 1].transform).toMatch(/^translate\(100px, 500px\)/);

    flight?.finish();
    await flush();
    expect(document.querySelector('.theme-spark')).toBeNull();
  });

  it('no target, no spark', () => {
    stubAnimate();
    startToggleCharge(makeButton(), { leadMs: 630, target: null });
    expect(document.querySelector('.theme-spark')).toBeNull();
  });

  it('flip: stops the fill, pops the ring, and clears the charge when the pop ends', async () => {
    stubAnimate();
    const button = makeButton();
    const charge = startToggleCharge(button, { leadMs: 630, target: null });
    const fill = animations[animations.length - 1];

    charge.flip();

    expect(fill.cancel).toHaveBeenCalled();
    const pop = animations[animations.length - 1];
    expect(pop.target.tagName.toLowerCase()).toBe('svg');
    expect(pop.options.duration).toBe(RING_POP_MS);
    expect(button.classList.contains('is-charging')).toBe(true);

    pop.finish();
    await flush();
    expect(button.classList.contains('is-charging')).toBe(false);
  });

  it('flip twice pops once', () => {
    stubAnimate();
    const charge = startToggleCharge(makeButton(), { leadMs: 630, target: null });
    charge.flip();
    const count = animations.length;
    charge.flip();
    expect(animations).toHaveLength(count);
  });

  it('cancel: clears the ring and the spark at once', () => {
    stubAnimate();
    const button = makeButton();
    const charge = startToggleCharge(button, { leadMs: 630, target: { x: 100, y: 500 } });

    charge.cancel();

    expect(button.classList.contains('is-charging')).toBe(false);
    expect(document.querySelector('.theme-spark')).toBeNull();
    expect(animations.every((a) => a.cancel.mock.calls.length > 0)).toBe(true);
  });
});
