import os
import time
import glob
import glob
from pathlib import Path
from dotenv import load_dotenv

from google import genai
from google.genai import types
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is missing. Please add it to your .env file.")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables are missing.")

# Initialize Clients
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Constants
CHUNKS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chunks")
BATCH_SIZE = 5
MAX_RETRIES = 5
INITIAL_BACKOFF = 2  # seconds

def get_embedding_with_backoff(text: str) -> list[float]:
    """Generates an embedding with exponential backoff for rate limits."""
    retries = 0
    backoff = INITIAL_BACKOFF
    
    while retries <= MAX_RETRIES:
        try:
            try:
                # The modern GenAI SDK uses gemini-embedding-001 with configurable output dimensions
                result = gemini_client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=768)
                )
            except Exception as model_err:
                print(f"Error generating embedding: {model_err}")
                raise model_err
            
            # The new SDK returns a list of embeddings
            return result.embeddings[0].values
        except Exception as e:
            error_msg = str(e).lower()
            if "429" in error_msg or "quota" in error_msg or "rate limit" in error_msg:
                if retries == MAX_RETRIES:
                    print(f"Failed after {MAX_RETRIES} retries due to rate limits.")
                    raise e
                print(f"Rate limit hit. Retrying in {backoff} seconds... (Attempt {retries + 1}/{MAX_RETRIES})")
                time.sleep(backoff)
                retries += 1
                backoff *= 2  # Exponential backoff
            else:
                # If it's a different error, don't retry endlessly
                raise e

def process_and_upload_batch(batch_files: list[str]):
    """Processes a batch of text files and uploads them to Supabase."""
    records_to_insert = []
    
    for file_path in batch_files:
        try:
            filename = os.path.basename(file_path)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                
            if not content:
                print(f"Skipping empty file: {filename}")
                continue
                
            # Generate embedding
            embedding = get_embedding_with_backoff(content)
            
            # Prepare record
            record = {
                "content": content,
                "metadata": {
                    "article_name": filename,
                    "source": "Tunisian Legal Code"
                },
                "embedding": embedding
            }
            records_to_insert.append((filename, record))
            
        except Exception as e:
            print(f"Error processing file {file_path}: {e}")
            
    # Batch insert to Supabase
    if records_to_insert:
        try:
            records = [item[1] for item in records_to_insert]
            filenames = [item[0] for item in records_to_insert]
            
            # Insert into Supabase
            response = supabase.table("legal_knowledge").insert(records).execute()
            
            # Log success
            for name in filenames:
                print(f"Successfully processed and uploaded: {name}")
                
        except Exception as e:
            print(f"Error uploading batch to Supabase: {e}")

def main():
    if not os.path.exists(CHUNKS_DIR):
        print(f"Directory '{CHUNKS_DIR}' not found. Creating it now...")
        os.makedirs(CHUNKS_DIR)
        print(f"Please put your .txt files in the '{CHUNKS_DIR}' directory and run the script again.")
        return
        
    txt_files = glob.glob(os.path.join(CHUNKS_DIR, "*.txt"))
    
    if not txt_files:
        print(f"No .txt files found in the '{CHUNKS_DIR}' directory.")
        return
        
    print(f"Found {len(txt_files)} files. Starting ingestion...")
    
    # Process in batches
    for i in range(0, len(txt_files), BATCH_SIZE):
        batch = txt_files[i:i + BATCH_SIZE]
        print(f"\nProcessing batch {i // BATCH_SIZE + 1} ({len(batch)} files)...")
        process_and_upload_batch(batch)
        
        # Adding a small delay between batches to be nice to the API
        if i + BATCH_SIZE < len(txt_files):
            time.sleep(2)
            
    print("\nIngestion complete!")

if __name__ == "__main__":
    main()
