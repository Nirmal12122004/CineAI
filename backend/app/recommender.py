import os
import pickle
import httpx
import asyncio
import numpy as np
from rapidfuzz import process, fuzz

TMDB_API_KEY = "03fca15cd9a3eefa92614069b4832b46"
TMDB_BASE_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"

# Persistent async client (reused across requests)
_async_client: httpx.AsyncClient | None = None

# In-memory poster cache
poster_cache: dict[str, tuple] = {}

# ------------------------------------
# Load models at startup
# ------------------------------------

# ✅ Relative path - works on Render, Windows, Linux everywhere
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")

movies = pickle.load(open(os.path.join(MODELS_DIR, "movies.pkl"), "rb"))
similarity = pickle.load(open(os.path.join(MODELS_DIR, "similarity.pkl"), "rb"))

movies.reset_index(drop=True, inplace=True)

# Precompute once at startup — avoids repeated .str.lower() calls
titles: list[str] = movies["original_title"].str.lower().tolist()
titles_lower_series = movies["original_title"].str.lower()

# Precompute max popularity once (it never changes)
_max_pop: float = movies["popularity_score"].max()

# Precompute vectorised numpy arrays for hybrid scoring (avoid per-row .iloc)
_popularity_scores: np.ndarray = movies["popularity_score"].to_numpy(dtype=np.float32)
_vote_averages: np.ndarray = movies["vote_average"].to_numpy(dtype=np.float32)
_original_titles: list[str] = movies["original_title"].tolist()
_titles_lower: list[str] = titles  # alias
_genres: list = movies["genres"].tolist()


# ------------------------------------
# Async HTTP client management
# ------------------------------------
def _get_client() -> httpx.AsyncClient:
    global _async_client
    if _async_client is None or _async_client.is_closed:
        _async_client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
            timeout=httpx.Timeout(4.0),
        )
    return _async_client


# ------------------------------------
# Async TMDB fetch
# ------------------------------------
async def _fetch_movie_details_async(title: str) -> tuple:
    if title in poster_cache and poster_cache[title][0] is not None:
        return poster_cache[title]

    client = _get_client()

    for attempt in range(2):
        try:
            resp = await client.get(
                TMDB_BASE_URL,
                params={"api_key": TMDB_API_KEY, "query": title},
                timeout=5.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("results"):
                r = data["results"][0]
                pp = r.get("poster_path")
                rd = r.get("release_date")
                poster = f"{TMDB_IMG_BASE}{pp}" if pp else None
                year = int(rd[:4]) if rd else None
                poster_cache[title] = (poster, year)
                return poster, year
        except Exception:
            if attempt == 0:
                await asyncio.sleep(0.3)
            continue

    return None, None


# ------------------------------------
# Vectorised hybrid scoring (numpy)
# ------------------------------------
def _compute_hybrid_scores(index: int, movie_name_lower: str) -> np.ndarray:
    content_scores = similarity[index].astype(np.float32)
    content_weight = 0.85 * content_scores

    popularity_boost = 0.05 * (_popularity_scores / _max_pop)

    title_boost = np.array(
        [0.3 if movie_name_lower in t else 0.0 for t in _titles_lower],
        dtype=np.float32,
    )

    return content_weight + title_boost + popularity_boost


# ------------------------------------
# Core async recommend logic
# ------------------------------------
async def _recommend_async(movie_name: str) -> dict:
    movie_name = movie_name.lower().strip()

    best_match = process.extractOne(movie_name, titles, scorer=fuzz.WRatio)
    if not best_match or best_match[1] < 65:
        return {"input": None, "recommendations": []}

    matched_title = best_match[0]
    index = int(titles_lower_series[titles_lower_series == matched_title].index[0])

    hybrid_scores = _compute_hybrid_scores(index, movie_name)

    top_indices = np.argpartition(hybrid_scores, -33)[-33:]
    top_indices = top_indices[np.argsort(hybrid_scores[top_indices])[::-1]]
    recommendation_indices = [int(i) for i in top_indices if int(i) != index][:32]

    input_title = _original_titles[index]
    all_titles_to_fetch = [input_title] + [_original_titles[i] for i in recommendation_indices]

    results = await asyncio.gather(
        *[_fetch_movie_details_async(t) for t in all_titles_to_fetch]
    )

    input_poster, input_year = results[0]
    input_movie = {
        "id": int(index),
        "title": input_title,
        "poster": input_poster,
        "genre": _genres[index],
        "predicted_rating": round(float(_vote_averages[index]) / 2, 2),
        "year": input_year,
    }

    recommendations = []
    for i, (poster, year) in zip(recommendation_indices, results[1:]):
        recommendations.append({
            "id": i,
            "title": _original_titles[i],
            "poster": poster,
            "genre": _genres[i],
            "predicted_rating": round(float(_vote_averages[i]) / 2, 2),
            "year": year,
        })

    return {"input": input_movie, "recommendations": recommendations}


# ------------------------------------
# Public API — sync wrapper
# ------------------------------------
def recommend(movie_name: str) -> dict:
    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, _recommend_async(movie_name))
            return future.result()
    except RuntimeError:
        return asyncio.run(_recommend_async(movie_name))


async def recommend_async(movie_name: str) -> dict:
    return await _recommend_async(movie_name)