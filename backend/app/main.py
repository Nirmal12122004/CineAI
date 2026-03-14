from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recommender import recommend, recommend_with_year_filter, TMDB_API_KEY
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

# ✅ Similar recent movies - uses your ML model, filtered to 1995-2026
@app.get("/similar-recent/{movie_name}")
def get_similar_recent(movie_name: str):
    return recommend_with_year_filter(movie_name, year_from=1995, year_to=2026)

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
