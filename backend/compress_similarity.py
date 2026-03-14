# Run this locally: backend/compress_similarity.py
import pickle
import numpy as np

print("Loading similarity.pkl...")
similarity = pickle.load(open("models/similarity.pkl", "rb"))

print(f"Original dtype: {similarity.dtype}, size: {similarity.nbytes / 1e6:.1f} MB")

# Convert float64 → float16 (reduces size by 75%)
similarity_compressed = similarity.astype(np.float16)

print(f"Compressed dtype: {similarity_compressed.dtype}, size: {similarity_compressed.nbytes / 1e6:.1f} MB")

pickle.dump(similarity_compressed, open("models/similarity_compressed.pkl", "wb"))
print("Saved as similarity_compressed.pkl!")