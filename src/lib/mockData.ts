const BACKEND_URL = "https://cineai-backend-8ark.onrender.com";

export interface Movie {
  id: number;
  title: string;
  predicted_rating: number;
  genre: string;
  year?: number;
  poster?: string;
}

export interface ModelMetrics {
  svd_rmse: number;
  knn_rmse: number;
  svd_mae: number;
  knn_mae: number;
  training_samples: number;
  test_samples: number;
}

export const mockMetrics: ModelMetrics = {
  svd_rmse: 0.8734,
  knn_rmse: 0.9521,
  svd_mae: 0.6712,
  knn_mae: 0.7345,
  training_samples: 80004,
  test_samples: 20004,
};

// ✅ Clean query - handles ironman→iron man, iron-man→iron man, IronMan→Iron Man
function cleanQuery(movieName: string): string {
  let cleaned = movieName.replace(/[-_]/g, " ").trim();
  cleaned = cleaned.replace(/(?<=[a-z])(?=[A-Z])/g, " ");
  return cleaned;
}

export async function fetchRecommendations(
  movieName: string
): Promise<{ input: Movie | null; recommendations: Movie[] }> {

  const query = movieName.trim();

  if (!query) {
    throw new Error("Please enter a movie name.");
  }

  // ✅ Try original query first, then cleaned version
  const queries = [query, cleanQuery(query)].filter(
    (q, i, arr) => arr.indexOf(q) === i  // deduplicate
  );

  let data: any = null;

  for (const q of queries) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/recommend/${encodeURIComponent(q)}`
      );

      if (!response.ok) continue;

      const result = await response.json();

      if (result.recommendations && result.recommendations.length > 0) {
        data = result;
        break;
      }
    } catch {
      continue;
    }
  }

  // ✅ Better error message
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    throw new Error(
      `"${movieName}" not found. Please check the spelling or try another movie title.`
    );
  }

  const recommendations: Movie[] = data.recommendations.map(
    (movie: any, index: number) => {
      const yearMatch = movie.title?.match(/\((\d{4})\)/);
      const year = movie.year || (yearMatch ? parseInt(yearMatch[1]) : undefined);

      return {
        id: index + 1,
        title: movie.title,
        predicted_rating: movie.predicted_rating || 0,
        genre: movie.genre || "Unknown",
        year: year,
        poster: movie.poster,
      };
    }
  );

  let inputMovie: Movie | null = null;

  if (data.input) {
    const yearMatch = data.input.title?.match(/\((\d{4})\)/);
    const year = data.input.year || (yearMatch ? parseInt(yearMatch[1]) : undefined);

    inputMovie = {
      id: 0,
      title: data.input.title,
      predicted_rating: data.input.predicted_rating || 0,
      genre: data.input.genre || "Unknown",
      year: year,
      poster: data.input.poster,
    };
  } else {
    const first = recommendations[0];
    inputMovie = {
      id: 0,
      title: movieName,
      predicted_rating: first?.predicted_rating || 0,
      genre: first?.genre || "Unknown",
      year: first?.year,
      poster: first?.poster,
    };
  }

  return {
    input: inputMovie,
    recommendations,
  };
}

export function fetchMetrics(): ModelMetrics {
  return mockMetrics;
}
