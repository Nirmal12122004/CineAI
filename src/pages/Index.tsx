import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertCircle, Play, Download, X } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { ModelAccuracy } from "@/components/ModelAccuracy";
import { UserIdInput } from "@/components/UserIdInput";
import { AppHeader } from "@/components/AppHeader";
import { NewReleases } from "@/components/NewReleases";
import { fetchRecommendations, fetchMetrics, type Movie } from "@/lib/mockData";

const metrics = fetchMetrics();

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

const Index = () => {

const [movies, setMovies] = useState<Movie[]>([]);
const [inputMovie, setInputMovie] = useState<Movie | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [searched, setSearched] = useState(false);
const [videoKey, setVideoKey] = useState<string | null>(null);
const [searchedMovieName, setSearchedMovieName] = useState<string | null>(null); // ← track searched name

const handleRecommend = async (movieName: string) => {
  setLoading(true);
  setError("");

  try {
    const { input, recommendations } = await fetchRecommendations(movieName);
    setInputMovie(input);
    setMovies(recommendations);
    setSearched(true);
    setSearchedMovieName(movieName);  // ← save searched movie name
  } catch (err: any) {
    setError(err.message);
    setMovies([]);
    setInputMovie(null);
  } finally {
    setLoading(false);
  }
};

// ✅ Trailer via backend - TMDB key hidden
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
    alert("Failed to fetch trailer. Please try again.");
  }
};

// ✅ Alert first, then redirect
const handleDownload = (movieTitle?: string) => {
  const title = movieTitle || inputMovie?.title;

  if (!title) {
    alert("Movie not found");
    return;
  }

  const url = "https://vegamoviesdl.com";

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(title)
      .then(() => {
        alert("✅ Movie name copied!\nPaste it in Vegamovies search bar.");
        window.open(url, "_blank");
      })
      .catch(() => {
        fallbackCopy(title, url);
      });
  } else {
    fallbackCopy(title, url);
  }
};

function fallbackCopy(text: string, url: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
    alert("✅ Movie name copied!\nPaste it in Vegamovies search bar.");
    window.open(url, "_blank");
  } catch {
    alert("Copy failed. Movie name: " + text);
    window.open(url, "_blank");
  }

  document.body.removeChild(textarea);
}

return (
  <div className="min-h-screen bg-background">

    <AppHeader />

    {/* Hero Section */}
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="container relative py-16 md:py-24 text-center space-y-6">

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-5xl md:text-7xl tracking-wide"
        >
          AI Movie <span className="text-gradient">Recommendations</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Powered by a hybrid content-based movie recommender using TF-IDF
          Vectorization and Cosine Similarity with Popularity Boosting.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <UserIdInput onSubmit={handleRecommend} loading={loading} />
        </motion.div>

      </div>
    </section>

    {/* Recommendations Section */}
    <div className="container py-10">
      <div className="flex flex-col lg:flex-row gap-10">

        <main className="flex-1">

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-card border border-border overflow-hidden animate-pulse">
                  <div className="w-full aspect-[2/3] bg-secondary" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-secondary rounded w-3/4" />
                    <div className="h-3 bg-secondary rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && searched && movies.length > 0 && (
            <>
              {inputMovie && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-10 rounded-xl border border-primary/30 bg-card overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row gap-6 p-6">
                    <img
                      src={inputMovie.poster}
                      alt={inputMovie.title}
                      className="w-40 md:w-52 rounded-lg shadow-lg object-cover"
                    />
                    <div className="flex flex-col justify-center space-y-3">
                      <p className="text-sm text-muted-foreground">Based on your selection</p>
                      <h2 className="font-display text-3xl text-foreground">{inputMovie.title}</h2>
                      <p className="text-muted-foreground">
                        {inputMovie.year} • {inputMovie.genre.replace(/\|/g, ", ")}
                      </p>
                      <div className="flex items-center gap-2 text-yellow-400">
                        ⭐ {inputMovie.predicted_rating.toFixed(2)}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleTrailer}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm"
                        >
                          <Play size={16} />
                          Trailer
                        </button>
                        <button
                          onClick={() => handleDownload(inputMovie.title)}
                          className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm"
                        >
                          <Download size={16} />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl text-foreground">
                  Similar Movies You'll Love
                </h2>
              </div>

              <AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {movies.map((movie, i) => (
                    <MovieCard key={movie.id} movie={movie} index={i} />
                  ))}
                </div>
              </AnimatePresence>
            </>
          )}

        </main>

        <aside className="lg:w-80 xl:w-96 shrink-0">
          <ModelAccuracy metrics={metrics} />
        </aside>

      </div>
    </div>

    {/* ✅ Similar Recent Movies Section - updates on every search */}
    {searchedMovieName && (
      <div className="border-t border-border">
        <NewReleases searchedMovie={searchedMovieName} />
      </div>
    )}

    {/* Trailer Modal */}
    {videoKey && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="relative w-[90%] max-w-4xl aspect-video">
          <button
            onClick={() => setVideoKey(null)}
            className="absolute -top-10 right-0 text-white"
          >
            <X size={28} />
          </button>
          <iframe
            className="w-full h-full rounded-lg"
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
            title="Movie Trailer"
            frameBorder="0"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    )}

  </div>
);

};

export default Index;
