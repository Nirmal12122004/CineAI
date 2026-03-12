import pickle
import numpy as np
from collections import defaultdict

# Load trained model
movies = pickle.load(open(r"D:\Nirmal(AIT)\Sem-8\CineAI - AI based movie recommendation system\backend\models\movies.pkl", "rb"))
similarity = pickle.load(open(r"D:\Nirmal(AIT)\Sem-8\CineAI - AI based movie recommendation system\backend\models\similarity.pkl", "rb"))

movies = movies.reset_index(drop=True)

Ks = [10, 20, 30]  # multiple K values

# Preprocess metadata into sets
movies['genres_set'] = movies['genres'].apply(lambda x: set(x.split()))
movies['keywords_set'] = movies['keywords'].apply(lambda x: set(x.split()))
movies['cast_set'] = movies['cast'].apply(lambda x: set(x.split()))

# Precompute inverted indices for fast relevance lookup
genre_map = defaultdict(set)
keywords_map = defaultdict(set)
cast_map = defaultdict(set)

for idx, row in movies.iterrows():
    for g in row['genres_set']:
        genre_map[g].add(idx)
    for k in row['keywords_set']:
        keywords_map[k].add(idx)
    for c in row['cast_set']:
        cast_map[c].add(idx)

def get_relevant_movies(idx):
    row = movies.iloc[idx]
    genre_matches = set().union(*[genre_map[g] for g in row['genres_set']])
    keyword_matches = set().union(*[keywords_map[k] for k in row['keywords_set']])
    cast_matches = set().union(*[cast_map[c] for c in row['cast_set']])
    relevant = (genre_matches | keyword_matches | cast_matches) - {idx}
    return relevant

# Popularity scores
popularity_scores = movies['popularity_score'].values

# Top-K recommendations with popularity boost
def get_top_k_recommendations(movie_index, similarity_matrix, popularity_scores, k):
    sim_scores = list(enumerate(similarity_matrix[movie_index]))
    sim_scores = [(i, score * popularity_scores[i]) for i, score in sim_scores if i != movie_index]
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    return [i for i, score in sim_scores[:k]]

# Metric functions
def precision_at_k(recommended, relevant, k):
    recommended_k = recommended[:k]
    return len(set(recommended_k) & relevant) / k

def recall_at_k(recommended, relevant, k):
    recommended_k = recommended[:k]
    return len(set(recommended_k) & relevant) / len(relevant) if relevant else 0

def f1_score(precision, recall):
    return 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

def hit_rate(recommended, relevant, k):
    recommended_k = recommended[:k]
    return 1 if len(set(recommended_k) & relevant) > 0 else 0

# Store metrics for each K
metrics = {k: {'precision': [], 'recall': [], 'f1': [], 'hit': []} for k in Ks}

# Evaluate all movies
for idx in range(len(movies)):
    relevant_indices = get_relevant_movies(idx)
    for k in Ks:
        recommended_indices = get_top_k_recommendations(idx, similarity, popularity_scores, k)
        
        prec = precision_at_k(recommended_indices, relevant_indices, k)
        rec = recall_at_k(recommended_indices, relevant_indices, k)
        f1 = f1_score(prec, rec)
        hit = hit_rate(recommended_indices, relevant_indices, k)
        
        metrics[k]['precision'].append(prec)
        metrics[k]['recall'].append(rec)
        metrics[k]['f1'].append(f1)
        metrics[k]['hit'].append(hit)

# Print metrics for all K values
for k in Ks:
    print(f"\nMetrics for Top-{k} recommendations:")
    print("Precision@{}: {:.4f}".format(k, np.mean(metrics[k]['precision'])))
    print("Recall@{}: {:.4f}".format(k, np.mean(metrics[k]['recall'])))
    print("F1-Score@{}: {:.4f}".format(k, np.mean(metrics[k]['f1'])))
    print("Hit Rate@{}: {:.4f}".format(k, np.mean(metrics[k]['hit'])))