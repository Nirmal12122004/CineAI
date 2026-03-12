import { Star, Download, Play, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Movie } from "@/lib/mockData";

function getRatingColor(rating: number) {
  if (rating >= 4.5) return "text-rating-high";
  if (rating >= 3.5) return "text-rating-mid";
  return "text-rating-low";
}

function getRatingBg(rating: number) {
  if (rating >= 4.5) return "bg-rating-high";
  if (rating >= 3.5) return "bg-rating-mid";
  return "bg-rating-low";
}

export function MovieCard({ movie, index }: { movie: Movie; index: number }) {

  const [videoKey, setVideoKey] = useState<string | null>(null);

  const TMDB_API_KEY = "03fca15cd9a3eefa92614069b4832b46";

  // 🎬 Trailer Button (Fetch from TMDB)
  const handleTrailer = async () => {
  try {

    // Step 1: Search movie by title
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movie.title)}`
    );

    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      alert("Movie not found in TMDB");
      return;
    }

    // Step 2: Get TMDB ID
    const tmdbId = searchData.results[0].id;

    // Step 3: Fetch trailer
    const videoRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}`
    );

    const videoData = await videoRes.json();

    const trailer = videoData.results.find(
      (vid: any) => vid.type === "Trailer" && vid.site === "YouTube"
    );

    if (trailer) {
      setVideoKey(trailer.key);
    } else {
      alert("Trailer not available");
    }

  } catch (error) {
    console.error("Trailer error:", error);
 }
  };

  // ⬇ Download Button
  const handleDownload = async () => {

    const url = "https://vegamoviesdl.com";

    try {
      await navigator.clipboard.writeText(movie.title);

      alert("✅ Movie name copied!\nPaste it in Vegamovies search bar.");

    } catch {

      const textArea = document.createElement("textarea");
      textArea.value = movie.title;

      document.body.appendChild(textArea);

      textArea.select();
      document.execCommand("copy");

      document.body.removeChild(textArea);

      alert("✅ Movie name copied!\nPaste it in Vegamovies search bar.");
    }

    window.open(url, "_blank");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.08 }}
        className="card-hover group relative overflow-hidden rounded-lg bg-card border border-border"
        style={{ boxShadow: "var(--shadow-card)" }}
      >

        {/* Poster */}
        <div className="relative h-64 w-44 overflow-hidden rounded-lg shadow-lg group">

          <img
            src={
              movie.poster ||
              "https://image.tmdb.org/t/p/w500/6WBeq4fCfn7AN0o21W9qNcRF2l9.jpg"
            }
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />

          {!movie.poster && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <span className="text-4xl font-bold text-gray-400">
                {movie.title.charAt(0)}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>

          {/* Rating Badge */}
          <div
            className={`absolute top-3 right-3 ${getRatingBg(
              movie.predicted_rating
            )} rounded-md px-2 py-1 text-xs font-bold text-background`}
          >
            ★ {movie.predicted_rating.toFixed(2)}
          </div>

          {/* Year */}
          {movie.year && (
            <div className="absolute top-3 left-3 rounded-md bg-background/60 backdrop-blur-sm px-2 py-1 text-xs font-medium text-foreground">
              {movie.year}
            </div>
          )}

          {/* Buttons */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">

            {/* Trailer */}
            <button
              onClick={handleTrailer}
              className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 transition"
            >
              <Play size={14} />
              Trailer
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary/80 transition"
            >
              <Download size={14} />
              Download
            </button>

          </div>
        </div>

        {/* Movie Info */}
        <div className="p-4 space-y-3">

          <h3 className="font-body text-sm font-semibold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {movie.title}
          </h3>

          {/* Genres */}
          <div className="flex flex-wrap gap-1.5">
            {movie.genre.split("|").map((g) => (
              <span
                key={g}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Rating Stars */}
          <div className="flex items-center gap-1 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3.5 w-3.5 ${
                  star <= Math.round(movie.predicted_rating)
                    ? getRatingColor(movie.predicted_rating)
                    : "text-muted"
                }`}
                fill={
                  star <= Math.round(movie.predicted_rating)
                    ? "currentColor"
                    : "none"
                }
              />
            ))}
            <span className="ml-1 text-xs text-muted-foreground">
              {movie.predicted_rating.toFixed(2)}
            </span>
          </div>

        </div>
      </motion.div>

      {/* 🎬 Trailer Modal */}
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

    </>
  );
}