import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import type { Movie } from "@/lib/mockData";

type Step = 0 | 1 | 2 | 3 | 4;

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

export default function MoodToMovie() {
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [moodLabel, setMoodLabel] = useState("");
  const [serverReady, setServerReady] = useState(false);
  const [serverWaking, setServerWaking] = useState(true);

  // Wake up Render server on page load
  useEffect(() => {
    const wake = async () => {
      try {
        await fetch(`${BACKEND_URL}/health`, {
          signal: AbortSignal.timeout(60000),
        });
      } catch {}
      finally {
        setServerReady(true);
        setServerWaking(false);
      }
    };
    wake();
  }, []);

  const calculateMood = async (ans: string[]) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/mood-recommend?mood=${ans[0]}&energy=${ans[2]}&genre=${ans[1]}`
      );
      const data = await res.json();

      setMoodLabel("🎯 Perfect picks based on your mood");

      // Map backend response → Movie shape that MovieCard expects
      const mapped: Movie[] = data.movies.map((m: any, i: number) => ({
        id: i + 1,
        title: m.title,
        poster: m.poster || null,
        predicted_rating: m.predicted_rating ?? m.vote_average ?? 3.5,
        genre: m.genre ?? m.genres ?? "Drama",
        year: m.year ?? m.release_date?.slice(0, 4) ?? "",
      }));

      setMovies(mapped);
      setStep(4);
    } catch (err) {
      console.error("Recommendation error:", err);
    }
  };

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (step === 3) {
      calculateMood(newAnswers);
    } else {
      setStep((prev) => (prev + 1) as Step);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers([]);
    setMovies([]);
  };

  const questions = [
    {
      key: "q1",
      label: "How are you feeling?",
      options: [
        { value: "happy", emoji: "😄" },
        { value: "sad", emoji: "😢" },
        { value: "bored", emoji: "😑" },
        { value: "angry", emoji: "😤" },
      ],
    },
    {
      key: "q2",
      label: "What do you want?",
      options: [
        { value: "fun", emoji: "🎉" },
        { value: "emotional", emoji: "💔" },
        { value: "action", emoji: "💥" },
      ],
    },
    {
      key: "q3",
      label: "Preferred vibe?",
      options: [
        { value: "low", emoji: "🌙" },
        { value: "medium", emoji: "🌤️" },
        { value: "high", emoji: "⚡" },
      ],
    },
  ];

  const currentQ = step >= 1 && step <= 3 ? questions[step - 1] : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-10 max-w-5xl mx-auto text-center">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-display text-4xl text-foreground">
            Mood to <span className="text-gradient">Movie</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Tell us how you feel — get perfect movie recommendations
          </p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* Step 0 — Start */}
          {step === 0 && (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 py-6"
            >
              <div className="text-6xl">🎭</div>
              <p className="text-muted-foreground max-w-md mx-auto">
                Answer 3 quick questions and we'll find the perfect movies for your mood right now.
              </p>

              {serverWaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
                >
                  <Loader2 size={13} className="animate-spin text-primary" />
                  <span>Warming up server, almost ready…</span>
                </motion.div>
              )}

              <button
                onClick={() => setStep(1)}
                disabled={serverWaking}
                className="bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-medium text-lg transition flex items-center gap-2 mx-auto"
              >
                <Sparkles size={20} />
                {serverWaking ? "Please wait…" : "Start"}
              </button>
            </motion.div>
          )}

          {/* Steps 1–3 — Questions */}
          {currentQ && (
            <motion.div
              key={currentQ.key}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Step indicator */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 w-10 rounded-full transition-all ${
                      s <= step ? "bg-primary" : "bg-border"
                    }`}
                  />
                ))}
              </div>

              <h2 className="text-xl font-display text-foreground">{currentQ.label}</h2>

              <div className="grid gap-3 max-w-xs mx-auto">
                {currentQ.options.map(({ value, emoji }) => (
                  <motion.button
                    key={value}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleAnswer(value)}
                    className="flex items-center gap-3 w-full rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 px-5 py-3 text-sm font-medium text-foreground transition capitalize"
                  >
                    <span className="text-xl">{emoji}</span>
                    {value}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4 — Loading */}
          {step === 4 && movies.length === 0 && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-20"
            >
              <Loader2 size={36} className="animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Finding your perfect movies…</p>
            </motion.div>
          )}

          {/* Step 4 — Results */}
          {step === 4 && movies.length > 0 && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl text-foreground">{moodLabel}</h2>
              </div>

              {/* MovieCards — same grid as Index.tsx */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 text-left">
                {movies.map((movie, i) => (
                  <MovieCard key={movie.id} movie={movie} index={i} />
                ))}
              </div>

              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 rounded-full border border-border bg-card hover:bg-accent text-foreground px-6 py-3 text-sm font-medium transition mx-auto"
              >
                <RotateCcw size={16} />
                Try Again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
