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

# Movie recommendation endpoint (uses your ML model)
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


# ✅ Similar Recent Movies from TMDB (1995-2026)
# Uses TMDB's own similar + keywords API for best matching
@app.get("/similar-recent/{movie_name}")
async def get_similar_recent(movie_name: str):
    async with httpx.AsyncClient() as client:
        try:
            # Step 1 - Search the movie on TMDB to get its ID
            search_resp = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": TMDB_API_KEY, "query": movie_name},
                timeout=5.0,
            )
            search_data = search_resp.json()

            if not search_data.get("results"):
                return {"movies": []}

            searched = search_data["results"][0]
            tmdb_id = searched["id"]
            genre_ids = searched.get("genre_ids", [])

            # Step 2 - Fetch genre map
            genre_resp = await client.get(
                "https://api.themoviedb.org/3/genre/movie/list",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            genre_map = {
                g["id"]: g["name"]
                for g in genre_resp.json().get("genres", [])
            }

            # Step 3 - Fetch keywords of the searched movie
            keywords_resp = await client.get(
                f"https://api.themoviedb.org/3/movie/{tmdb_id}/keywords",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            keyword_ids = [
                str(k["id"])
                for k in keywords_resp.json().get("keywords", [])[:5]  # top 5 keywords
            ]

            # Step 4 - Fetch TMDB similar movies (direct similar endpoint)
            similar_resp = await client.get(
                f"https://api.themoviedb.org/3/movie/{tmdb_id}/similar",
                params={"api_key": TMDB_API_KEY, "page": 1},
                timeout=5.0,
            )
            similar_movies = similar_resp.json().get("results", [])

            # Step 5 - Discover movies by keywords + genres (1995-2026)
            discover_params = {
                "api_key": TMDB_API_KEY,
                "sort_by": "release_date.desc",
                "primary_release_date.gte": "1995-01-01",
                "primary_release_date.lte": "2026-12-31",
                "vote_count.gte": 30,
                "page": 1,
            }

            # Use keywords if available, else fallback to genres
            if keyword_ids:
                discover_params["with_keywords"] = "|".join(keyword_ids)
            elif genre_ids:
                discover_params["with_genres"] = ",".join(str(g) for g in genre_ids[:2])

            discover_resp = await client.get(
                "https://api.themoviedb.org/3/discover/movie",
                params=discover_params,
                timeout=5.0,
            )
            discover_movies = discover_resp.json().get("results", [])

            # Step 6 - Merge similar + discover, deduplicate
            seen_ids = {tmdb_id}  # exclude searched movie itself
            merged = []

            for m in similar_movies + discover_movies:
                mid = m.get("id")
                if mid in seen_ids:
                    continue
                seen_ids.add(mid)

                release_date = m.get("release_date", "")
                year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None

                # Filter year range
                if year and (year < 1995 or year > 2026):
                    continue

                genre_names = [
                    genre_map.get(gid, "")
                    for gid in m.get("genre_ids", [])
                    if genre_map.get(gid)
                ]

                merged.append({
                    "id": mid,
                    "title": m.get("title", ""),
                    "poster": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else None,
                    "year": year,
                    "genre": "|".join(genre_names),
                    "predicted_rating": round(m.get("vote_average", 0) / 2, 2),
                })

                if len(merged) >= 20:
                    break

            return {"movies": merged}

        except Exception as e:
            return {"movies": [], "error": str(e)}
