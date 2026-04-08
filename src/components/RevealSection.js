import React from "react";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";

export default function RevealSection({
  children,
  className = "",
  threshold,
  rootMargin,
  triggerOnce,
}) {
  const { ref, isVisible } = useRevealOnScroll({ threshold, rootMargin, triggerOnce });

  return (
    <section
      ref={ref}
      className={`reveal-enter ${isVisible ? "reveal-visible" : ""} ${className}`.trim()}
    >
      {children}
    </section>
  );
}
