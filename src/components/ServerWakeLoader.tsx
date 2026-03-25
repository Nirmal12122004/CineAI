import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MOVIE_FACTS = [
  { emoji: "🎬", fact: "The first movie ever made was just 2 seconds long — a horse galloping, filmed in 1878." },
  { emoji: "🍿", fact: "Movie popcorn became popular during the Great Depression because it was one of the few affordable luxuries." },
  { emoji: "🎭", fact: "The Wilhelm Scream — recorded in 1951 — has been used in over 400 films including Star Wars and Indiana Jones." },
  { emoji: "🎥", fact: "Titanic (1997) cost more to make than the actual Titanic ship did to build, adjusted for inflation." },
  { emoji: "🏆", fact: "The most Oscars ever won by a single film is 11 — shared by Ben-Hur, Titanic, and Lord of the Rings: Return of the King." },
  { emoji: "🎞️", fact: "A standard movie runs at 24 frames per second. Your brain fills in the gaps to create the illusion of motion." },
  { emoji: "🌍", fact: "India's Bollywood produces more films per year than Hollywood — over 1,800 films annually." },
  { emoji: "🎵", fact: "The iconic Jaws theme is just two notes. Composer John Williams played it as a joke — Spielberg loved it instantly." },
  { emoji: "👁️", fact: "The Matrix's green code is actually sushi recipes — the VFX designer scanned his wife's Japanese cookbooks." },
  { emoji: "🦁", fact: "The MGM lion roar heard at the start of films is trademarked. There have been 7 different lions used since 1924." },
  { emoji: "🎪", fact: "The word 'director' in early Hollywood meant the person who literally pointed at actors and said 'go there'." },
  { emoji: "💡", fact: "Interstellar's black hole visuals were so scientifically accurate they led to a published astrophysics paper." },
  { emoji: "🎟️", fact: "Avatar (2009) remained the highest-grossing film for a decade — earning $2.9 billion worldwide." },
  { emoji: "🔊", fact: "The sound of lightsabers in Star Wars was created by combining a broken TV hum with film projector motor noise." },
  { emoji: "🧠", fact: "Psycho (1960) was the first American film to show a toilet flushing on screen — considered shocking at the time." },
];

// Film reel hole positions around a circle
const REEL_HOLES = Array.from({ length: 8 }, (_, i) => ({
  angle: (i * 360) / 8,
  delay: i * 0.1,
}));

// Film strip frames
const STRIP_FRAMES = Array.from({ length: 6 }, (_, i) => i);

export function ServerWakeLoader({ message = "Warming up the projector…" }: { message?: string }) {
  const [factIndex, setFactIndex] = useState(0);
  const [dots, setDots] = useState(1);

  // Cycle facts every 4 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setFactIndex((i) => (i + 1) % MOVIE_FACTS.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Animate loading dots
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 500);
    return () => clearInterval(t);
  }, []);

  const current = MOVIE_FACTS[factIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-10 py-16 px-4"
    >
      {/* Film Reel */}
      <div className="relative flex items-center justify-center">

        {/* Outer ring glow */}
        <div className="absolute w-36 h-36 rounded-full bg-primary/10 blur-xl animate-pulse" />

        {/* Spinning reel */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="relative w-28 h-28"
        >
          {/* Reel body */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/40 bg-card" />

          {/* Spokes */}
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <div
              key={angle}
              className="absolute top-1/2 left-1/2 w-[44%] h-[2px] bg-primary/30 origin-left"
              style={{ transform: `translateY(-50%) rotate(${angle}deg)` }}
            />
          ))}

          {/* Reel holes around the perimeter */}
          {REEL_HOLES.map(({ angle, delay }, i) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            const r = 36; // radius in px
            const x = 56 + r * Math.cos(rad); // center offset
            const y = 56 + r * Math.sin(rad);
            return (
              <motion.div
                key={i}
                className="absolute w-4 h-4 rounded-full border-2 border-primary/60 bg-background"
                style={{ left: x - 8, top: y - 8 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay }}
              />
            );
          })}

          {/* Center hub */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-primary/60" />
            </div>
          </div>
        </motion.div>

        {/* Film strip — horizontal strip beneath reel */}
        <div className="absolute -bottom-8 flex gap-0.5">
          {STRIP_FRAMES.map((i) => (
            <motion.div
              key={i}
              className="w-6 h-4 border border-primary/30 bg-card/50 rounded-sm overflow-hidden"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
            >
              <div className="w-full h-1 bg-primary/20" />
              <div className="w-full h-2 bg-primary/10" />
              <div className="w-full h-1 bg-primary/20" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Status message */}
      <div className="text-center space-y-1 mt-4">
        <p className="text-sm font-medium text-foreground">
          {message}
          <span className="text-primary">{".".repeat(dots)}</span>
        </p>
        <p className="text-xs text-muted-foreground">This takes about 30–60 seconds on first load</p>
      </div>

      {/* Movie fact card */}
      <div className="w-full max-w-sm">
        <p className="text-[10px] uppercase tracking-widest text-primary/60 text-center mb-3 font-medium">
          🎬 Did you know?
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={factIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-border bg-card/80 backdrop-blur-sm px-5 py-4 text-center shadow-sm"
          >
            <div className="text-3xl mb-2">{current.emoji}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.fact}</p>
          </motion.div>
        </AnimatePresence>

        {/* Fact progress dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {MOVIE_FACTS.map((_, i) => (
            <motion.div
              key={i}
              className="h-1 rounded-full bg-primary/30 transition-all duration-300"
              animate={{ width: i === factIndex ? 16 : 4, opacity: i === factIndex ? 1 : 0.3 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
