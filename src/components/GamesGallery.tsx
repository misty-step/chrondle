"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Crosshair, Shuffle, GripHorizontal, Crown } from "lucide-react";

import { setModePreferenceCookie, type ModeKey } from "@/lib/modePreference";
import { cn } from "@/lib/utils";

// --- Configuration ---

type ModeCardConfig = {
  key: ModeKey;
  title: string;
  subtitle: string;
  description: string;
  route: string;
  icon: React.ElementType;
  theme: {
    bg: string;
    fg: string;
    accent: string;
    texture: string;
  };
  badge?: string;
};

const MODE_CARDS: ModeCardConfig[] = [
  {
    key: "classic",
    title: "Classic",
    subtitle: "The Daily Time-Travel Puzzle",
    description:
      "From ancient empires to pop culture icons. Follow the trail of six clues to lock in the exact year.",
    route: "/classic",
    icon: Crosshair,
    theme: {
      bg: "bg-[#EBE7DE]", // Warm parchment
      fg: "text-[#3E3428]", // Darker brown for better contrast
      accent: "text-[#B8360B]", // Vermilion
      texture: "bg-noise-pattern",
    },
  },
  {
    key: "order",
    title: "Order",
    subtitle: "Restore the Timeline",
    description:
      "Six events are out of place. Drag them back into order to reveal the hidden connections between them.",
    route: "/order",
    icon: Shuffle,
    theme: {
      bg: "bg-[#E3E8EC]", // Cool slate paper
      fg: "text-[#2C3E50]", // Navy
      accent: "text-[#2563EB]", // Royal Blue
      texture: "opacity-40",
    },
    badge: "New",
  },
];

// --- Components ---

export function GamesGallery() {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState<ModeKey | null>("classic");

  const handleSelect = useCallback(
    (mode: ModeKey, route: string) => {
      setModePreferenceCookie(mode);
      router.push(route);
    },
    [router],
  );

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-stone-950 md:flex-row">
      {/* --- Branding Anchor --- */}
      <div className="pointer-events-none absolute top-6 right-0 left-0 z-50 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-5 py-2 shadow-2xl backdrop-blur-md">
          <Crown className="h-4 w-4 text-white/80" />
          <span className="font-heading text-lg font-bold tracking-wide text-white/90">
            CHRONDLE
          </span>
        </div>
      </div>

      {/* Global decorative grain/noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-50 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {MODE_CARDS.map((mode) => {
        const isActive = activeKey === mode.key;
        const Icon = mode.icon;

        return (
          <motion.div
            key={mode.key}
            layout
            initial={false}
            animate={{
              flex: isActive ? 2.5 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 150,
              damping: 25,
              mass: 1.2,
            }}
            onClick={() => setActiveKey(mode.key)}
            onHoverStart={() => setActiveKey(mode.key)}
            className={cn(
              "group relative flex min-h-[120px] flex-col overflow-hidden md:h-full",
              isActive ? "cursor-default" : "cursor-pointer",
              mode.theme.bg,
              mode.theme.fg,
            )}
            role="button"
            aria-expanded={isActive}
            aria-label={`Select ${mode.title} mode`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (!isActive) {
                  setActiveKey(mode.key);
                } else {
                  handleSelect(mode.key, mode.route);
                }
              }
            }}
          >
            {/* Dimming Overlay for Inactive State */}
            <motion.div
              animate={{ opacity: isActive ? 0 : 0.4 }}
              className="pointer-events-none absolute inset-0 z-10 bg-black"
              transition={{ duration: 0.4 }}
            />

            {/* Background Texture */}
            <div
              className="pointer-events-none absolute inset-0 mix-blend-multiply transition-opacity duration-500"
              style={{
                opacity: mode.key === "classic" ? 0.07 : 0.1, // Reduced opacity for Classic
                backgroundImage:
                  mode.key === "classic"
                    ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                    : `linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)`,
              }}
            />

            {/* Content Container */}
            <div className="relative z-20 flex h-full w-full flex-col p-8 md:p-12 lg:p-16">
              {/* Top Bar: Icon & Badge */}
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "rounded-full border p-3 transition-colors duration-500",
                    isActive
                      ? "border-black/5 bg-white/50"
                      : "border-transparent bg-transparent opacity-50",
                  )}
                >
                  <Icon className="h-6 w-6 md:h-8 md:w-8" strokeWidth={1.5} />
                </div>

                {mode.badge && (
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase transition-opacity duration-500",
                      mode.key === "classic"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {mode.badge}
                  </span>
                )}
              </div>

              {/* Main Title Area */}
              <div className="flex flex-1 flex-col justify-center">
                <motion.div
                  animate={{
                    scale: isActive ? 1 : 0.9,
                    x: isActive ? 0 : -10,
                    opacity: isActive ? 1 : 0.6,
                  }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="origin-left"
                >
                  <h2 className="font-heading text-5xl leading-none font-medium tracking-tight drop-shadow-sm sm:text-6xl md:text-7xl lg:text-8xl">
                    {mode.title}
                  </h2>
                </motion.div>

                <div className="relative h-0">
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
                        className="absolute top-6 left-0 w-full max-w-lg"
                      >
                        <p
                          className={cn(
                            "mb-3 text-lg font-bold tracking-widest uppercase opacity-80 md:text-xl",
                            mode.theme.accent,
                          )}
                        >
                          {mode.subtitle}
                        </p>
                        <p className="font-serif text-xl leading-relaxed font-medium opacity-90 md:text-2xl">
                          {mode.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Bottom Bar: CTA */}
              <div className="mt-auto flex h-20 items-end justify-between">
                {!isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ duration: 0.5 }}
                    className="hidden md:block"
                  >
                    <GripHorizontal className="h-6 w-6" />
                  </motion.div>
                )}

                <AnimatePresence>
                  {isActive && (
                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: 0.3, duration: 0.4, ease: "backOut" }}
                      whileHover={{ scale: 1.05, x: 5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(mode.key, mode.route);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-full px-8 py-4 text-lg font-semibold shadow-xl transition-all duration-300",
                        // Button pulsates/highlights slightly when hovering anywhere on the parent panel
                        "group-hover:scale-105 group-hover:shadow-2xl",
                        mode.key === "classic"
                          ? "bg-[#3E3428] text-[#EBE7DE] hover:bg-[#2C2620]"
                          : "bg-[#2C3E50] text-[#E3E8EC] hover:bg-[#1A2634]",
                      )}
                    >
                      <span>Play Now</span>
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        );
      })}
    </main>
  );
}
