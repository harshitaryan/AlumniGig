import os
from dotenv import load_dotenv

# Load the variables from .env into the system
load_dotenv()

# Access the key
api_key = os.getenv("GOOGLE_API_KEY")

if __name__ == "__main__":
    if api_key:
        print("API Key loaded successfully.")
        # You can now use api_key for your Google API calls
    else:
        print("GOOGLE_API_KEY not found in environment variables. Please check your .env file.")
