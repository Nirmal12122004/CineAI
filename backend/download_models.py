import os
import gdown

# ✅ Replace these with your actual Google Drive file IDs
MOVIES_FILE_ID = "1iiATIfV2O51b1u4N9y0GJHNVX_ZWyKs9"
SIMILARITY_FILE_ID = "1cLa072fDzh0JX8tsdr9VR5BWADPSyUKL"

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

movies_path = os.path.join(MODELS_DIR, "movies.pkl")
similarity_path = os.path.join(MODELS_DIR, "similarity.pkl")

if not os.path.exists(movies_path):
    print("Downloading movies.pkl...")
    gdown.download(f"https://drive.google.com/uc?id={MOVIES_FILE_ID}", movies_path, quiet=False)
    print("movies.pkl downloaded!")
else:
    print("movies.pkl already exists, skipping.")

if not os.path.exists(similarity_path):
    print("Downloading similarity.pkl...")
    gdown.download(f"https://drive.google.com/uc?id={SIMILARITY_FILE_ID}", similarity_path, quiet=False)
    print("similarity.pkl downloaded!")
else:
    print("similarity.pkl already exists, skipping.")
