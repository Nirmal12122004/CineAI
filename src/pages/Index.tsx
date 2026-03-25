import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertCircle, Play, Download, X } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { ModelAccuracy } from "@/components/ModelAccuracy";
import { UserIdInput } from "@/components/UserIdInput";
import { AppHeader } from "@/components/AppHeader";
import { NewReleases } from "@/components/NewReleases";
import { ServerWakeLoader } from "@/components/ServerWakeLoader";
import { fetchRecommendations, fetchMetrics, type Movie } from "@/lib/mockData";

const metrics = fetchMetrics();
const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

const Index = () => {

  const [movies, setMovies] = useState<Movie[]>([]);
  const [inputMovie, setInputMovie] = useState<Movie | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [searchedMovieName, setSearchedMovieName] = useState<string | null>(null);

  // ✅ Smart loader states
  const [showLoader, setShowLoader] = useState(false);

  // ✅ Server wake state
  const [serverWaking, setServerWaking] = useState(true);

  // 🔥 Wake backend on page load
  useEffect(() => {
    const wake = async () => {
      try {
        await fetch(`${BACKEND_URL}/health`, {
          signal: AbortSignal.timeout(60000),
        });
      } catch {}
      finally {
        setServerWaking(false);
      }
    };
    wake();
  }, []);

  // ✅ Smart loader logic (only if > 500ms)
  const handleRecommend = async (movieName: string) => {
    setError("");

    const timer = setTimeout(() => {
      setShowLoader(true);
    }, 500);

    try {
      const { input, recommendations } = await fetchRecommendations(movieName);
      setInputMovie(input);
      setMovies(recommendations);
      setSearched(true);
      setSearchedMovieName(movieName);
    } catch (err: any) {
      setError(err.message);
      setMovies([]);
      setInputMovie(null);
    } finally {
      clearTimeout(timer);
      setShowLoader(false);
    }
  };

  // ✅ Trailer
  const handleTrailer = async () => {
    if (!inputMovie) {
      alert("Movie not selected");
      return;
    }

    try {
      const res = await fetch(
        `${BACKEND_URL}/trailer/${encodeURIComponent(inputMovie.title)}`
      );
      const data = await res.json();

      if (data.trailer_key) {
        setVideoKey(data.trailer_key);
      } else {
        alert("Trailer not available");
      }
    } catch (error) {
      console.error("Trailer error:", error);
      alert("Failed to fetch trailer.");
    }
  };

  // ✅ Download
  const handleDownload = (movieTitle?: string) => {
    const title = movieTitle || inputMovie?.title;
    if (!title) return alert("Movie not found");

    const url = "https://vegamoviesdl.com";

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(title)
        .then(() => {
          alert("✅ Movie name copied!");
          window.open(url, "_blank");
        })
        .catch(() => fallbackCopy(title, url));
    } else {
      fallbackCopy(title, url);
    }
  };

  function fallbackCopy(text: string, url: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      alert("✅ Movie name copied!");
    } catch {
      alert("Copy failed: " + text);
    }

    window.open(url, "_blank");
    document.body.removeChild(textarea);
  }

  return (
    <div className="min-h-screen bg-background">

      <AppHeader />

      {/* 🔥 Overlay loader while server waking */}
      {serverWaking && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center">
          <ServerWakeLoader message="Starting CineAI engine" />
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container py-16 text-center space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl"
          >
            AI Movie <span className="text-gradient">Recommendations</span>
          </motion.h1>

          <p className="text-muted-foreground max-w-2xl mx-auto">
            Powered by TF-IDF + Cosine Similarity
          </p>

          <UserIdInput onSubmit={handleRecommend} loading={showLoader} />
        </div>
      </section>

      {/* Main */}
      <div className="container py-10">
        <div className="flex flex-col lg:flex-row gap-10">

          <main className="flex-1">

            {error && (
              <div className="flex items-center gap-3 border p-4 mb-6">
                <AlertCircle className="text-red-500" />
                <p>{error}</p>
              </div>
            )}

            {/* ✅ Smart cinematic loader */}
            {showLoader && (
              <ServerWakeLoader message="Finding similar movies for you" />
            )}

            {!showLoader && searched && movies.length > 0 && (
              <>
                {inputMovie && (
                  <div className="mb-10 border p-6 rounded-xl">
                    <div className="flex gap-6">
                      <img
                        src={inputMovie.poster}
                        className="w-40 rounded"
                      />
                      <div>
                        <h2 className="text-2xl">{inputMovie.title}</h2>
                        <p>{inputMovie.year}</p>

                        <div className="flex gap-3 mt-3">
                          <button onClick={handleTrailer}>
                            <Play size={16} /> Trailer
                          </button>
                          <button onClick={() => handleDownload()}>
                            <Download size={16} /> Download
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {movies.map((movie, i) => (
                    <MovieCard key={movie.id} movie={movie} index={i} />
                  ))}
                </div>
              </>
            )}

          </main>

          <aside className="w-80">
            <ModelAccuracy metrics={metrics} />
          </aside>

        </div>
      </div>

      {/* New releases */}
      {searchedMovieName && (
        <NewReleases searchedMovie={searchedMovieName} />
      )}

      {/* Trailer modal */}
      {videoKey && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
          <div className="w-[90%] max-w-4xl">
            <button onClick={() => setVideoKey(null)}>
              <X />
            </button>
            <iframe
              className="w-full aspect-video"
              src={`https://www.youtube.com/embed/${videoKey}`}
              allowFullScreen
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default Index;