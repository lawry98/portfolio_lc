"use client";

import { useId } from "react";
import {
  motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { signature } from "@/data/signature";

// Finish slightly before progress reaches 1 so the finished signature holds
// for a moment, and still completes if scrolling stops a hair short.
const DRAW_END = 0.92;

// Each stroke's [start, end] share of the whole pen path, weighted by length
// so the pen moves at a constant speed.
const totalLength = signature.strokes.reduce((sum, s) => sum + s.length, 0);
const strokes = signature.strokes.reduce<
  { d: string; start: number; end: number }[]
>((acc, s) => {
  const start = acc.length ? acc[acc.length - 1].end : 0;
  return [...acc, { d: s.d, start, end: start + (s.length / totalLength) * DRAW_END }];
}, []);

function PenStroke({
  d,
  start,
  end,
  progress,
}: {
  d: string;
  start: number;
  end: number;
  progress: MotionValue<number>;
}) {
  const pathLength = useTransform(progress, [start, end], [0, 1]);
  // A zero-length stroke with a round cap still paints a dot, so hide it
  // until the pen reaches it.
  const opacity = useTransform(progress, (p) => (p > start ? 1 : 0));
  return <motion.path d={d} style={{ pathLength, opacity }} />;
}

interface SignatureProps {
  /** 0 = unsigned, 1 = fully signed. Drive it from scroll for a scrubbed draw. */
  progress: MotionValue<number>;
  className?: string;
}

/**
 * "Lawrence" in Lastoria, revealed along pen-order centrelines so it reads as
 * one hand-drawn stroke. Decorative: hidden from assistive tech.
 */
export function Signature({ progress, className }: SignatureProps) {
  const maskId = `signature-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // A little inertia so the ink trails the input like a pen, not a wipe.
  const pen = useSpring(progress, { stiffness: 140, damping: 30, restDelta: 0.0005 });

  return (
    <svg
      viewBox={`0 0 ${signature.width} ${signature.height}`}
      className={className}
      aria-hidden="true"
    >
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={signature.width}
        height={signature.height}
      >
        <g
          fill="none"
          stroke="white"
          strokeWidth={signature.maskWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {strokes.map((s) => (
            <PenStroke key={s.d} {...s} progress={pen} />
          ))}
        </g>
      </mask>
      {/* CSS `mask: none` beats the attribute, so reduced motion gets the
          finished signature with no JS (and no hydration mismatch). */}
      <path
        d={signature.fill}
        fill="currentColor"
        mask={`url(#${maskId})`}
        className="motion-reduce:[mask:none]"
      />
    </svg>
  );
}
