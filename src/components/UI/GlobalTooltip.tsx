import React, { useState, useEffect } from 'react';

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    positionAbove: boolean;
  } | null>(null);

  useEffect(() => {
    // 1. Setup a MutationObserver to globally intercept and convert ALL `title` attributes to `data-tooltip`
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.hasAttribute && el.hasAttribute('title')) {
                const text = el.getAttribute('title');
                if (text) {
                  el.setAttribute('data-tooltip', text);
                  el.removeAttribute('title');
                }
              }
              if (el.querySelectorAll) {
                el.querySelectorAll('[title]').forEach((child) => {
                  const text = child.getAttribute('title');
                  if (text) {
                    child.setAttribute('data-tooltip', text);
                    child.removeAttribute('title');
                  }
                });
              }
            }
          });
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
          const el = mutation.target as HTMLElement;
          const text = el.getAttribute('title');
          if (text) {
            el.setAttribute('data-tooltip', text);
            el.removeAttribute('title');
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    // Run once on mount to catch existing ones immediately
    document.querySelectorAll('[title]').forEach((el) => {
      const text = el.getAttribute('title');
      if (text) {
        el.setAttribute('data-tooltip', text);
        el.removeAttribute('title');
      }
    });

    // 2. Handle Mouse Tracking & Element Hover
    let timeout: ReturnType<typeof setTimeout>;
    let currentEl: HTMLElement | null = null;
    let currentText: string | null = null;
    let isVisible = false;

    const computeCoords = (el: HTMLElement) => {
      const zoomRatio = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom-ratio')) || 1;
      const rect = el.getBoundingClientRect();
      const centerX = (rect.left + rect.width / 2) / zoomRatio;
      const topY = rect.top / zoomRatio;
      const bottomY = rect.bottom / zoomRatio;
      const maxW = (window.innerWidth / zoomRatio);

      const positionAbove = rect.top > 45;
      const x = Math.max(24, Math.min(maxW - 24, centerX));
      const y = positionAbove ? topY - 8 : bottomY + 8;

      return { x, y, positionAbove };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !target.closest) return;

      const el = target.closest('[data-tooltip]') as HTMLElement;

      if (el) {
        const text = el.getAttribute('data-tooltip');

        if (text) {
          if (currentEl !== el || currentText !== text) {
            currentEl = el;
            currentText = text;

            if (isVisible) {
              const { x, y, positionAbove } = computeCoords(el);
              setTooltip({ text, x, y, positionAbove });
            } else {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                isVisible = true;
                if (currentEl && currentText) {
                  const { x, y, positionAbove } = computeCoords(currentEl);
                  setTooltip({ text: currentText, x, y, positionAbove });
                }
              }, 250);
            }
          }
        }
      } else {
        clearTimeout(timeout);
        isVisible = false;
        currentEl = null;
        currentText = null;
        setTooltip(null);
      }
    };

    const handleMouseLeave = () => {
      clearTimeout(timeout);
      isVisible = false;
      currentEl = null;
      currentText = null;
      setTooltip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseLeave);
    window.addEventListener('scroll', handleMouseLeave, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseLeave);
      window.removeEventListener('scroll', handleMouseLeave, true);
      clearTimeout(timeout);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      key={tooltip.text} // Retrigger animation if text changes
      className="fixed z-[10000] pointer-events-none px-2.5 py-1 bg-surface-overlay border border-border-subtle rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.5)] text-[10px] font-black uppercase tracking-wider text-text-primary whitespace-nowrap animate-tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: `translate(-50%, ${tooltip.positionAbove ? '-100%' : '0'})`,
      }}
    >
      {tooltip.text}
    </div>
  );
}
