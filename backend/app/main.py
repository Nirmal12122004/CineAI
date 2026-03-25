from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recommender import recommend, TMDB_API_KEY
from app.moviesmod_scraper import get_vegamovies_search
from rapidfuzz import process, fuzz
import httpx
import asyncio
import re
import os

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

MOOD_SYSTEM_PROMPT = """You are CineAI's Mood Analyst — a warm, witty movie expert who identifies the user's mood through a short conversation and recommends perfect movies.

Your job:
1. Ask 3-4 fun, creative questions ONE AT A TIME to understand the user's current mood, energy level, and what kind of experience they want.
2. Make questions feel like a fun quiz, not an interrogation. Be playful and conversational.
3. After 3-4 questions, analyze the mood and recommend exactly 5 movies.

Question examples (pick relevant ones):
- "If your current mood were weather, what would it be? ⛈️ stormy, ☀️ sunny, 🌫️ foggy, or 🌈 after-the-rain?"
- "Do you want to feel something deeply or just switch your brain off?"
- "Pick a vibe: 🔥 intense and gripping, 😂 laugh till you cry, 😢 have a good cry, 🤯 mind blown, or 💆 totally relaxed?"
- "How much mental energy do you have right now? Full tank, half tank, or running on fumes?"
- "What happened today? (in 5 words or less)"

After collecting enough info (3-4 exchanges), respond with EXACTLY this JSON format and nothing else:
{
  "mood_summary": "A poetic 1-sentence description of their mood",
  "recommendations": [
    {
      "title": "Movie Title",
      "year": "2010",
      "genre": "Thriller/Sci-Fi",
      "reason": "One sentence why this fits their mood perfectly"
    }
  ]
}

Keep responses SHORT and fun. One question at a time. Never ask multiple questions at once."""


def _fuzzy_correct(movie_name: str) -> str | None:
    cleaned = re.sub(r'[-_.]', ' ', movie_name).lower().strip()
    match = process.extractOne(cleaned, KNOWN_TITLES, scorer=fuzz.WRatio)
    if match and match[1] >= 70:
        return match[0]
    return None


def _clean_query(movie_name: str) -> list[str]:
    original = movie_name.strip()
    no_space = re.sub(r'[-_.\s]', '', original).lower()

    result = []

    if no_space in COMPOUND_FIXES:
        result.append(COMPOUND_FIXES[no_space])

    if original not in result:
        result.append(original)

    lower = original.lower()
    if lower not in result:
        result.append(lower)

    spaced = re.sub(r'[-_.]', ' ', original).strip()
    if spaced not in result:
        result.append(spaced)

    camel = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', original).strip()
    if camel not in result:
        result.append(camel)

    fuzzy = _fuzzy_correct(original)
    if fuzzy and fuzzy not in result:
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


@app.get("/movie-details-by-title/{movie_title}")
async def get_movie_details_by_title(movie_title: str):
    async with httpx.AsyncClient() as client:
        try:
            queries = _clean_query(movie_title)

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
                return {"error": "Movie not found"}

            details_resp, credits_resp = await asyncio.gather(
                client.get(
                    f"https://api.themoviedb.org/3/movie/{tmdb_id}",
                    params={"api_key": TMDB_API_KEY},
                    timeout=5.0,
                ),
                client.get(
                    f"https://api.themoviedb.org/3/movie/{tmdb_id}/credits",
                    params={"api_key": TMDB_API_KEY},
                    timeout=5.0,
                ),
            )

            d = details_resp.json()
            c = credits_resp.json()

            cast = [
                {
                    "name": p["name"],
                    "character": p["character"],
                    "photo": f"https://image.tmdb.org/t/p/w185{p['profile_path']}" if p.get("profile_path") else None,
                }
                for p in c.get("cast", [])[:6]
            ]

            director = next(
                (p["name"] for p in c.get("crew", []) if p["job"] == "Director"),
                "Unknown"
            )

            return {
                "id": d.get("id"),
                "title": d.get("title"),
                "overview": d.get("overview"),
                "poster": f"https://image.tmdb.org/t/p/w500{d['poster_path']}" if d.get("poster_path") else None,
                "backdrop": f"https://image.tmdb.org/t/p/w1280{d['backdrop_path']}" if d.get("backdrop_path") else None,
                "release_date": d.get("release_date"),
                "runtime": d.get("runtime"),
                "vote_average": round(d.get("vote_average", 0) / 2, 2),
                "genres": [g["name"] for g in d.get("genres", [])],
                "director": director,
                "cast": cast,
                "budget": d.get("budget"),
                "revenue": d.get("revenue"),
                "tagline": d.get("tagline"),
            }

        except Exception as e:
            return {"error": str(e)}


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


# ✅ Mood to Movie - Gemini AI (Fixed)
@app.post("/mood-chat")
async def mood_chat(request: dict):
    messages = request.get("messages", [])
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

    if not GEMINI_API_KEY:
        return {"response": None, "error": "GEMINI_API_KEY not set"}

    # ✅ Inject system prompt as first exchange (works with all Gemini models)
    gemini_messages = [
        {
            "role": "user",
            "parts": [{"text": f"[SYSTEM INSTRUCTIONS]\n{MOOD_SYSTEM_PROMPT}\n[END INSTRUCTIONS]\n\nAcknowledge you understand."}]
        },
        {
            "role": "model",
            "parts": [{"text": "Understood! I'll ask fun questions one at a time to find your perfect movie. 🎬"}]
        }
    ]

    # Add real conversation history
    for msg in messages:
        gemini_messages.append({
            "role": "user" if msg["role"] == "user" else "model",
            "parts": [{"text": msg["content"]}]
        })

    # If no user messages yet, trigger first question
    if not messages:
        gemini_messages.append({
            "role": "user",
            "parts": [{"text": "Ask me your first question!"}]
        })

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": gemini_messages,
                    "generationConfig": {
                        "maxOutputTokens": 1000,
                        "temperature": 0.8,
                    }
                },
                timeout=30.0,
            )
            data = response.json()

            # ✅ Better parsing with full error info
            candidates = data.get("candidates", [])
            if not candidates:
                return {"response": None, "error": f"No candidates: {data}"}

            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                return {"response": None, "error": f"No parts: {candidates[0]}"}

            text = parts[0].get("text", "").strip()
            if not text:
                return {"response": None, "error": f"Empty text: {parts}"}

            return {"response": text}

        except Exception as e:
            return {"response": None, "error": str(e)}
