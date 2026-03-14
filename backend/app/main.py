from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recommender import recommend, TMDB_API_KEY
from app.moviesmod_scraper import get_vegamovies_search
import httpx

app = FastAPI(title="AI Movie Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Accepts both GET and HEAD - fixes UptimeRobot 405 error
@app.api_route("/", methods=["GET", "HEAD"])
def home():
    return {"message": "AI Movie Recommendation API running 🚀"}

# ✅ Health check
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}

# Movie recommendation endpoint
@app.get("/recommend/{movie_name}")
def get_recommendation(movie_name: str):
    return recommend(movie_name)

# Vegamovies download helper
@app.get("/download/{movie_name}")
def download_movie(movie_name: str):
    return get_vegamovies_search(movie_name)

# ✅ Trailer endpoint - TMDB API key stays hidden on backend
@app.get("/trailer/{movie_name}")
async def get_trailer(movie_name: str):
    async with httpx.AsyncClient() as client:
        try:
            search_resp = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": TMDB_API_KEY, "query": movie_name},
                timeout=5.0,
            )
            search_data = search_resp.json()

            if not search_data.get("results"):
                return {"trailer_key": None}

            tmdb_id = search_data["results"][0]["id"]

            video_resp = await client.get(
                f"https://api.themoviedb.org/3/movie/{tmdb_id}/videos",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            video_data = video_resp.json()

            trailer = next(
                (v for v in video_data.get("results", [])
                 if v["type"] == "Trailer" and v["site"] == "YouTube"),
                None
            )

            return {"trailer_key": trailer["key"] if trailer else None}

        except Exception as e:
            return {"trailer_key": None, "error": str(e)}


# ✅ Similar movies from TMDB filtered by year 1995-2026
@app.get("/similar-recent/{movie_name}")
async def get_similar_recent(movie_name: str):
    async with httpx.AsyncClient() as client:
        try:
            # Step 1 - Get genre map
            genre_resp = await client.get(
                "https://api.themoviedb.org/3/genre/movie/list",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            genre_map = {g["id"]: g["name"] for g in genre_resp.json().get("genres", [])}

            # Step 2 - Search the movie to get its genre IDs
            search_resp = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": TMDB_API_KEY, "query": movie_name},
                timeout=5.0,
            )
            search_data = search_resp.json()

            if not search_data.get("results"):
                return {"movies": []}

            # Get genre IDs of the searched movie
            searched_movie = search_data["results"][0]
            genre_ids = searched_movie.get("genre_ids", [])

            if not genre_ids:
                return {"movies": []}

            genre_ids_str = ",".join(str(g) for g in genre_ids[:2])  # use top 2 genres

            # Step 3 - Discover similar movies filtered by year 1995-2026
            discover_resp = await client.get(
                "https://api.themoviedb.org/3/discover/movie",
                params={
                    "api_key": TMDB_API_KEY,
                    "with_genres": genre_ids_str,
                    "primary_release_date.gte": "1995-01-01",
                    "primary_release_date.lte": "2026-12-31",
                    "sort_by": "release_date.desc",   # latest first
                    "vote_count.gte": 50,              # filter low quality
                    "page": 1,
                },
                timeout=5.0,
            )
            discover_data = discover_resp.json()

            movies = []
            for m in discover_data.get("results", [])[:20]:
                # Skip the searched movie itself
                if m.get("title", "").lower() == movie_name.lower():
                    continue

                release_year = int(m.get("release_date", "0000")[:4]) if m.get("release_date") else None

                # Double check year range
                if release_year and (release_year < 1995 or release_year > 2026):
                    continue

                genre_names = [genre_map.get(gid, "") for gid in m.get("genre_ids", [])]

                movies.append({
                    "id": m["id"],
                    "title": m.get("title", ""),
                    "poster": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else None,
                    "year": release_year,
                    "genre": "|".join(genre_names),
                    "predicted_rating": round(m.get("vote_average", 0) / 2, 2),
                })

            return {"movies": movies}

        except Exception as e:
            return {"movies": [], "error": str(e)}
