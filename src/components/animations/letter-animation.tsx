"use client";

import { motion } from "framer-motion";
import { Fragment } from "react";

interface LetterAnimationProps {
  text: string;
  className?: string;
  delay?: number;
}

export function LetterAnimation({ text, className, delay = 0 }: LetterAnimationProps) {
  const words = text.split(" ");

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: delay,
      },
    },
  };

  const child = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 200,
      },
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      className={className}
      aria-label={text}
    >
      {/* Each word is a no-wrap inline-block, so a line can only break at the
          space between words. The letters are still variant children of the
          container, so the stagger runs across the words in order. */}
      {words.map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          {wordIndex > 0 && " "}
          <span className="inline-block whitespace-nowrap">
            {word.split("").map((letter, index) => (
              <motion.span
                key={index}
                variants={child}
                className="inline-block"
                aria-hidden="true"
              >
                {letter}
              </motion.span>
            ))}
          </span>
        </Fragment>
      ))}
    </motion.span>
  );
}