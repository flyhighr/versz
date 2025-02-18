import os
import random
import string
import time
import asyncio
import threading
import logging
from fastapi import FastAPI, UploadFile, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson.binary import Binary
import httpx
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
import schedule

MONGODB_URL = os.getenv("MONGODB_URL")
API_URL = os.getenv("API_URL")
PING_INTERVAL = int(os.getenv("PING_INTERVAL", "300"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
RATE_LIMIT = os.getenv("RATE_LIMIT", "5/minute")

logging.basicConfig(
    level=logging.INFO if ENVIRONMENT == "production" else logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGODB_URL)
db = client.gunsdb
files_collection = db.files
views_collection = db.views
async def generate_unique_url():
    while True:
        url = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
        
        existing = await files_collection.find_one({"url": url})
        if not existing:
            return url

async def increment_view_count(url: str) -> int:
    """Increment and return the view count for a given URL."""
    result = await views_collection.find_one_and_update(
        {"url": url},
        {"$inc": {"views": 1}},
        upsert=True,
        return_document=True
    )
    return result["views"]

async def migrate_existing_files():
    """Add view counts for existing files that don't have them."""
    async for file in files_collection.find({}):
        await views_collection.update_one(
            {"url": file["url"]},
            {"$setOnInsert": {"views": 0}},
            upsert=True
        )

@app.on_event("startup")
async def startup_event():
    """Run migrations when the application starts."""
    await migrate_existing_files()

@app.get("/health")
async def health_check(request: Request):
    return {"status": "healthy"}

@app.post("/upload")
async def upload_file(request: Request, file: UploadFile, custom_url: str = None):
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    
    if not file.filename.endswith('.html'):
        raise HTTPException(status_code=400, detail="Only HTML files are allowed")
    
    if custom_url:
        existing = await files_collection.find_one({"url": custom_url})
        if existing:
            raise HTTPException(status_code=400, detail="URL already taken")
        url = custom_url
    else:
        url = await generate_unique_url()
    
    document = {
        "url": url,
        "content": Binary(content),
        "filename": file.filename,
        "created_at": time.time()
    }
    
    await files_collection.insert_one(document)
    await views_collection.insert_one({"url": url, "views": 0})
    
    logger.info(f"File uploaded successfully: {file.filename} with URL: {url}")
    return {"url": url}

@app.get("/file/{url}")
async def get_file(request: Request, url: str):
    file = await files_collection.find_one({"url": url})
    if not file:
        logger.warning(f"File not found for URL: {url}")
        raise HTTPException(status_code=404, detail="File not found")
    
    views = await increment_view_count(url)
    
    logger.info(f"File retrieved successfully: {file['filename']} (Views: {views})")
    return {
        "content": file["content"].decode(),
        "filename": file["filename"],
        "views": views
    }

@app.get("/views/{url}")
async def get_views(request: Request, url: str):
    """Get the current view count for a URL."""
    view_data = await views_collection.find_one({"url": url})
    if not view_data:
        raise HTTPException(status_code=404, detail="URL not found")
    return {"views": view_data["views"]}

async def ping_self():
    async with httpx.AsyncClient() as client:
        try:
            await client.get(f"{API_URL}/health")
            logger.info("Keep-alive ping successful")
        except Exception as e:
            logger.error(f"Keep-alive ping failed: {e}")

def run_ping():
    asyncio.run(ping_self())

def start_ping_scheduler():
    schedule.every(PING_INTERVAL).seconds.do(run_ping)
    while True:
        schedule.run_pending()
        time.sleep(1)
        
ping_thread = threading.Thread(target=start_ping_scheduler, daemon=True)
ping_thread.start()

@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded for {request.client.host}")
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests"},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
