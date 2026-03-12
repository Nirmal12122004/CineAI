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

export async function fetchRecommendations(
  movieName: string
): Promise<{ input: Movie | null; recommendations: Movie[] }> {

  const query = movieName.trim();

  if (!query) {
    throw new Error("Please enter a movie name.");
  }

  const response = await fetch(
    `http://localhost:8000/recommend/${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error(
      "Movie not found. Try full title like 'Iron Man (2008)'."
    );
  }

  const data = await response.json();

  if (!data.recommendations || data.recommendations.length === 0) {
    throw new Error(`No movie found matching "${movieName}".`);
  }

  // Convert API response to Movie objects
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

  // Try to get searched movie from backend
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
  } 
  else {
    // fallback if backend doesn't send searched movie
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