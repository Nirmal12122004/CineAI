import pandas as pd
import numpy as np
import pickle
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Load dataset
movies = pd.read_csv("tmdb_movies_data.csv")

# Keep useful columns
movies = movies[['original_title', 'genres', 'overview', 'keywords', 
                 'cast', 'director', 'popularity', 'vote_average']]

movies.dropna(inplace=True)

# Clean function
def clean_text(x):
    return str(x).lower().replace(" ", "")

# Clean metadata
movies['genres'] = movies['genres'].apply(clean_text)
movies['keywords'] = movies['keywords'].apply(clean_text)
movies['cast'] = movies['cast'].apply(lambda x: " ".join(x.split("|")[:3]).lower())
movies['director'] = movies['director'].apply(clean_text)

# Create tags column
movies['tags'] = (
    movies['overview'].str.lower() + " " +
    movies['genres'] + " " +
    movies['keywords'] + " " +
    movies['cast'] + " " +
    movies['director']
)

# TF-IDF Vectorization
tfidf = TfidfVectorizer(stop_words="english", max_features=10000)
vectors = tfidf.fit_transform(movies['tags'])

# Cosine similarity
similarity = cosine_similarity(vectors)

# Normalize popularity for boosting
movies['popularity_score'] = (
    movies['vote_average'] * movies['popularity']
)

movies['popularity_score'] = (
    movies['popularity_score'] - movies['popularity_score'].min()
) / (
    movies['popularity_score'].max() - movies['popularity_score'].min()
)

# Save models
pickle.dump(movies, open("models/movies.pkl", "wb"))
pickle.dump(similarity, open("models/similarity.pkl", "wb"))

print("Hybrid model trained and saved successfully 🚀")