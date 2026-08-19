import type { Variants } from "motion/react";

/** Shared entrance variants for staggered lists (feed, discover, tribe members, etc). */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 32 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};
