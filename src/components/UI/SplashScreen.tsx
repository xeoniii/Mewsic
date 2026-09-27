import React, { useState, useEffect } from "react";
import { Music2 } from "lucide-react";
import { useStore } from "../../store";

export function SplashScreen() {
  const showSplashScreen = useStore((s) => s.showSplashScreen);
  const setShowSplashScreen = useStore((s) => s.setShowSplashScreen);

  // Smooth, continuous timeline: "init" -> "slide" (40ms) -> "exit" (1550ms) -> "done" (2100ms)
  const [stage, setStage] = useState<"init" | "slide" | "exit" | "done">("init");

  useEffect(() => {
    if (!showSplashScreen) {
      setStage("done");
      return;
    }

    setStage("init");

    // Start slide immediately on next frame so there is no freeze or stuck pause
    const tSlide = setTimeout(() => {
      setStage("slide");
    }, 40);

    // After slide finishes and briefly holds at full glory, dissolve smoothly into the app
    const tExit = setTimeout(() => {
      setStage("exit");
    }, 1550);

    // Complete transition and unmount
    const tDone = setTimeout(() => {
      setShowSplashScreen(false);
      setStage("done");
    }, 2100);

    // Keyboard listener to skip on Escape, Space, or Enter
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        setShowSplashScreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      clearTimeout(tSlide);
      clearTimeout(tExit);
      clearTimeout(tDone);
      window.removeEventListener("keydown", handleKey);
    };
  }, [showSplashScreen, setShowSplashScreen]);

  if (!showSplashScreen || stage === "done") return null;

  const isSlide = stage === "slide" || stage === "exit";
  const isExit = stage === "exit";

  // Refined speed: 1050ms (a tiny bit faster than 1400ms, silky smooth ease-out)
  const slideDuration = "1050ms";
  const slideCurve = "cubic-bezier(0.18, 0.9, 0.28, 1)";

  return (
    <div
      onClick={() => setShowSplashScreen(false)}
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none cursor-pointer"
      style={{
        backgroundColor: "rgba(7, 9, 13, 0.68)",
        backgroundImage: "radial-gradient(circle at center, rgba(16, 22, 34, 0.5) 0%, rgba(7, 9, 13, 0.8) 100%)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        opacity: isExit ? 0 : 1,
        transform: isExit ? "scale(1.02)" : "scale(1)",
        pointerEvents: isExit ? "none" : "auto",
        transition: "opacity 550ms cubic-bezier(0.4, 0, 0.2, 1), transform 550ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Ambient background glow orb */}
      <div
        className="absolute w-80 h-80 rounded-full pointer-events-none blur-3xl"
        style={{
          background: "var(--accent-glow, rgba(27, 217, 106, 0.22))",
          opacity: isSlide ? 0.45 : 0.15,
          transform: isSlide ? "scale(1.25)" : "scale(0.85)",
          transition: `opacity ${slideDuration} ${slideCurve}, transform ${slideDuration} ${slideCurve}`,
        }}
      />

      {/* Main Brand Composition Container */}
      <div className="relative z-10 flex items-center justify-center">
        {/* The Mewsic Logo Badge */}
        <div
          className="flex items-center justify-center rounded-2xl bg-accent flex-shrink-0"
          style={{
            width: "60px",
            height: "60px",
            transform: isSlide ? "translateX(-14px)" : "translateX(0px)",
            boxShadow: isSlide
              ? "0 0 32px var(--accent-glow), 0 0 12px var(--accent)"
              : "0 0 16px var(--accent-glow)",
            transition: `transform ${slideDuration} ${slideCurve}, box-shadow ${slideDuration} ${slideCurve}`,
          }}
        >
          <Music2 size={32} color="#000" strokeWidth={2.6} className="drop-shadow-sm" />
        </div>

        {/* Overflow Container for the Word "Mewsic" Sliding Right */}
        <div
          className="overflow-hidden flex flex-col justify-center"
          style={{
            maxWidth: isSlide ? "320px" : "0px",
            opacity: isSlide ? 1 : 0,
            paddingLeft: isSlide ? "16px" : "0px",
            transition: `max-width ${slideDuration} ${slideCurve}, opacity ${slideDuration} ${slideCurve}, padding-left ${slideDuration} ${slideCurve}`,
          }}
        >
          <div
            className="flex items-baseline whitespace-nowrap"
            style={{
              transform: isSlide ? "translateX(0px)" : "translateX(-42px)",
              opacity: isSlide ? 1 : 0,
              transition: `transform ${slideDuration} ${slideCurve}, opacity ${slideDuration} ${slideCurve}`,
            }}
          >
            <span className="font-display font-black text-4xl md:text-5xl tracking-tight text-white leading-none">
              Mewsic
            </span>
          </div>
        </div>
      </div>

      {/* Animated Light Sweep Underline */}
      <div
        className="relative mt-8 h-[2px] rounded-full overflow-hidden bg-white/10"
        style={{
          width: isSlide ? "240px" : "28px",
          opacity: isSlide ? 0.9 : 0,
          transition: `width ${slideDuration} ${slideCurve}, opacity ${slideDuration} ${slideCurve}`,
        }}
      >
        <div
          className="absolute top-0 bottom-0 bg-accent"
          style={{
            left: 0,
            width: isSlide ? "100%" : "0%",
            boxShadow: isSlide ? "0 0 12px var(--accent-glow)" : "none",
            transition: `width ${slideDuration} ${slideCurve}, box-shadow ${slideDuration} ${slideCurve}`,
          }}
        />
      </div>
    </div>
  );
}
