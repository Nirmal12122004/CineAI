import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { Sparkles, RotateCcw, Play } from "lucide-react";

type Step = 0 | 1 | 2 | 3 | 4;

interface Movie {
  title: string;
  poster: string | null;
  reason: string;
}

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

export default function MoodToMovie() {
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [trailer, setTrailer] = useState<string | null>(null);
  const [moodLabel, setMoodLabel] = useState("");

  // 🎯 Fetch recommendations from backend
  const calculateMood = async (ans: string[]) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/mood-recommend?mood=${ans[0]}&energy=${ans[2]}&genre=${ans[1]}`
      );

      const data = await res.json();

      setMoodLabel("🎯 Perfect picks based on your mood");

      setMovies(
        data.movies.map((m: any) => ({
          title: m.title,
          poster: m.poster,
          reason: m.overview || "Perfect match for your mood",
        }))
      );

      setStep(4);
    } catch (err) {
      console.error("Recommendation error:", err);
    }
  };

  // 🎬 Trailer inside app (modal)
  const playTrailer = async (title: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/trailer/${title}`);
      const data = await res.json();

      if (data.trailer_key) {
        setTrailer(`https://www.youtube.com/embed/${data.trailer_key}`);
      }
    } catch (err) {
      console.error(err);
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
    setTrailer(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
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

          {/* Q3 */}
          {step === 3 && (
            <motion.div key="q3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl mt-10 mb-4">Preferred vibe?</h2>
              <div className="grid gap-3 max-w-sm mx-auto">
                {["low", "medium", "high"].map((m) => (
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
              <h2 className="text-2xl mt-6 mb-6">{moodLabel}</h2>

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

      {/* 🎬 Trailer Modal */}
      {trailer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-[90%] md:w-[70%] h-[60%] relative">
            <iframe
              src={trailer}
              className="w-full h-full rounded-xl"
              allowFullScreen
            />
            <button
              onClick={() => setTrailer(null)}
              className="absolute top-2 right-2 bg-white text-black px-3 py-1 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}