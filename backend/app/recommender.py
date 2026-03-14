import os
import pickle
import httpx
import asyncio
import numpy as np
from rapidfuzz import process, fuzz
from dotenv import load_dotenv

# ✅ Load .env file for local development (ignored on Render)
load_dotenv()

# ✅ API key hidden - loaded from environment variable
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
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

# Precompute once at startup
titles: list[str] = movies["original_title"].str.lower().tolist()
titles_lower_series = movies["original_title"].str.lower()

_max_pop: float = movies["popularity_score"].max()

_popularity_scores: np.ndarray = movies["popularity_score"].to_numpy(dtype=np.float32)
_vote_averages: np.ndarray = movies["vote_average"].to_numpy(dtype=np.float32)
_original_titles: list[str] = movies["original_title"].tolist()
_titles_lower: list[str] = titles
_genres: list = movies["genres"].tolist()

# Precompute release years for filtering
def _extract_year(title: str) -> int | None:
    """Extract year from title like 'Iron Man (2008)' → 2008"""
    import re
    match = re.search(r'\((\d{4})\)', title)
    if match:
        return int(match.group(1))
    return None

_years: list[int | None] = [_extract_year(t) for t in _original_titles]


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
# Vectorised hybrid scoring
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
async def _recommend_async(movie_name: str, year_from: int | None = None, year_to: int | None = None) -> dict:
    movie_name = movie_name.lower().strip()

    best_match = process.extractOne(movie_name, titles, scorer=fuzz.WRatio)
    if not best_match or best_match[1] < 65:
        return {"input": None, "recommendations": []}

    matched_title = best_match[0]
    index = int(titles_lower_series[titles_lower_series == matched_title].index[0])

    hybrid_scores = _compute_hybrid_scores(index, movie_name)

    # Get more results when filtering by year so we have enough after filter
    fetch_count = 100 if (year_from or year_to) else 33

    top_indices = np.argpartition(hybrid_scores, -fetch_count)[-fetch_count:]
    top_indices = top_indices[np.argsort(hybrid_scores[top_indices])[::-1]]

    # Filter by year if specified
    filtered_indices = []
    for i in top_indices:
        idx = int(i)
        if idx == index:
            continue
        if year_from or year_to:
            year = _years[idx]
            if year is None:
                continue
            if year_from and year < year_from:
                continue
            if year_to and year > year_to:
                continue
        filtered_indices.append(idx)
        if len(filtered_indices) >= 80:  # limit to 80 results
            break

    input_title = _original_titles[index]
    all_titles_to_fetch = [input_title] + [_original_titles[i] for i in filtered_indices]

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
    for i, (poster, year) in zip(filtered_indices, results[1:]):
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


def recommend_with_year_filter(movie_name: str, year_from: int = 1995, year_to: int = 2026) -> dict:
    """Same ML model but filters results to year range"""
    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, _recommend_async(movie_name, year_from, year_to))
            return future.result()
    except RuntimeError:
        return asyncio.run(_recommend_async(movie_name, year_from, year_to))


async def recommend_async(movie_name: str) -> dict:
    return await _recommend_async(movie_name)
