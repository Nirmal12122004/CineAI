from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recommender import recommend, TMDB_API_KEY
from app.moviesmod_scraper import get_vegamovies_search
from rapidfuzz import process, fuzz
import httpx
import asyncio
import re

app = FastAPI(title="AI Movie Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------
# Popular movie titles for fuzzy matching
# Add more as needed
# ------------------------------------
KNOWN_TITLES = [
    "iron man", "iron man 2", "iron man 3",
    "spider man", "spider man 2", "spider man 3",
    "spider-man no way home", "spider-man homecoming", "spider-man far from home",
    "avengers", "avengers endgame", "avengers infinity war", "avengers age of ultron",
    "captain america", "captain america civil war", "captain america winter soldier",
    "batman", "batman begins", "batman vs superman",
    "the dark knight", "the dark knight rises",
    "superman", "superman returns",
    "black panther", "black widow", "doctor strange",
    "thor", "thor ragnarok", "thor love and thunder",
    "ant man", "ant man and the wasp",
    "guardians of the galaxy", "guardians of the galaxy 2",
    "harry potter", "harry potter chamber of secrets",
    "harry potter prisoner of azkaban", "harry potter goblet of fire",
    "star wars", "star wars the force awakens", "star wars the last jedi",
    "fast and furious", "fast five", "furious 7",
    "john wick", "john wick 2", "john wick 3", "john wick 4",
    "transformers", "transformers age of extinction",
    "jurassic park", "jurassic world",
    "mission impossible", "mission impossible fallout",
    "indiana jones",
    "pirates of the caribbean",
    "lord of the rings", "lord of the rings fellowship",
    "the hobbit", "hobbit desolation of smaug",
    "titanic", "inception", "interstellar",
    "the matrix", "matrix reloaded", "matrix revolutions",
    "shrek", "shrek 2",
    "frozen", "frozen 2",
    "toy story", "toy story 2", "toy story 3",
    "finding nemo", "finding dory",
    "the lion king", "moana", "coco",
    "deadpool", "deadpool 2", "deadpool wolverine",
    "wolverine", "x-men", "x men days of future past",
    "wonder woman", "aquaman", "the flash",
    "joker", "suicide squad",
    "the godfather", "the godfather part 2",
    "pulp fiction", "fight club", "forrest gump",
    "the shawshank redemption", "goodfellas",
    "schindler list", "gladiator", "braveheart",
]


def _fuzzy_correct(movie_name: str) -> str | None:
    """
    Use rapidfuzz to find closest matching known title.
    Returns corrected title if confidence > 70, else None.
    """
    cleaned = re.sub(r'[-_.]', ' ', movie_name).lower().strip()
    match = process.extractOne(cleaned, KNOWN_TITLES, scorer=fuzz.WRatio)
    if match and match[1] >= 70:
        return match[0]
    return None


def _clean_query(movie_name: str) -> list[str]:
    """
    Generate multiple search query variations to maximize TMDB match.
    Handles: ironman, iron-man, IronMan, iornmna (spelling mistakes) etc.
    """
    original = movie_name.strip()
    queries = set()

    # 1. Original as-is
    queries.add(original)

    # 2. Replace hyphens/underscores/dots with spaces
    spaced = re.sub(r'[-_.]', ' ', original).strip()
    queries.add(spaced)

    # 3. CamelCase → Camel Case
    camel_spaced = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', original).strip()
    queries.add(camel_spaced)

    # 4. CamelCase after symbol replacement
    camel_spaced2 = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', spaced).strip()
    queries.add(camel_spaced2)

    # 5. Lowercase all
    queries.update([q.lower() for q in list(queries)])

    # 6. Known compound word fixes
    compound_fixes = {
        "ironman": "iron man",
        "spiderman": "spider man",
        "captainamerica": "captain america",
        "blackpanther": "black panther",
        "blackwidow": "black widow",
        "doctorstrange": "doctor strange",
        "antman": "ant man",
        "darknight": "dark knight",
        "harrypotter": "harry potter",
        "starwars": "star wars",
        "fastfurious": "fast and furious",
        "johnwick": "john wick",
        "guardiansofthegalaxy": "guardians of the galaxy",
        "transformers": "transformers",
        "jurassicpark": "jurassic park",
        "jurassicworld": "jurassic world",
        "missionimpossible": "mission impossible",
        "indianajones": "indiana jones",
        "piratesofthecaribbean": "pirates of the caribbean",
        "lordoftherings": "lord of the rings",
        "thehobbit": "the hobbit",
        "avengersinfinitywar": "avengers infinity war",
        "avengersendgame": "avengers endgame",
    }

    no_space = re.sub(r'[-_.\s]', '', original).lower()
    if no_space in compound_fixes:
        queries.add(compound_fixes[no_space])

    # 7. ✅ Fuzzy spelling correction (handles "iornmna" → "iron man")
    fuzzy_match = _fuzzy_correct(original)
    if fuzzy_match:
        queries.add(fuzzy_match)

    # Return unique non-empty queries, original first
    result = [original]
    for q in queries:
        if q and q != original and q not in result:
            result.append(q)

    # Put fuzzy match near the top if found (most likely correct)
    if fuzzy_match and fuzzy_match in result:
        result.remove(fuzzy_match)
        result.insert(1, fuzzy_match)

    return result

@app.get("/trailer/{movie_name}")
async def get_trailer(movie_name: str):
    async with httpx.AsyncClient() as client:
        try:
            queries = _clean_query(movie_name)
            tmdb_id = None

            # Try each query variation until we find a result
            for query in queries:
                search_resp = await client.get(
                    "https://api.themoviedb.org/3/search/movie",
                    params={"api_key": TMDB_API_KEY, "query": query},
                    timeout=5.0,
                )
                results = search_resp.json().get("results", [])
                if results:
                    tmdb_id = results[0]["id"]
                    break

            if not tmdb_id:
                return {"trailer_key": None}
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


def _clean_query(movie_name: str) -> list[str]:
    """
    Generate multiple search query variations to maximize TMDB match.
    Returns list of queries to try in order.
    Handles: ironman, iron-man, iron_man, IronMan, speling mistakes etc.
    """
    import re

    original = movie_name.strip()

    queries = set()

    # 1. Original as-is
    queries.add(original)

    # 2. Replace hyphens/underscores/dots with spaces
    spaced = re.sub(r'[-_.]', ' ', original).strip()
    queries.add(spaced)

    # 3. Insert space before capitals (CamelCase → Camel Case)
    camel_spaced = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', original).strip()
    queries.add(camel_spaced)

    # 4. Insert spaces between lowercase→uppercase transitions after replacing symbols
    camel_spaced2 = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', spaced).strip()
    queries.add(camel_spaced2)

    # 5. Lowercase all variations
    queries.update([q.lower() for q in list(queries)])

    # 6. Known compound word fixes (most common movie title patterns)
    compound_fixes = {
        "ironman": "iron man",
        "spiderman": "spider man",
        "batman": "batman",
        "superman": "superman",
        "captainamerica": "captain america",
        "blackpanther": "black panther",
        "blackwidow": "black widow",
        "doctorstrange": "doctor strange",
        "antman": "ant man",
        "darknight": "dark knight",
        "harrypotter": "harry potter",
        "starwars": "star wars",
        "fastfurious": "fast and furious",
        "johnwick": "john wick",
        "guardiansofthegalaxy": "guardians of the galaxy",
        "transformers": "transformers",
        "jurassicpark": "jurassic park",
        "jurassicworld": "jurassic world",
        "missionimpossible": "mission impossible",
        "indiajones": "indiana jones",
        "piratesofthecaribbean": "pirates of the caribbean",
        "lordoftherings": "lord of the rings",
        "thehobbit": "the hobbit",
        "avengersinfinitywar": "avengers infinity war",
        "avengersendgame": "avengers endgame",
    }

    # Check no-space version against known fixes
    no_space = re.sub(r'[-_.\s]', '', original).lower()
    if no_space in compound_fixes:
        queries.add(compound_fixes[no_space])

    # Return unique non-empty queries, original first
    result = [original]
    for q in queries:
        if q and q != original and q not in result:
            result.append(q)

    return result


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
            # ── Clean query first ──────────────────────────────────────
            queries = _clean_query(movie_name)

            # ── Step 1: Genre map ──────────────────────────────────────
            genre_resp = await client.get(
                "https://api.themoviedb.org/3/genre/movie/list",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            genre_map = {g["id"]: g["name"] for g in genre_resp.json().get("genres", [])}

            # ── Step 2: Search movie - try all query variations ─────────
            searched = None
            for query in queries:
                search_resp = await client.get(
                    "https://api.themoviedb.org/3/search/movie",
                    params={"api_key": TMDB_API_KEY, "query": query},
                    timeout=5.0,
                )
                results = search_resp.json().get("results", [])
                if results:
                    searched = results[0]
                    break

            if not searched:
                return {"movies": []}
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
