import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { Sparkles, Send, RotateCcw, Film, Loader2 } from "lucide-react";

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
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [moodSummary, setMoodSummary] = useState("");
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [serverWaking, setServerWaking] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Wake up Render server immediately on page load — before the user clicks anything.
  // Render free tier can take 30–50s to cold-start; this hides that wait.
  useEffect(() => {
    const wake = async () => {
      try {
        await fetch(`${BACKEND_URL}/health`, {
          signal: AbortSignal.timeout(60000),
        });
      } catch {
        // Even on failure, let user try — the main call has its own retries
      } finally {
        setServerReady(true);
        setServerWaking(false);
      }
    };
    wake();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const callGemini = async (msgs: Message[], attempt = 0): Promise<string | null> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 60000; // 60s — covers Render cold-start fully

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${BACKEND_URL}/mood-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return data.response || null;
    } catch (err: any) {
      console.error(`Mood chat error (attempt ${attempt + 1}):`, err);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        return callGemini(msgs, attempt + 1);
      }
      return null;
    }
  };

  const startConversation = async () => {
    setStarted(true);
    setLoading(true);
    const firstMessage = await callGemini([]);
    if (firstMessage) {
      setMessages([{ role: "assistant", content: firstMessage }]);
    } else {
      setMessages([{
        role: "assistant",
        content: "⚠️ Server is taking too long to respond. Please wait a moment and try again.",
      }]);
    }
    setLoading(false);
  };

  const fetchPoster = async (title: string) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/movie-details-by-title/${encodeURIComponent(title)}`
      );
      const data = await res.json();
      if (data.poster) {
        setPosters((prev) => ({ ...prev, [title]: data.poster }));
      }
    } catch {}
  };

  const parseRecommendations = (text: string): boolean => {
    try {
      const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

      const start = cleaned.indexOf("{");
      if (start === -1) return false;

      let depth = 0;
      let end = -1;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end === -1) return false;

      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (parsed.recommendations && parsed.mood_summary) {
        setMoodSummary(parsed.mood_summary);
        setRecommendations(parsed.recommendations);
        parsed.recommendations.forEach((m: MovieRecommendation) => fetchPoster(m.title));
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

    const response = await callGemini(newMessages);

    if (response) {
      const isRecommendation = parseRecommendations(response);
      if (!isRecommendation) {
        setMessages([...newMessages, { role: "assistant", content: response }]);
      }
    } else {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "⚠️ No response from server. Please try again.",
        },
      ]);
    }

    setLoading(false);
  };

  const reset = () => {
    setMessages([]);
    setRecommendations([]);
    setMoodSummary("");
    setPosters({});
    setStarted(false);
    setInput("");
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

            {/* Server waking status */}
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
              onClick={startConversation}
              disabled={serverWaking}
              className="bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-medium text-lg transition flex items-center gap-2 mx-auto"
            >
              <Sparkles size={20} />
              {serverWaking ? "Please wait…" : "Discover My Movies"}
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
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-primary"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
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

        {/* Recommendations */}
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

            <h2 className="font-display text-2xl text-foreground text-center">
              Perfect Movies <span className="text-gradient">For You Right Now</span>
            </h2>

            {/* Movie Cards */}
            <div className="space-y-4">
              {recommendations.map((movie, i) => (
                <motion.div
                  key={movie.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 rounded-xl border border-border bg-card p-4"
                >
                  {/* Poster */}
                  <div className="w-16 h-24 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {posters[movie.title] ? (
                      <img
                        src={posters[movie.title]}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base text-foreground">{movie.title}</h3>
                      <span className="text-xs text-muted-foreground shrink-0">{movie.year}</span>
                    </div>
                    <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {movie.genre}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{movie.reason}</p>
                  </div>
                </motion.div>
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
