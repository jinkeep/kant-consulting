"use client";
import { motion, useInView, useReducedMotion } from "motion/react";
import * as React from "react";

export function FadeUp({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[Tag as keyof typeof motion] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

export function FadeInView({
  children,
  delay = 0,
  className,
  amount = 0.3,
  disabled = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  amount?: number;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount });
  if (disabled) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ to, duration = 700 }: { to: number; duration?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = React.useState(reduce ? to : 0);
  React.useEffect(() => {
    if (reduce) {
      setV(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduce]);
  return <>{v}</>;
}
