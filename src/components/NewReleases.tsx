import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import type { Movie } from "@/lib/mockData";

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

export function NewReleases() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNewReleases = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/new-releases`);
        const data = await res.json();

        if (data.movies && data.movies.length > 0) {
          setMovies(data.movies);
        } else {
          setError("No new releases found.");
        }
      } catch (err) {
        setError("Failed to load new releases.");
      } finally {
        setLoading(false);
      }
    };

    fetchNewReleases();
  }, []);

  return (
    <section className="container py-10">

      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-6"
      >
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className="font-display text-2xl text-foreground">
          Now Playing in <span className="text-gradient">Theatres</span>
        </h2>
      </motion.div>

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
