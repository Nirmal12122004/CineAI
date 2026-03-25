import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { MovieCard } from "@/components/MovieCard";
import { Sparkles, Send, RotateCcw, AlertCircle } from "lucide-react";
import type { Movie } from "@/lib/mockData";

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MovieRecommendation {
  title: string;
  reason: string;
  genre: string;
  year: string;
}

export default function MoodToMovie() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [moodSummary, setMoodSummary] = useState("");
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ✅ Retry logic - tries up to 3 times
  const callGemini = async (msgs: Message[], retries = 3): Promise<string | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(`${BACKEND_URL}/mood-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const data = await response.json();

        if (data.response) return data.response;

        if (data.error?.includes("429") || data.error?.includes("quota")) {
          setError("AI quota exceeded. Please try again later.");
          return null;
        }

        if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * attempt));

      } catch (err: any) {
        if (err.name === "AbortError") {
          if (attempt < retries) continue;
          setError("Request timed out. Please try again.");
          return null;
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 1500));
      }
    }
    setError("Failed to get response. Please try again.");
    return null;
  };

  const startConversation = async () => {
    setStarted(true);
    setLoading(true);
    setError("");
    const firstMessage = await callGemini([]);
    if (firstMessage) {
      setMessages([{ role: "assistant", content: firstMessage }]);
    }
    setLoading(false);
  };

  // ✅ Fetch poster + details from TMDB via backend
  const fetchMovieDetails = async (title: string, year: string): Promise<Movie> => {
    try {
      const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, "").trim();
      const searchQuery = year ? `${cleanTitle} ${year}` : cleanTitle;

      const res = await fetch(
        `${BACKEND_URL}/movie-details-by-title/${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      if (data.id) {
        return {
          id: data.id,
          title: data.title || title,
          predicted_rating: data.vote_average || 0,
          genre: data.genres?.join("|") || "Unknown",
          year: data.release_date ? parseInt(data.release_date.slice(0, 4)) : undefined,
          poster: data.poster || undefined,
        };
      }
    } catch {}

    // Fallback
    return {
      id: Math.random(),
      title,
      predicted_rating: 0,
      genre: "Unknown",
      year: parseInt(year) || undefined,
      poster: undefined,
    };
  };

  const parseRecommendations = async (text: string): Promise<boolean> => {
    try {
      const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return false;

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.recommendations && parsed.mood_summary) {
        setMoodSummary(parsed.mood_summary);

        // ✅ Fetch full movie details for all recommended movies concurrently
        const moviePromises = parsed.recommendations.map((m: MovieRecommendation) =>
          fetchMovieDetails(m.title, m.year)
        );
        const movies = await Promise.all(moviePromises);
        setRecommendations(movies);
        return true;
      }
    } catch {}
    return false;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    const response = await callGemini(newMessages);

    if (response) {
      const isRecommendation = await parseRecommendations(response);
      if (!isRecommendation) {
        setMessages([...newMessages, { role: "assistant", content: response }]);
      }
    }

    setLoading(false);
  };

  const reset = () => {
    setMessages([]);
    setRecommendations([]);
    setMoodSummary("");
    setStarted(false);
    setInput("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="container py-10 max-w-2xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 space-y-2"
        >
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="font-display text-4xl text-foreground">
              Mood to <span className="text-gradient">Movie</span>
            </h1>
          </div>
          <p className="text-muted-foreground">
            Tell AI how you feel — get perfect movie recommendations
          </p>
        </motion.div>

        {/* Start Screen */}
        {!started && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-10"
          >
            <div className="text-6xl">🎭</div>
            <p className="text-muted-foreground max-w-md mx-auto">
              Our AI will ask you a few fun questions to understand your
              current mood and recommend the perfect movies for you right now.
            </p>
            <button
              onClick={startConversation}
              className="bg-primary hover:bg-primary/80 text-white px-8 py-3 rounded-full font-medium text-lg transition flex items-center gap-2 mx-auto"
            >
              <Sparkles size={20} />
              Discover My Movies
            </button>
          </motion.div>
        )}

        {/* Chat Interface */}
        {started && recommendations.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="space-y-4 min-h-64 max-h-96 overflow-y-auto pr-2">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-card border border-border text-foreground rounded-bl-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles size={12} className="text-primary" />
                          <span className="text-xs text-primary font-medium">CineAI</span>
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Loading dots */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-primary"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                      <span className="text-xs text-muted-foreground ml-2">AI is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your answer..."
                disabled={loading}
                className="flex-1 bg-card border border-border rounded-full px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-primary hover:bg-primary/80 disabled:opacity-50 text-white rounded-full p-3 transition"
              >
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ✅ Recommendations using MovieCard - same as home page */}
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Mood Summary */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
              <div className="text-3xl">🎭</div>
              <p className="text-sm text-muted-foreground">Your current mood</p>
              <p className="font-display text-lg text-foreground italic">"{moodSummary}"</p>
            </div>

            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl text-foreground">
                Perfect Movies <span className="text-gradient">For You Right Now</span>
              </h2>
            </div>

            {/* ✅ Same grid as home page recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {recommendations.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} />
              ))}
            </div>

            {/* Reset Button */}
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-border bg-card hover:bg-accent text-foreground px-6 py-3 text-sm font-medium transition"
            >
              <RotateCcw size={16} />
              Analyze My Mood Again
            </button>
          </motion.div>
        )}

      </div>
    </div>
  );
}
