import { useState, useEffect, useRef, useLayoutEffect } from 'react';

interface TooltipTarget {
  text: string;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
}

export function GlobalTooltip() {
  const [target, setTarget] = useState<TooltipTarget | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; visible: boolean }>({
    left: 0,
    top: 0,
    visible: false,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 1. Setup a MutationObserver to globally intercept and convert ALL `title` attributes to `data-tooltip`
  useEffect(() => {
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

    const handleMouseMove = (e: MouseEvent) => {
      const mouseTarget = e.target as HTMLElement;
      if (!mouseTarget || !mouseTarget.closest) return;

      const el = mouseTarget.closest('[data-tooltip]') as HTMLElement;

      if (el) {
        const text = el.getAttribute('data-tooltip');

        if (text) {
          if (currentEl !== el || currentText !== text) {
            currentEl = el;
            currentText = text;

            const r = el.getBoundingClientRect();
            const targetData: TooltipTarget = {
              text,
              rect: {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              },
            };

            if (isVisible) {
              setTarget(targetData);
            } else {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                isVisible = true;
                if (currentEl && currentText) {
                  const latestRect = currentEl.getBoundingClientRect();
                  setTarget({
                    text: currentText,
                    rect: {
                      left: latestRect.left,
                      top: latestRect.top,
                      right: latestRect.right,
                      bottom: latestRect.bottom,
                      width: latestRect.width,
                      height: latestRect.height,
                    },
                  });
                }
              }, 250);
            }
          }
          return;
        }
      }

      clearTimeout(timeout);
      isVisible = false;
      currentEl = null;
      currentText = null;
      setTarget(null);
      setCoords((prev) => ({ ...prev, visible: false }));
    };

    const handleMouseLeave = () => {
      clearTimeout(timeout);
      isVisible = false;
      currentEl = null;
      currentText = null;
      setTarget(null);
      setCoords((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseLeave);
    window.addEventListener('scroll', handleMouseLeave, true);
    window.addEventListener('resize', handleMouseLeave);

    return () => {
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseLeave);
      window.removeEventListener('scroll', handleMouseLeave, true);
      window.removeEventListener('resize', handleMouseLeave);
      clearTimeout(timeout);
    };
  }, []);

  // Compute exact coordinates clamped strictly within all window boundaries
  useLayoutEffect(() => {
    if (!target || !tooltipRef.current) return;

    const el = tooltipRef.current;
    const ttRect = el.getBoundingClientRect();
    const zoomRatio = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom-ratio')) || 1;
    const winW = window.innerWidth / zoomRatio;
    const winH = window.innerHeight / zoomRatio;

    const tLeft = target.rect.left / zoomRatio;
    const tRight = target.rect.right / zoomRatio;
    const tTop = target.rect.top / zoomRatio;
    const tBottom = target.rect.bottom / zoomRatio;
    const centerX = (tLeft + tRight) / 2;

    const ttW = ttRect.width / zoomRatio;
    const ttH = ttRect.height / zoomRatio;

    const PADDING = 8;
    // Strictly clamp horizontally so it never clips past left or right borders
    let left = centerX - ttW / 2;
    left = Math.max(PADDING, Math.min(winW - ttW - PADDING, left));

    // Vertical positioning: Title bar is ~36px tall, clamp so it doesn't clip top or bottom
    const TOP_SAFE_MARGIN = 36;
    let top: number;
    if (tTop - ttH - PADDING >= TOP_SAFE_MARGIN) {
      top = tTop - ttH - PADDING;
    } else if (tBottom + ttH + PADDING <= winH - PADDING) {
      top = tBottom + PADDING;
    } else {
      top = Math.max(TOP_SAFE_MARGIN, Math.min(winH - ttH - PADDING, tTop - ttH - PADDING));
    }

    setCoords({ left, top, visible: true });
  }, [target]);

  if (!target) return null;

  return (
    <div
      ref={tooltipRef}
      key={target.text} // Retrigger animation if text changes
      className="fixed z-[10000] pointer-events-none px-2.5 py-1 bg-surface-overlay border border-border-subtle rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.5)] text-[10px] font-black uppercase tracking-wider text-text-primary whitespace-nowrap max-w-[calc(100vw-24px)] truncate animate-tooltip"
      style={{
        left: coords.left,
        top: coords.top,
        opacity: coords.visible ? 1 : 0,
      }}
    >
      {target.text}
    </div>
  );
}
