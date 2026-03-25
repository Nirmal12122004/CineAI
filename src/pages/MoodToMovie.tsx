import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { Sparkles, RotateCcw, Play } from "lucide-react";

type Step = 0 | 1 | 2 | 3 | 4;

interface Movie {
  title: string;
  reason: string;
}

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com"; // 🔁 replace this

// 🎬 Movie DB
const MOVIE_DB: Record<string, Movie[]> = {
  happy_fun: [
    { title: "Zindagi Na Milegi Dobara", reason: "Feel-good friendship vibes" },
    { title: "The Intern", reason: "Light and heartwarming story" },
    { title: "3 Idiots", reason: "Funny and inspiring" },
  ],
  sad_emotional: [
    { title: "The Pursuit of Happyness", reason: "Motivational and emotional" },
    { title: "Taare Zameen Par", reason: "Heart-touching story" },
    { title: "A Silent Voice", reason: "Deep emotional journey" },
  ],
  bored_fun: [
    { title: "Jumanji", reason: "Fun adventure" },
    { title: "Deadpool", reason: "Crazy entertaining action" },
    { title: "Rush Hour", reason: "Comedy + action combo" },
  ],
  angry_action: [
    { title: "John Wick", reason: "Pure action energy" },
    { title: "The Dark Knight", reason: "Intense and powerful" },
    { title: "Mad Max: Fury Road", reason: "High adrenaline ride" },
  ],
};

// 🔐 Fetch poster from backend
const fetchPoster = async (title: string) => {
  try {
    const res = await fetch(
      `${BACKEND_URL}/poster?title=${encodeURIComponent(title)}`
    );
    const data = await res.json();
    return data.poster;
  } catch (err) {
    console.error("Poster fetch error:", err);
    return null;
  }
};

export default function MoodToMovie() {
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [moodLabel, setMoodLabel] = useState("");

  // 🎬 Trailer (same tab)
  const playTrailer = (title: string) => {
    const query = encodeURIComponent(`${title} official trailer`);
    window.open(
      `https://www.youtube.com/results?search_query=${query}`,
      "_self"
    );
  };

  const calculateMood = async (ans: string[]) => {
    const key = `${ans[0]}_${ans[1]}`;

    const moodMap: Record<string, string> = {
      happy_fun: "😊 Feel-Good & Fun",
      sad_emotional: "😔 Emotional Healing",
      bored_fun: "😴 Entertaining Escape",
      angry_action: "😡 Action & Intense",
    };

    setMoodLabel(moodMap[key] || "🎬 Recommended");

    const baseMovies = MOVIE_DB[key] || MOVIE_DB["happy_fun"];

    // 🔥 Fetch posters
    const enriched = await Promise.all(
      baseMovies.map(async (m) => ({
        ...m,
        poster: await fetchPoster(m.title),
      }))
    );

    setMovies(enriched);
    setStep(4);
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-10 max-w-5xl mx-auto text-center">
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-4xl font-display">
            Mood to <span className="text-gradient">Movie</span>
          </h1>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Start */}
          {step === 0 && (
            <motion.button
              key="start"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStep(1)}
              className="mt-10 bg-primary text-white px-8 py-3 rounded-full flex items-center gap-2 mx-auto"
            >
              <Sparkles size={18} /> Start
            </motion.button>
          )}

          {/* Q1 */}
          {step === 1 && (
            <motion.div key="q1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl mt-10 mb-4">How are you feeling?</h2>
              <div className="grid gap-3 max-w-sm mx-auto">
                {["happy", "sad", "bored", "angry"].map((m) => (
                  <button key={m} onClick={() => handleAnswer(m)} className="btn">
                    {m}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Q2 */}
          {step === 2 && (
            <motion.div key="q2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl mt-10 mb-4">What do you want?</h2>
              <div className="grid gap-3 max-w-sm mx-auto">
                {["fun", "emotional", "action"].map((m) => (
                  <button key={m} onClick={() => handleAnswer(m)} className="btn">
                    {m}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Q3 (NEW) */}
          {step === 3 && (
            <motion.div key="q3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl mt-10 mb-4">Preferred vibe?</h2>
              <div className="grid gap-3 max-w-sm mx-auto">
                {["light", "intense"].map((m) => (
                  <button key={m} onClick={() => handleAnswer(m)} className="btn">
                    {m}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Results */}
          {step === 4 && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl mt-6 mb-6">
                🎯 Based on your mood, here are perfect movies for you
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                {movies.map((movie) => (
                  <motion.div
                    key={movie.title}
                    whileHover={{ scale: 1.05 }}
                    className="bg-card rounded-xl overflow-hidden shadow-lg"
                  >
                    <img
                      src={movie.poster || "https://via.placeholder.com/300x450"}
                      className="w-full h-72 object-cover"
                    />

                    <div className="p-4 text-left">
                      <h3 className="font-semibold">{movie.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {movie.reason}
                      </p>

                      <button
                        onClick={() => playTrailer(movie.title)}
                        className="mt-3 flex items-center gap-2 text-primary"
                      >
                        <Play size={16} /> Watch Trailer
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={reset}
                className="mt-8 border px-6 py-2 rounded-full flex items-center gap-2 mx-auto"
              >
                <RotateCcw size={16} /> Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}