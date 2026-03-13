from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recommender import recommend, TMDB_API_KEY
from app.moviesmod_scraper import get_vegamovies_search
import httpx

app = FastAPI(title="AI Movie Recommendation API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
def home():
    return {"message": "AI Movie Recommendation API running 🚀"}

# Health check endpoint
@app.get("/health")
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
            # Step 1 - Search for movie
            search_resp = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": TMDB_API_KEY, "query": movie_name},
                timeout=5.0,
            )
            search_data = search_resp.json()

            if not search_data.get("results"):
                return {"trailer_key": None}

            tmdb_id = search_data["results"][0]["id"]

            # Step 2 - Get trailer video
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
