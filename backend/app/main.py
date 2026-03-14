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

# ✅ New Releases endpoint - fetches latest movies from TMDB
@app.get("/new-releases")
async def get_new_releases():
    async with httpx.AsyncClient() as client:
        try:
            # Fetch genre list
            genre_resp = await client.get(
                "https://api.themoviedb.org/3/genre/movie/list",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            genre_map = {g["id"]: g["name"] for g in genre_resp.json().get("genres", [])}

            # Fetch now playing movies
            movies_resp = await client.get(
                "https://api.themoviedb.org/3/movie/now_playing",
                params={"api_key": TMDB_API_KEY, "page": 1},
                timeout=5.0,
            )
            movies_data = movies_resp.json()

            movies = []
            for m in movies_data.get("results", [])[:20]:
                genre_names = [genre_map.get(gid, "") for gid in m.get("genre_ids", [])]
                movies.append({
                    "id": m["id"],
                    "title": m.get("title", ""),
                    "poster": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else None,
                    "year": m.get("release_date", "")[:4] if m.get("release_date") else None,
                    "genre": "|".join(genre_names),
                    "predicted_rating": round(m.get("vote_average", 0) / 2, 2),
                })

            return {"movies": movies}

        except Exception as e:
            return {"movies": [], "error": str(e)}
