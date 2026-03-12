def get_vegamovies_search(movie_name: str):
    """
    Returns Vegamovies homepage and movie name.
    Frontend copies movie name automatically for search.
    """

    return {
        "movie": movie_name,
        "vegamovies_url": "https://vegamoviesdl.com",
        "instruction": "Movie name copied. Paste it in Vegamovies search."
    }