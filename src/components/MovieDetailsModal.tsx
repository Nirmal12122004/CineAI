import { useEffect, useState } from "react";
import { X, Star, Clock, Calendar, DollarSign, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

interface CastMember {
  name: string;
  character: string;
  photo: string | null;
}

interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  release_date: string;
  runtime: number;
  vote_average: number;
  genres: string[];
  director: string;
  cast: CastMember[];
  budget: number;
  revenue: number;
  tagline: string;
}

interface MovieDetailsModalProps {
  movieTitle: string | null;  // ← Use title instead of ID
  onClose: () => void;
}

export function MovieDetailsModal({ movieTitle, onClose }: MovieDetailsModalProps) {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!movieTitle) return;

    const fetchDetails = async () => {
      setLoading(true);
      setDetails(null);
      setError("");

      try {
        const res = await fetch(
          `${BACKEND_URL}/movie-details-by-title/${encodeURIComponent(movieTitle)}`
        );
        const data = await res.json();

        if (data.error || !data.title) {
          setError("Could not load movie details.");
        } else {
          setDetails(data);
        }
      } catch (err) {
        setError("Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [movieTitle]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!movieTitle) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-card border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full bg-background/80 p-2 text-foreground hover:bg-background transition"
          >
            <X size={20} />
          </button>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">Loading details...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}

          {/* Movie Details */}
          {!loading && !error && details && (
            <>
              {/* Backdrop */}
              {details.backdrop && (
                <div className="relative h-48 w-full overflow-hidden rounded-t-xl">
                  <img
                    src={details.backdrop}
                    alt={details.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                </div>
              )}

              <div className="p-6 space-y-6">

                {/* Title + Basic Info */}
                <div className="flex gap-5">
                  {details.poster && (
                    <img
                      src={details.poster}
                      alt={details.title}
                      className="w-28 rounded-lg shadow-lg object-cover shrink-0 -mt-16 border-2 border-border"
                    />
                  )}
                  <div className="space-y-2 pt-1">
                    <h2 className="font-display text-2xl text-foreground">{details.title}</h2>
                    {details.tagline && (
                      <p className="text-sm text-primary italic">"{details.tagline}"</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {details.genres.map((g) => (
                        <span key={g} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 text-yellow-400" fill="currentColor" />
                    <span>{details.vote_average.toFixed(1)} / 5</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{details.runtime} min</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{details.release_date?.slice(0, 4)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 text-primary" />
                    <span className="truncate">{details.director}</span>
                  </div>
                </div>

                {/* Overview */}
                {details.overview && (
                  <div>
                    <h3 className="font-display text-lg text-foreground mb-2">Overview</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{details.overview}</p>
                  </div>
                )}

                {/* Cast */}
                {details.cast.length > 0 && (
                  <div>
                    <h3 className="font-display text-lg text-foreground mb-3">Cast</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {details.cast.map((member) => (
                        <div key={member.name} className="text-center space-y-1">
                          <div className="w-full aspect-square rounded-full overflow-hidden bg-secondary mx-auto">
                            {member.photo ? (
                              <img
                                src={member.photo}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                                {member.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground line-clamp-1">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{member.character}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Budget & Revenue */}
                {(details.budget > 0 || details.revenue > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {details.budget > 0 && (
                      <div className="rounded-lg bg-secondary p-3 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          Budget
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          ${(details.budget / 1_000_000).toFixed(1)}M
                        </p>
                      </div>
                    )}
                    {details.revenue > 0 && (
                      <div className="rounded-lg bg-secondary p-3 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          Revenue
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          ${(details.revenue / 1_000_000).toFixed(1)}M
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
