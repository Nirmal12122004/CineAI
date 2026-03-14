import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import type { Movie } from "@/lib/mockData";

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

interface NewReleasesProps {
  searchedMovie: string | null;  // ← updates when user searches
}

export function NewReleases({ searchedMovie }: NewReleasesProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Only fetch when user has searched a movie
    if (!searchedMovie) return;

    const fetchSimilarRecent = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `${BACKEND_URL}/similar-recent/${encodeURIComponent(searchedMovie)}`
        );
        const data = await res.json();

        if (data.movies && data.movies.length > 0) {
          setMovies(data.movies);
        } else {
          setError("No similar recent movies found.");
        }
      } catch (err) {
        setError("Failed to load similar recent movies.");
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarRecent();
  }, [searchedMovie]);  // ← re-fetches every time user searches new movie

  // Don't show section before user searches
  if (!searchedMovie && movies.length === 0 && !loading) return null;

  return (
    <section className="container py-10">

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-2"
      >
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className="font-display text-2xl text-foreground">
          Similar Movies <span className="text-gradient">(1995 - 2026)</span>
        </h2>
      </motion.div>

      <p className="text-sm text-muted-foreground mb-6">
        Recent movies similar to <span className="text-primary font-medium">"{searchedMovie}"</span>
      </p>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg bg-card border border-border overflow-hidden animate-pulse"
            >
              <div className="w-full aspect-[2/3] bg-secondary" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-sm text-muted-foreground">{error}</p>
      )}

      {/* Movies Grid */}
      {!loading && !error && movies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {movies.map((movie, i) => (
            <MovieCard key={movie.id} movie={movie} index={i} />
          ))}
        </div>
      )}

    </section>
  );
}
