from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recommender import recommend, TMDB_API_KEY
from app.moviesmod_scraper import get_vegamovies_search
import httpx
import asyncio

app = FastAPI(title="AI Movie Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.api_route("/", methods=["GET", "HEAD"])
def home():
    return {"message": "AI Movie Recommendation API running 🚀"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}

@app.get("/recommend/{movie_name}")
def get_recommendation(movie_name: str):
    return recommend(movie_name)

@app.get("/download/{movie_name}")
def download_movie(movie_name: str):
    return get_vegamovies_search(movie_name)

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


def _format_movie(m: dict, genre_map: dict) -> dict:
    release_date = m.get("release_date", "")
    year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None
    genre_names = [
        genre_map.get(gid, "")
        for gid in m.get("genre_ids", [])
        if genre_map.get(gid)
    ]
    return {
        "id": m.get("id"),
        "title": m.get("title", ""),
        "poster": f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else None,
        "year": year,
        "genre": "|".join(genre_names),
        "predicted_rating": round(m.get("vote_average", 0) / 2, 2),
    }


def _in_year_range(m: dict) -> bool:
    release_date = m.get("release_date", "")
    if not release_date or len(release_date) < 4:
        return False
    year = int(release_date[:4])
    return 1995 <= year <= 2026


@app.get("/similar-recent/{movie_name}")
async def get_similar_recent(movie_name: str):
    async with httpx.AsyncClient() as client:
        try:
            # ── Step 1: Genre map ──────────────────────────────────────
            genre_resp = await client.get(
                "https://api.themoviedb.org/3/genre/movie/list",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            genre_map = {g["id"]: g["name"] for g in genre_resp.json().get("genres", [])}

            # ── Step 2: Search movie on TMDB ───────────────────────────
            search_resp = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": TMDB_API_KEY, "query": movie_name},
                timeout=5.0,
            )
            results = search_resp.json().get("results", [])
            if not results:
                return {"movies": []}

            searched = results[0]
            tmdb_id = searched["id"]
            genre_ids = searched.get("genre_ids", [])

            # ── Step 3: Get full details (collection + keywords) ───────
            detail_resp, keywords_resp = await asyncio.gather(
                client.get(
                    f"https://api.themoviedb.org/3/movie/{tmdb_id}",
                    params={"api_key": TMDB_API_KEY},
                    timeout=5.0,
                ),
                client.get(
                    f"https://api.themoviedb.org/3/movie/{tmdb_id}/keywords",
                    params={"api_key": TMDB_API_KEY},
                    timeout=5.0,
                ),
            )

            detail_data = detail_resp.json()
            collection_id = detail_data.get("belongs_to_collection", {})
            collection_id = collection_id.get("id") if collection_id else None

            # Top 8 keywords for best matching
            keyword_ids = [
                str(k["id"])
                for k in keywords_resp.json().get("keywords", [])[:8]
            ]

            # ── Step 4: Fire all fetches concurrently ──────────────────
            tasks = {
                "similar": client.get(
                    f"https://api.themoviedb.org/3/movie/{tmdb_id}/similar",
                    params={"api_key": TMDB_API_KEY, "page": 1},
                    timeout=5.0,
                ),
                "recommendations": client.get(
                    f"https://api.themoviedb.org/3/movie/{tmdb_id}/recommendations",
                    params={"api_key": TMDB_API_KEY, "page": 1},
                    timeout=5.0,
                ),
                # Discover by keywords (most accurate for all movie types)
                "by_keywords": client.get(
                    "https://api.themoviedb.org/3/discover/movie",
                    params={
                        "api_key": TMDB_API_KEY,
                        "with_keywords": "|".join(keyword_ids) if keyword_ids else "",
                        "primary_release_date.gte": "1995-01-01",
                        "primary_release_date.lte": "2026-12-31",
                        "sort_by": "popularity.desc",
                        "vote_count.gte": 50,
                        "page": 1,
                    },
                    timeout=5.0,
                ) if keyword_ids else None,
                # Discover by genres (fallback for all movie types)
                "by_genres": client.get(
                    "https://api.themoviedb.org/3/discover/movie",
                    params={
                        "api_key": TMDB_API_KEY,
                        "with_genres": ",".join(str(g) for g in genre_ids),
                        "primary_release_date.gte": "1995-01-01",
                        "primary_release_date.lte": "2026-12-31",
                        "sort_by": "vote_average.desc",
                        "vote_count.gte": 200,
                        "page": 1,
                    },
                    timeout=5.0,
                ),
            }

            # Run all non-None tasks concurrently
            keys = [k for k, v in tasks.items() if v is not None]
            responses = await asyncio.gather(
                *[v for v in tasks.values() if v is not None],
                return_exceptions=True,
            )
            results_map = {
                k: (r.json().get("results", []) if not isinstance(r, Exception) else [])
                for k, r in zip(keys, responses)
            }

            similar_movies       = results_map.get("similar", [])
            recommended_movies   = results_map.get("recommendations", [])
            keyword_movies       = results_map.get("by_keywords", [])
            genre_movies         = results_map.get("by_genres", [])

            # ── Step 5: Fetch collection movies if exists ──────────────
            collection_movies = []
            if collection_id:
                col_resp = await client.get(
                    f"https://api.themoviedb.org/3/collection/{collection_id}",
                    params={"api_key": TMDB_API_KEY},
                    timeout=5.0,
                )
                collection_movies = col_resp.json().get("parts", [])

            # ── Step 6: Merge by priority ──────────────────────────────
            # Priority order:
            # 1. collection (same series - Iron Man 2, 3 / Harry Potter etc.)
            # 2. recommendations (TMDB curated)
            # 3. keywords (thematically similar - war movies, superhero etc.)
            # 4. similar (TMDB similar)
            # 5. genres (broad fallback)
            seen_ids = {tmdb_id}
            merged = []

            for m in (
                collection_movies
                + recommended_movies
                + keyword_movies
                + similar_movies
                + genre_movies
            ):
                mid = m.get("id")
                if not mid or mid in seen_ids:
                    continue
                seen_ids.add(mid)

                if not _in_year_range(m):
                    continue

                if not m.get("poster_path"):
                    continue

                merged.append(_format_movie(m, genre_map))

                if len(merged) >= 20:
                    break

            return {"movies": merged}

        except Exception as e:
            return {"movies": [], "error": str(e)}
