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
  const [serverWaking, setServerWaking] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 🔥 Wake server immediately
  useEffect(() => {
    const wake = async () => {
      try {
        await fetch(`${BACKEND_URL}/health`);
      } catch {}
      setServerWaking(false);
    };
    wake();
  }, []);

  // 🔥 Keep server alive (prevents cold start)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${BACKEND_URL}/health`).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const callGemini = async (msgs: Message[], attempt = 0): Promise<string | null> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15000;

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
    } catch (err) {
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
        content: "⚠️ Server is slow right now. Try again.",
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
        parsed.recommendations.forEach((m: MovieRecommendation) =>
          fetchPoster(m.title)
        );
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

    // ⏳ Show message if slow
    const timeout = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⏳ Still working... server is waking up. Please wait a few seconds.",
        },
      ]);
    }, 5000);

    const response = await callGemini(newMessages);

    clearTimeout(timeout);

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
          content: "⚠️ Server is slow right now. Try again.",
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
          <div className="text-center space-y-6 py-10">
            <div className="text-6xl">🎭</div>

            {serverWaking && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={13} className="animate-spin text-primary" />
                <span>Warming up server…</span>
              </div>
            )}

            <button
              onClick={startConversation}
              className="bg-primary text-white px-8 py-3 rounded-full"
            >
              Discover My Movies
            </button>
          </div>
        )}

        {/* Chat UI */}
        {started && recommendations.length === 0 && (
          <div className="space-y-4">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="bg-card px-4 py-3 rounded-2xl">
                      {msg.content}
                    </div>
                  </div>
                ))}
              </AnimatePresence>

              {loading && <div className="text-sm text-muted">Typing...</div>}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 border px-4 py-2 rounded-full"
              />
              <button onClick={sendMessage}>
                <Send />
              </button>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-4">
            <h2>{moodSummary}</h2>

            {recommendations.map((movie) => (
              <div key={movie.title} className="border p-3 rounded">
                <h3>{movie.title}</h3>
                <p>{movie.reason}</p>
              </div>
            ))}

            <button onClick={reset}>Reset</button>
          </div>
        )}

      </div>
    </div>
  );
}