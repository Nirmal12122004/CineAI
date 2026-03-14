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
    "indiana jones", "pirates of the caribbean",
    "lord of the rings", "lord of the rings fellowship",
    "the hobbit", "hobbit desolation of smaug",
    "titanic", "inception", "interstellar",
    "the matrix", "matrix reloaded", "matrix revolutions",
    "shrek", "shrek 2", "frozen", "frozen 2",
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

# ✅ Global compound fixes - checked FIRST
COMPOUND_FIXES = {
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


def _fuzzy_correct(movie_name: str) -> str | None:
    cleaned = re.sub(r'[-_.]', ' ', movie_name).lower().strip()
    match = process.extractOne(cleaned, KNOWN_TITLES, scorer=fuzz.WRatio)
    if match and match[1] >= 70:
        return match[0]
    return None


def _clean_query(movie_name: str) -> list[str]:
    original = movie_name.strip()
    no_space = re.sub(r'[-_.\s]', '', original).lower()

    # ✅ Result list - compound fix goes FIRST so TMDB gets correct query
    result = []

    # 1. Compound fix FIRST (ironman → iron man)
    if no_space in COMPOUND_FIXES:
        result.append(COMPOUND_FIXES[no_space])

    # 2. Original
    if original not in result:
        result.append(original)

    # 3. Lowercase original
    lower = original.lower()
    if lower not in result:
        result.append(lower)

    # 4. Replace hyphens/underscores with spaces
    spaced = re.sub(r'[-_.]', ' ', original).strip()
    if spaced not in result:
        result.append(spaced)

    # 5. CamelCase → Camel Case
    camel = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', original).strip()
    if camel not in result:
        result.append(camel)

    # 6. Fuzzy correction (iornman → iron man)
    fuzzy = _fuzzy_correct(original)
    if fuzzy and fuzzy not in result:
        # Put fuzzy second if no compound fix, else third
        insert_pos = 1 if not COMPOUND_FIXES.get(no_space) else 2
        result.insert(insert_pos, fuzzy)

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
            queries = _clean_query(movie_name)
            tmdb_id = None

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


@app.get("/similar-recent/{movie_name}")
async def get_similar_recent(movie_name: str):
    async with httpx.AsyncClient() as client:
        try:
            queries = _clean_query(movie_name)

            genre_resp = await client.get(
                "https://api.themoviedb.org/3/genre/movie/list",
                params={"api_key": TMDB_API_KEY},
                timeout=5.0,
            )
            genre_map = {g["id"]: g["name"] for g in genre_resp.json().get("genres", [])}

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

            keyword_ids = [
                str(k["id"])
                for k in keywords_resp.json().get("keywords", [])[:8]
            ]

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

            keys = [k for k, v in tasks.items() if v is not None]
            responses = await asyncio.gather(
                *[v for v in tasks.values() if v is not None],
                return_exceptions=True,
            )
            results_map = {
                k: (r.json().get("results", []) if not isinstance(r, Exception) else [])
                for k, r in zip(keys, responses)
            }

            similar_movies     = results_map.get("similar", [])
            recommended_movies = results_map.get("recommendations", [])
            keyword_movies     = results_map.get("by_keywords", [])
            genre_movies       = results_map.get("by_genres", [])

            collection_movies = []
            if collection_id:
                col_resp = await client.get(
                    f"https://api.themoviedb.org/3/collection/{collection_id}",
                    params={"api_key": TMDB_API_KEY},
                    timeout=5.0,
                )
                collection_movies = col_resp.json().get("parts", [])

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

                if len(merged) >= 80:
                    break

            return {"movies": merged}

        except Exception as e:
            return {"movies": [], "error": str(e)}
