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
movies = pickle.load(open(r"D:\Nirmal(AIT)\Sem-8\CineAI - AI based movie recommendation system\backend\models\movies.pkl", "rb"))
similarity = pickle.load(open(r"D:\Nirmal(AIT)\Sem-8\CineAI - AI based movie recommendation system\backend\models\similarity.pkl", "rb"))

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
        # Connection pool with keep-alive handles bursts efficiently
        _async_client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
            timeout=httpx.Timeout(4.0),
        )
    return _async_client


# ------------------------------------
# Async TMDB fetch
# ------------------------------------
async def _fetch_movie_details_async(title: str) -> tuple:
    # Only return cached result if we actually got a poster
    if title in poster_cache and poster_cache[title][0] is not None:
        return poster_cache[title]

    client = _get_client()

    # Try up to 2 times in case of transient network error
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
                await asyncio.sleep(0.3)  # brief pause before retry
            continue

    # Only cache None if both attempts failed — don't permanently block retries
    return None, None


# ------------------------------------
# Vectorised hybrid scoring (numpy)
# ------------------------------------
def _compute_hybrid_scores(index: int, movie_name_lower: str) -> np.ndarray:
    """Return final hybrid scores for all movies as a numpy array."""
    content_scores = similarity[index].astype(np.float32)   # shape (N,)
    content_weight = 0.85 * content_scores

    popularity_boost = 0.05 * (_popularity_scores / _max_pop)

    # Title boost — vectorised with list comprehension (faster than per-row iloc)
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

    # Fuzzy match
    best_match = process.extractOne(movie_name, titles, scorer=fuzz.WRatio)
    if not best_match or best_match[1] < 65:
        return {"input": None, "recommendations": []}

    matched_title = best_match[0]
    index = int(titles_lower_series[titles_lower_series == matched_title].index[0])

    # Hybrid scores (fully vectorised — no Python loop over all movies)
    hybrid_scores = _compute_hybrid_scores(index, movie_name)

    # Top 33 indices (skip index 0 which is the movie itself)
    top_indices = np.argpartition(hybrid_scores, -33)[-33:]          # fast partial sort
    top_indices = top_indices[np.argsort(hybrid_scores[top_indices])[::-1]]  # sort top 33
    recommendation_indices = [int(i) for i in top_indices if int(i) != index][:32]

    # All TMDB calls fire concurrently (input movie + all recommendations)
    input_title = _original_titles[index]
    all_titles_to_fetch = [input_title] + [_original_titles[i] for i in recommendation_indices]

    # Fire all API calls at once
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
# (drop-in replacement for original recommend())
# ------------------------------------
def recommend(movie_name: str) -> dict:
    """Sync entry point. Works whether or not an event loop is running."""
    try:
        loop = asyncio.get_running_loop()
        # Inside an async framework (FastAPI, etc.) — return a coroutine instead
        # Callers should await recommend_async() directly in that case
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, _recommend_async(movie_name))
            return future.result()
    except RuntimeError:
        return asyncio.run(_recommend_async(movie_name))


async def recommend_async(movie_name: str) -> dict:
    """Async entry point — use this directly if your server is async (FastAPI)."""
    return await _recommend_async(movie_name)