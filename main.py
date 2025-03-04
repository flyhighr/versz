import os
import random
import string
import time
import asyncio
import threading
import logging
import secrets
import hashlib
import json
from functools import lru_cache
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any, Union, Set
from contextlib import asynccontextmanager
from fastapi import File

from fastapi import FastAPI, UploadFile, HTTPException, status, Request, Depends, Form, Body, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr, constr, ValidationError, AnyHttpUrl, HttpUrl
from jose import JWTError, jwt
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, OperationFailure
from bson.binary import Binary
from bson.objectid import ObjectId
import httpx
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import schedule
import smtplib
from email.message import EmailMessage
from cachetools import TTLCache
import pytz
from dateutil.relativedelta import relativedelta

class Settings:
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    API_URL: str = os.getenv("API_URL", "http://localhost:8000")
    PING_INTERVAL: int = int(os.getenv("PING_INTERVAL", "300"))
    ALLOWED_ORIGINS: List[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")
    PENDING_REGISTRATION_EXPIRE_HOURS: int = 1
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "5/minute")
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(64))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    ALGORITHM: str = "HS256"
    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USERNAME: str = os.getenv("EMAIL_USERNAME", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", EMAIL_USERNAME)
    BCRYPT_ROUNDS: int = 12 if ENVIRONMENT == "production" else 4
    MAX_FILE_SIZE: int = 20 * 1024 * 1024  # 20MB
    MAX_PROFILE_PAGES: int = 5
    MAX_SOCIAL_LINKS: int = 10
    MAX_SONGS: int = 5
    MAX_TEMPLATES: int = 20
    MONGODB_MAX_POOL_SIZE: int = 100
    MONGODB_MIN_POOL_SIZE: int = 10
    VIEW_COOLDOWN_MINUTES: int = 30
    DEVICE_IDENTIFIER_TTL_DAYS: int = 30
    MAX_AVATAR_SIZE: int = 1024 * 1024  # 1MB
    PREVIEW_EXPIRATION_MINUTES: int = 30  # How long preview pages are valid
    DEFAULT_TAGS = {
        "early_supporter": {
            "icon": """<svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>""",
            "text": "Early Supporter",
            "icon_type": "svg"
        },
        "top_contributor": {
            "icon": "👑",
            "text": "Top Contributor",
            "icon_type": "emoji"
        }
    }
    DEFAULT_LAYOUT = "standard"
    DEFAULT_EFFECTS = ["typewriter", "fade-in", "bounce", "pulse", "none"]
    DEFAULT_BACKGROUND_TYPES = ["solid", "gradient", "image", "video"]
    DEFAULT_FONTS = [
        {
            "name": "Default",
            "value": "",
            "link": ""
        },
        {
            "name": "Roboto",
            "value": "'Roboto', sans-serif",
            "link": "<link href='https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap' rel='stylesheet'>"
        },
        {
            "name": "Open Sans",
            "value": "'Open Sans', sans-serif",
            "link": "<link href='https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap' rel='stylesheet'>"
        },
        {
            "name": "Montserrat",
            "value": "'Montserrat', sans-serif",
            "link": "<link href='https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap' rel='stylesheet'>"
        },
        {
            "name": "Lato",
            "value": "'Lato', sans-serif",
            "link": "<link href='https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap' rel='stylesheet'>"
        },
        {
            "name": "Playfair Display",
            "value": "'Playfair Display', serif",
            "link": "<link href='https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap' rel='stylesheet'>"
        }
    ]
    TIMEZONES = list(pytz.all_timezones)

settings = Settings()

class RateLimits:
    AUTH_LIMIT = "5/minute"
    UPLOAD_LIMIT = "10/minute" 
    READ_LIMIT = "30/minute" 
    MODIFY_LIMIT = "15/minute"  
    ADMIN_LIMIT = "60/minute"

# Logging configuration
logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG,
    format="%(asctime)s - %(levelname)s - [%(name)s] - %(process)d - %(thread)d - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log")
    ]
)
logger = logging.getLogger(__name__)

# Security configurations
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    default="bcrypt",
    bcrypt__rounds=12,
    truncate_error=False
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Custom Async Cache Implementation
class AsyncTTLCache:
    def __init__(self, ttl_seconds: int = 300):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl_seconds = ttl_seconds

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        if key in self.cache:
            entry = self.cache[key]
            if datetime.utcnow() < entry['expires_at']:
                return entry['data']
            else:
                del self.cache[key]
        return None

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        self.cache[key] = {
            'data': value,
            'expires_at': datetime.utcnow() + timedelta(seconds=self.ttl_seconds)
        }

    async def delete(self, key: str) -> None:
        self.cache.pop(key, None)

# Initialize caches
user_cache = AsyncTTLCache(ttl_seconds=300)
page_cache = TTLCache(maxsize=1000, ttl=300)
views_cache = TTLCache(maxsize=1000, ttl=300)
template_cache = TTLCache(maxsize=100, ttl=600)
preview_cache = TTLCache(maxsize=100, ttl=300)

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class SocialLink(BaseModel):
    platform: str
    url: str
    icon: Optional[str] = None
    display_name: Optional[str] = None

class Song(BaseModel):
    title: str
    artist: str
    cover_url: str
    youtube_url: str

class BackgroundConfig(BaseModel):
    type: str = Field(..., description="Type of background: solid, gradient, image, video")
    value: str = Field(..., description="Color code, gradient spec, or URL to image/video")
    opacity: float = Field(1.0, ge=0.0, le=1.0)

class ContainerStyle(BaseModel):
    enabled: bool = True
    background_color: Optional[str] = None
    gradient: Optional[str] = None
    opacity: float = Field(0.8, ge=0.0, le=1.0)
    border_radius: Optional[int] = None
    border_color: Optional[str] = None
    shadow: Optional[bool] = True

class PageLayout(BaseModel):
    type: str = Field(default="standard", description="Layout type")
    container_style: ContainerStyle = ContainerStyle()

class TextEffect(BaseModel):
    name: str
    speed: Optional[int] = None
    delay: Optional[int] = None

class FontConfig(BaseModel):
    name: str = "Default"
    value: str = ""
    link: str = ""

class TextStyleConfig(BaseModel):
    color: Optional[str] = None
    font: Optional[FontConfig] = None

class ProfilePage(BaseModel):
    page_id: Optional[str] = None
    url: str
    title: str
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_decoration: Optional[str] = None  # URL to decoration image
    background: BackgroundConfig
    layout: PageLayout = Field(default=PageLayout(type="standard"))
    social_links: List[SocialLink] = []
    songs: List[Song] = []
    show_joined_date: bool = True
    show_views: bool = True
    name_effect: Optional[TextEffect] = None
    bio_effect: Optional[TextEffect] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    custom_css: Optional[str] = None
    custom_js: Optional[str] = None
    name_style: Optional[TextStyleConfig] = None
    username_style: Optional[TextStyleConfig] = None

class PageUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_decoration: Optional[str] = None  # URL to decoration image
    background: Optional[BackgroundConfig] = None
    layout: Optional[PageLayout] = None
    social_links: Optional[List[SocialLink]] = None
    songs: Optional[List[Song]] = None
    show_joined_date: Optional[bool] = None
    show_views: Optional[bool] = None
    name_effect: Optional[TextEffect] = None
    bio_effect: Optional[TextEffect] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    custom_css: Optional[str] = None
    custom_js: Optional[str] = None
    name_style: Optional[TextStyleConfig] = None
    username_style: Optional[TextStyleConfig] = None

class PreviewRequest(BaseModel):
    page_data: ProfilePage

class Tag(BaseModel):
    name: str
    icon: str
    text: str
    icon_type: str = Field(
        default="emoji",
        description="Type of icon: 'emoji', 'svg', or 'image'"
    )

class DisplayPreferences(BaseModel):
    show_views: bool = True
    show_uuid: bool = True
    show_tags: bool = True
    show_joined_date: bool = True
    show_location: bool = True
    show_dob: bool = True
    show_gender: bool = True
    show_pronouns: bool = True
    show_timezone: bool = True
    default_layout: str = "standard"
    default_background: BackgroundConfig = BackgroundConfig(
        type="solid", 
        value="#ffffff"
    )
    default_name_style: TextStyleConfig = TextStyleConfig()
    default_username_style: TextStyleConfig = TextStyleConfig()

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: constr(min_length=8, max_length=64)  # type: ignore
    username: Optional[str] = None
    name: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v

class UserOnboarding(BaseModel):
    name: str
    avatar_url: Optional[str] = None
    username: str
    location: Optional[str] = None
    date_of_birth: Optional[str] = None  # Format: YYYY-MM-DD
    timezone: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    
    @validator('username')
    def validate_username(cls, v):
        if not v.isalnum() and not all(c.isalnum() or c == '_' for c in v):
            raise ValueError('Username can only contain alphanumeric characters and underscores')
        return v
    
    @validator('date_of_birth')
    def validate_date_of_birth(cls, v):
        if v:
            try:
                date.fromisoformat(v)
                return v
            except ValueError:
                raise ValueError('Invalid date format. Use YYYY-MM-DD')
        return v
    
    @validator('timezone')
    def validate_timezone(cls, v):
        if v and v not in pytz.all_timezones:
            raise ValueError('Invalid timezone')
        return v

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    user_number: int
    username: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_decoration: Optional[str] = None  # URL to decoration image
    is_verified: bool
    page_count: int
    joined_at: datetime
    tags: List[Tag] = []
    display_preferences: DisplayPreferences
    location: Optional[str] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    timezone: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    bio: Optional[str] = None

class UserPasswordReset(BaseModel):
    email: EmailStr

class UserPasswordChange(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: constr(min_length=8, max_length=64)  # type: ignore

class ViewRecord(BaseModel):
    url: str
    device_hash: str
    timestamp: datetime
    ip_address: str
    user_agent: str

class Template(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    preview_image: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    use_count: int = 0
    page_config: ProfilePage
    tags: List[str] = []

class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    preview_image: str
    created_by: str
    created_by_username: Optional[str] = None
    created_at: datetime
    use_count: int
    tags: List[str] = []

class URLCheckResponse(BaseModel):
    url: str
    available: bool

class PreviewResponse(BaseModel):
    preview_id: str
    expires_at: datetime

# Database connection
@asynccontextmanager
async def get_database() -> AsyncIOMotorDatabase:
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
        minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
        serverSelectionTimeoutMS=5000
    )
    try:
        await client.admin.command('ismaster')
        db = client.Versz_db
        yield db
    finally:
        client.close()

# FastAPI initialization
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Versz API", version="1.0.0")
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utility functions
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

async def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception as e:
        logger.error(f"Password hashing error: {str(e)}")
        raise ValueError("Error creating password hash")

def calculate_age(birth_date_str: str) -> int:
    """Calculate age from date of birth string (YYYY-MM-DD)"""
    if not birth_date_str:
        return None
    
    try:
        birth_date = date.fromisoformat(birth_date_str)
        today = date.today()
        return relativedelta(today, birth_date).years
    except Exception as e:
        logger.error(f"Age calculation error: {str(e)}")
        return None

async def send_email_async(to_email: str, subject: str, html_content: str) -> bool:
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_content, 'html'))

        max_retries = 3
        for attempt in range(max_retries):
            try:
                with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
                    server.starttls()
                    server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
                    server.send_message(msg)
                logger.info(f"Email sent successfully to {to_email}")
                return True
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(1 * (attempt + 1))
                
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {str(e)}")
        return False

async def get_user(email: str) -> Optional[Dict[str, Any]]:
    cache_key = f"user:{email}"
    cached_user = await user_cache.get(cache_key)
    if cached_user is not None:
        return cached_user
    
    async with get_database() as db:
        user = await db.users.find_one({"email": email})
        if user:
            await user_cache.set(cache_key, user)
        return user

async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    cache_key = f"username:{username}"
    cached_user = await user_cache.get(cache_key)
    if cached_user is not None:
        return cached_user
    
    async with get_database() as db:
        user = await db.users.find_one({"username": username})
        if user:
            await user_cache.set(cache_key, user)
        return user

async def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    try:
        user = await get_user(email)
        if not user:
            logger.info(f"Authentication failed: User not found - {email}")
            return None
        
        try:
            if not pwd_context.verify(password, user["hashed_password"]):
                logger.info(f"Authentication failed: Invalid password for user {email}")
                return None
        except ValueError as e:
            logger.error(f"Password verification error: {str(e)}")
            return None
            
        return user
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        return None

async def get_next_user_number(db: AsyncIOMotorDatabase) -> int:
    result = await db.users.find_one(
        filter={},
        sort=[("user_number", -1)],
        projection={"user_number": 1}
    )
    return (result["user_number"] + 1) if result else 1

async def is_url_available(db: AsyncIOMotorDatabase, url: str) -> bool:
    # Check if URL is taken by a page or a user
    if await db.profile_pages.find_one({"url": url}):
        return False
    if await db.users.find_one({"username": url}):
        return False
    return True

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    user = await get_user(token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_verified_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified"
        )
    return current_user

async def generate_device_identifier(request: Request) -> str:
    ip = request.client.host
    user_agent = request.headers.get("user-agent", "")
    accept_language = request.headers.get("accept-language", "")
    identifier = f"{ip}:{user_agent}:{accept_language}"
    return hashlib.sha256(identifier.encode()).hexdigest()

async def should_count_view(db: AsyncIOMotorDatabase, url: str, device_hash: str) -> bool:
    last_view = await db.view_records.find_one(
        {
            "url": url,
            "device_hash": device_hash
        },
        sort=[("timestamp", -1)]
    )
    
    if not last_view:
        return True
        
    last_view_time = last_view["timestamp"]
    time_since_last_view = datetime.utcnow() - last_view_time
    
    return time_since_last_view > timedelta(minutes=settings.VIEW_COOLDOWN_MINUTES)

async def cleanup_old_view_records():
    async with get_database() as db:
        cutoff_date = datetime.utcnow() - timedelta(days=settings.DEVICE_IDENTIFIER_TTL_DAYS)
        await db.view_records.delete_many({"timestamp": {"$lt": cutoff_date}})

async def increment_page_views(db: AsyncIOMotorDatabase, url: str, device_hash: str) -> int:
    """Increment the view count for a page if the view should be counted"""
    if await should_count_view(db, url, device_hash):
        view_record = ViewRecord(
            url=url,
            device_hash=device_hash,
            timestamp=datetime.utcnow(),
            ip_address="",  # Will be set by the caller
            user_agent=""   # Will be set by the caller
        )
        
        await db.view_records.insert_one(view_record.dict())
        
        result = await db.views.find_one_and_update(
            {"url": url},
            {"$inc": {"views": 1}},
            upsert=True,
            return_document=True
        )
        
        views = result["views"] if result else 0
        views_cache[f"views:{url}"] = views
        return views
    else:
        views_doc = await db.views.find_one({"url": url})
        views = views_doc["views"] if views_doc else 0
        return views

async def validate_avatar(avatar_url: str) -> bool:
    """Validate if the avatar URL is valid and the file is appropriate"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.head(avatar_url, follow_redirects=True)
            
            if response.status_code != 200:
                return False
                
            content_type = response.headers.get("content-type", "")
            content_length = int(response.headers.get("content-length", "0"))
            
            # Check if it's an image or a gif
            if not (content_type.startswith("image/") or content_type == "image/gif"):
                return False
                
            # Check if it's under the size limit
            if content_length > settings.MAX_AVATAR_SIZE:
                return False
                
            return True
    except Exception as e:
        logger.error(f"Error validating avatar: {str(e)}")
        return False

async def validate_decoration(decoration_url: str) -> bool:
    """Validate if the avatar decoration URL is valid and the file is appropriate"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.head(decoration_url, follow_redirects=True)
            
            if response.status_code != 200:
                return False
                
            content_type = response.headers.get("content-type", "")
            
            # Check if it's an image (including PNG with transparency) or a GIF
            if not (content_type.startswith("image/") or content_type == "image/gif"):
                return False
                
            return True
    except Exception as e:
        logger.error(f"Error validating decoration: {str(e)}")
        return False

async def validate_font(font_link: str) -> bool:
    """Validate if the font link is from Google Fonts or another trusted source"""
    if not font_link:
        return True
        
    trusted_domains = [
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        "use.typekit.net",
        "use.fontawesome.com"
    ]
    
    try:
        # Check if it's a valid link format
        if not font_link.startswith("<link") or "rel='stylesheet'" not in font_link and 'rel="stylesheet"' not in font_link:
            return False
            
        # Extract href value
        import re
        href_match = re.search(r'href=[\'"]([^\'"]+)[\'"]', font_link)
        if not href_match:
            return False
            
        font_url = href_match.group(1)
        
        # Check if from trusted domain
        from urllib.parse import urlparse
        parsed_url = urlparse(font_url)
        domain = parsed_url.netloc
        
        return any(domain == trusted for trusted in trusted_domains)
    except Exception as e:
        logger.error(f"Error validating font link: {str(e)}")
        return False

async def cleanup_expired_previews():
    """Cleanup function to remove expired preview pages"""
    async with get_database() as db:
        expired_time = datetime.utcnow()
        result = await db.page_previews.delete_many({
            "expires_at": {"$lt": expired_time}
        })
        if result.deleted_count > 0:
            logger.info(f"Cleaned up {result.deleted_count} expired preview pages")

def json_serialize(obj):
    """Convert MongoDB document to serializable format"""
    if isinstance(obj, dict):
        # Handle nested objects and ensure font configs are properly serialized
        result = {}
        for k, v in obj.items():
            # Ensure font links are included in the serialized output
            if k in ["name_style", "username_style"] and isinstance(v, dict):
                # Make sure font information is preserved
                if "font" in v and isinstance(v["font"], dict):
                    v["font"] = {
                        "name": v["font"].get("name", "Default"),
                        "value": v["font"].get("value", ""),
                        "link": v["font"].get("link", "")
                    }
            result[k] = json_serialize(v)
        return result
    elif isinstance(obj, list):
        return [json_serialize(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

# Endpoints
@app.get("/", response_class=HTMLResponse)
@limiter.limit(RateLimits.READ_LIMIT)
async def root(request: Request):
    return """
    <html>
        <head><title>Versz API</title></head>
        <body>
            <h1>Welcome to the Versz API</h1>
            <p>Create and customize your profile pages with our API.</p>
        </body>
    </html>
    """
@app.get("/health")
@limiter.limit(RateLimits.ADMIN_LIMIT)
async def health_check(request: Request):
    try:
        async with get_database() as db:
            await db.command("ping")
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )

@app.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
async def register_user(
    request: Request,
    background_tasks: BackgroundTasks,
    email: str = Body(...),
    password: str = Body(...),
    username: Optional[str] = Body(None),
    name: Optional[str] = Body(None)
) -> Dict[str, Any]:
    try:
        user = UserCreate(email=email, password=password, username=username, name=name)
    except ValidationError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    
    async with get_database() as db:
        user_number = await get_next_user_number(db)
        
        # Check if email is already registered
        existing_user = await db.users.find_one({"email": user.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Check if username is already taken
        if user.username:
            existing_username = await db.users.find_one({"username": user.username})
            if existing_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
        
        # Check pending registrations
        existing_pending = await db.pending_users.find_one({"email": user.email})
        if existing_pending:
            if existing_pending["expires_at"] < datetime.utcnow():
                await db.pending_users.delete_one({"email": user.email})
                await db.verification.delete_one({"email": user.email})
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "You have a pending registration. Please complete email verification or wait for it to expire before registering again.",
                        "status": "pending_verification"
                    }
                )
        
        user_id = str(user_number)
        
        verification_token = secrets.token_urlsafe(32)
        verification_link = f"https://versz.fun/verify?token={verification_token}"
        
        pending_user_data = {
            "id": user_id,
            "user_number": user_number,
            "email": user.email,
            "username": user.username,
            "name": user.name,
            "hashed_password": get_password_hash(user.password),
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "tags": [],
            "display_preferences": {
                "show_views": True,
                "show_uuid": True,
                "show_tags": True,
                "show_joined_date": True,
                "show_location": True,
                "show_dob": True,
                "show_gender": True,
                "show_pronouns": True,
                "show_timezone": True,
                "default_layout": "standard",
                "default_background": {
                    "type": "solid",
                    "value": "#ffffff"
                },
                "default_name_style": {
                    "color": "#000000",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "default_username_style": {
                    "color": "#555555",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                }
            }
        }
        
        verification_email = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    background-color: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #eeeeee;
                }}
                .content {{
                    padding: 30px 0;
                }}
                .button {{
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #4ecdc4;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .footer {{
                    text-align: center;
                    color: #666666;
                    font-size: 14px;
                    border-top: 1px solid #eeeeee;
                    padding-top: 20px;
                }}
                .warning {{
                    color: #856404;
                    background-color: #fff3cd;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 20px;
                    font-size: 14px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Verify Your Email Address</h1>
                </div>
                <div class="content">
                    <p>Thank you for registering! Please click the link below to verify your email:</p>
                    <a href="{verification_link}" class="button">Verify Email</a>
                    <p>This link will expire in 1 hour.</p>
                    <div class="warning">
                        Your registration will be canceled if you don't verify within 1 hour(s).
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await db.pending_users.insert_one(pending_user_data)
        await db.verification.insert_one({
            "user_id": user_id,
            "email": user.email,
            "token": verification_token,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        })
        
        background_tasks.add_task(
            send_email_async,
            user.email,
            "Verify Your Email",
            verification_email
        )
        
        return {
            "id": user_id,
            "user_number": user_number,
            "email": user.email,
            "username": user.username,
            "name": user.name,
            "avatar_url": None,
            "avatar_decoration": None,
            "is_verified": False,
            "page_count": 0,
            "joined_at": datetime.utcnow(),
            "tags": [],
            "display_preferences": DisplayPreferences(),
            "location": None,
            "date_of_birth": None,
            "age": None,
            "timezone": None,
            "gender": None,
            "pronouns": None
        }


@app.post("/change-password")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def change_password(
    request: Request,
    data: dict = Body(...),
    current_user: dict = Depends(get_current_verified_user)
):
    """Change user password"""
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both current and new password are required"
        )
    
    # Validate new password
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    
    if not any(c.isupper() for c in new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter"
        )
    
    if not any(c.islower() for c in new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter"
        )
    
    if not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number"
        )
    
    # Verify current password
    if not await verify_password(current_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    async with get_database() as db:
        hashed_password = get_password_hash(new_password)
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"hashed_password": hashed_password}}
        )
        
        # Clear cache
        await user_cache.delete(f"user:{current_user['email']}")
        if current_user.get("username"):
            await user_cache.delete(f"username:{current_user['username']}")
        
        return {"message": "Password changed successfully"}


@app.get("/search-templates")
@limiter.limit(RateLimits.READ_LIMIT)
async def search_templates(
    request: Request,
    q: str = Query(..., min_length=2, description="Search query"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50)
):
    """Search for templates by name, description, or tags"""
    async with get_database() as db:
        # Create text search query
        search_query = {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
                {"tags": {"$regex": q, "$options": "i"}}
            ]
        }
        
        # Calculate skip
        skip = (page - 1) * limit
        
        # Query templates
        templates = []
        cursor = db.templates.find(search_query).sort("use_count", -1).skip(skip).limit(limit)
        
        # Process templates and add username
        async for template in cursor:
            # Get username of template creator
            user = await db.users.find_one({"id": template["created_by"]})
            username = user.get("username") if user else None
            
            # Format template
            template["id"] = str(template["id"])
            if "_id" in template:
                template["_id"] = str(template["_id"])
            
            templates.append({
                **template,
                "created_by_username": username
            })
        
        # Get total count for pagination
        total_count = await db.templates.count_documents(search_query)
        total_pages = (total_count + limit - 1) // limit
        
        return {
            "templates": templates,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

@app.post("/resend-verification")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def resend_verification_email(
    request: Request,
    background_tasks: BackgroundTasks,
    data: dict = Body(...)
):
    """Resend verification email to user"""
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    async with get_database() as db:
        # Check if user exists and is not verified
        user = await db.users.find_one({"email": email})
        pending_user = await db.pending_users.find_one({"email": email})
        
        if not user and not pending_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email not found"
            )
        
        if user and user.get("is_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )
        
        # Delete any existing verification token for this email
        await db.verification.delete_one({"email": email})
        
        # Generate new verification token
        verification_token = secrets.token_urlsafe(32)
        verification_link = f"https://versz.fun/verify?token={verification_token}"
        
        # Store verification token
        await db.verification.insert_one({
            "email": email,
            "token": verification_token,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        })
        
        # Send verification email
        verification_email = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    background-color: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #eeeeee;
                }}
                .content {{
                    padding: 30px 0;
                }}
                .button {{
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #4ecdc4;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    text-align: center;
                    margin: 20px 0;
                }}
                .footer {{
                    text-align: center;
                    color: #666666;
                    font-size: 14px;
                    border-top: 1px solid #eeeeee;
                    padding-top: 20px;
                }}
                .warning {{
                    color: #856404;
                    background-color: #fff3cd;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 20px;
                    font-size: 14px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Verify Your Email Address</h1>
                </div>
                <div class="content">
                    <p>Here's your new verification link:</p>
                    <a href="{verification_link}" class="button">Verify Email</a>
                    <p>This link will expire in 1 hour.</p>
                    <div class="warning">
                        Please verify your email within 1 hour to complete the registration process.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        background_tasks.add_task(
            send_email_async,
            email,
            "Verify Your Email",
            verification_email
        )
        
        return {"message": "Verification email sent"}

@app.get("/verify")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def verify_email(request: Request, token: str):
    async with get_database() as db:
        verification = await db.verification.find_one({
            "token": token,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        if not verification:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification link"
            )
            
        pending_user = await db.pending_users.find_one({"email": verification["email"]})
        if not pending_user:
            # Check if the user is already in the main users collection
            user = await db.users.find_one({"email": verification["email"]})
            if user:
                # Just update the verified status if the user exists
                await db.users.update_one(
                    {"email": verification["email"]},
                    {"$set": {"is_verified": True}}
                )
                await db.verification.delete_one({"email": verification["email"]})
                await user_cache.delete(f"user:{verification['email']}")
                return {"message": "Email verified successfully"}
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration expired or not found"
                )
            
        user_data = {
            "id": pending_user["id"],
            "user_number": pending_user["user_number"],
            "email": verification["email"],
            "username": pending_user.get("username"),
            "name": pending_user.get("name"),
            "avatar_url": pending_user.get("avatar_url"),
            "avatar_decoration": pending_user.get("avatar_decoration"),
            "hashed_password": pending_user["hashed_password"],
            "is_active": True,
            "is_verified": True,
            "joined_at": pending_user["created_at"],
            "tags": pending_user.get("tags", []),
            "display_preferences": pending_user.get("display_preferences", {
                "show_views": True,
                "show_uuid": True,
                "show_tags": True,
                "show_joined_date": True,
                "show_location": True,
                "show_dob": True,
                "show_gender": True,
                "show_pronouns": True,
                "show_timezone": True,
                "default_layout": "standard",
                "default_background": {
                    "type": "solid",
                    "value": "#ffffff"
                },
                "default_name_style": {
                    "color": "#000000",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "default_username_style": {
                    "color": "#555555",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                }
            }),
            "location": pending_user.get("location"),
            "date_of_birth": pending_user.get("date_of_birth"),
            "timezone": pending_user.get("timezone"),
            "gender": pending_user.get("gender"),
            "pronouns": pending_user.get("pronouns")
        }
        
        await db.users.insert_one(user_data)
        await db.pending_users.delete_one({"email": verification["email"]})
        await db.verification.delete_one({"email": verification["email"]})
        await user_cache.delete(f"user:{verification['email']}")
        
        return {"message": "Email verified successfully"}

@app.post("/token")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        user = await authenticate_user(form_data.username, form_data.password)
        if not user:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Incorrect email or password",
                    "headers": {"WWW-Authenticate": "Bearer"}
                }
            )
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"]},
            expires_delta=access_token_expires
        )
        
        # Count pages
        async with get_database() as db:
            page_count = await db.profile_pages.count_documents({"user_id": user["id"]})
        
        # Calculate age if date_of_birth is present
        age = None
        if user.get("date_of_birth"):
            age = calculate_age(user["date_of_birth"])
            
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "is_verified": user.get("is_verified", False),
            "id": user["id"],
            "user_number": user.get("user_number"),
            "email": user["email"],
            "username": user.get("username"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "avatar_decoration": user.get("avatar_decoration"),
            "page_count": page_count,
            "joined_at": user.get("joined_at", datetime.utcnow()),
            "tags": user.get("tags", []),
            "display_preferences": user.get("display_preferences", {
                "show_views": True,
                "show_uuid": True,
                "show_tags": True,
                "show_joined_date": True,
                "show_location": True,
                "show_dob": True,
                "show_gender": True,
                "show_pronouns": True,
                "show_timezone": True,
                "default_layout": "standard",
                "default_background": {
                    "type": "solid",
                    "value": "#ffffff"
                },
                "default_name_style": {
                    "color": "#000000",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "default_username_style": {
                    "color": "#555555",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                }
            }),
            "location": user.get("location"),
            "date_of_birth": user.get("date_of_birth"),
            "age": age,
            "timezone": user.get("timezone"),
            "gender": user.get("gender"),
            "pronouns": user.get("pronouns")
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An error occurred during login. Please try again."}
        )

@app.post("/request-password-reset")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def request_password_reset(
    request: Request,
    background_tasks: BackgroundTasks,
    reset_request: UserPasswordReset
):
    async with get_database() as db:
        user = await db.users.find_one({"email": reset_request.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        reset_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) 
                            for _ in range(8))
        
        await db.password_reset.insert_one({
            "email": reset_request.email,
            "code": reset_code,
            "expires_at": datetime.utcnow() + timedelta(minutes=30)
        })
        
        reset_email = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    background-color: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #eeeeee;
                }}
                .logo {{
                    width: 120px;
                    height: auto;
                    margin-bottom: 20px;
                }}
                h1 {{
                    color: #2c3e50;
                    font-size: 24px;
                    margin: 0;
                    padding: 0;
                }}
                .content {{
                    padding: 30px 0;
                }}
                .code {{
                    background-color: #f8f9fa;
                    color: #2c3e50;
                    font-size: 32px;
                    font-weight: bold;
                    text-align: center;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 4px;
                    letter-spacing: 5px;
                }}
                .footer {{
                    text-align: center;
                    color: #666666;
                    font-size: 14px;
                    border-top: 1px solid #eeeeee;
                    padding-top: 20px;
                }}
                .security-notice {{
                    background-color: #e8f4fd;
                    padding: 15px;
                    border-radius: 4px;
                    margin-top: 20px;
                    font-size: 14px;
                    color: #0d47a1;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Reset Your Password</h1>
                </div>
                <div class="content">
                    <p>We received a request to reset your password. Use the following code to complete the password reset:</p>
                    <div class="code">{reset_code}</div>
                    <p>This code will expire in 30 minutes.</p>
                    <div class="security-notice">
                        If you didn't request this password reset, please ignore this email or contact support if you have concerns about your account security.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        background_tasks.add_task(
            send_email_async,
            reset_request.email,
            "Password Reset Request",
            reset_email
        )
        
        return {"message": "Password reset email sent"}

@app.post("/reset-password")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def reset_password(request: Request, reset_data: UserPasswordChange):
    async with get_database() as db:
        reset_record = await db.password_reset.find_one({
            "email": reset_data.email,
            "code": reset_data.reset_code,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not reset_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset code"
            )
        
        hashed_password = get_password_hash(reset_data.new_password)
        await db.users.update_one(
            {"email": reset_data.email},
            {"$set": {"hashed_password": hashed_password}}
        )
        
        await db.password_reset.delete_one({"email": reset_data.email})
        await user_cache.delete(f"user:{reset_data.email}")
        
        return {"message": "Password reset successfully"}

@app.get("/me", response_model=UserResponse)
@limiter.limit(RateLimits.READ_LIMIT)
async def read_users_me(request: Request, current_user: dict = Depends(get_current_user)):
    async with get_database() as db:
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        
        display_prefs = current_user.get("display_preferences", {
            "show_views": True,
            "show_uuid": True,
            "show_tags": True,
            "show_joined_date": True,
            "show_location": True,
            "show_dob": True,
            "show_gender": True,
            "show_pronouns": True,
            "show_timezone": True,
            "default_layout": "standard",
            "default_background": {
                "type": "solid",
                "value": "#ffffff"
            },
            "default_name_style": {
                "color": "#000000",
                "font": {
                    "name": "Default",
                    "value": "",
                    "link": ""
                }
            },
            "default_username_style": {
                "color": "#555555",
                "font": {
                    "name": "Default",
                    "value": "",
                    "link": ""
                }
            }
        })
        
        # Calculate age if date_of_birth is present
        age = None
        if current_user.get("date_of_birth"):
            age = calculate_age(current_user["date_of_birth"])
        
        return {
            "id": current_user["id"],
            "user_number": current_user.get("user_number"),
            "email": current_user["email"],
            "username": current_user.get("username"),
            "name": current_user.get("name"),
            "avatar_url": current_user.get("avatar_url"),
            "avatar_decoration": current_user.get("avatar_decoration"),
            "is_verified": current_user.get("is_verified", False),
            "page_count": page_count,
            "joined_at": current_user.get("joined_at", datetime.utcnow()),
            "tags": current_user.get("tags", []),
            "display_preferences": display_prefs,
            "location": current_user.get("location"),
            "date_of_birth": current_user.get("date_of_birth"),
            "age": age,
            "timezone": current_user.get("timezone"),
            "gender": current_user.get("gender"),
            "pronouns": current_user.get("pronouns"),
            "bio": current_user.get("bio")
        }

@app.put("/onboarding", response_model=UserResponse)
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def complete_onboarding(
    request: Request,
    onboarding_data: UserOnboarding,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check if username is already taken by another user
        if onboarding_data.username:
            existing_user = await db.users.find_one({
                "username": onboarding_data.username,
                "id": {"$ne": current_user["id"]}
            })
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )
        
        # Validate avatar URL if provided
        if onboarding_data.avatar_url and not await validate_avatar(onboarding_data.avatar_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid avatar URL or file too large (max 1MB)"
            )
        
        # Calculate age from date of birth if provided
        age = None
        if onboarding_data.date_of_birth:
            age = calculate_age(onboarding_data.date_of_birth)
        
        # Validate timezone if provided
        if onboarding_data.timezone and onboarding_data.timezone not in settings.TIMEZONES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timezone"
            )
        
        # Update user information
        update_data = {
            "username": onboarding_data.username,
            "name": onboarding_data.name,
            "avatar_url": onboarding_data.avatar_url,
            "location": onboarding_data.location,
            "date_of_birth": onboarding_data.date_of_birth,
            "timezone": onboarding_data.timezone,
            "gender": onboarding_data.gender,
            "pronouns": onboarding_data.pronouns,
            "onboarding_completed": True
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_data}
        )
        
        # Create default profile page if user doesn't have any
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        
        if page_count == 0:
            default_page = {
                "user_id": current_user["id"],
                "page_id": str(ObjectId()),
                "url": onboarding_data.username,
                "title": f"{onboarding_data.name}'s Page",
                "name": onboarding_data.name,
                "avatar_url": onboarding_data.avatar_url,
                "avatar_decoration": None,
                "bio": "",
                "background": {
                    "type": "solid",
                    "value": "#ffffff",
                    "opacity": 1.0
                },
                "layout": {
                    "type": "standard",
                    "container_style": {
                        "enabled": True,
                        "background_color": "#ffffff",
                        "opacity": 0.8,
                        "border_radius": 10,
                        "shadow": True
                    }
                },
                "social_links": [],
                "songs": [],
                "show_joined_date": True,
                "show_views": True,
                "created_at": datetime.utcnow(),
                "name_style": {
                    "color": "#000000",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "username_style": {
                    "color": "#555555",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "timezone": onboarding_data.timezone
            }
            
            await db.profile_pages.insert_one(default_page)
            
            # Initialize views counter
            await db.views.insert_one({
                "url": onboarding_data.username,
                "views": 0
            })
            
        # Clear cache
        await user_cache.delete(f"user:{current_user['email']}")
        if current_user.get("username"):
            await user_cache.delete(f"username:{current_user['username']}")
        
        # Get updated user
        updated_user = await db.users.find_one({"id": current_user["id"]})
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        
        # Calculate age
        age = None
        if updated_user.get("date_of_birth"):
            age = calculate_age(updated_user["date_of_birth"])
        
        return {
            "id": updated_user["id"],
            "user_number": updated_user.get("user_number"),
            "email": updated_user["email"],
            "username": updated_user.get("username"),
            "name": updated_user.get("name"),
            "avatar_url": updated_user.get("avatar_url"),
            "avatar_decoration": updated_user.get("avatar_decoration"),
            "is_verified": updated_user.get("is_verified", False),
            "page_count": page_count,
            "joined_at": updated_user.get("joined_at", datetime.utcnow()),
            "tags": updated_user.get("tags", []),
            "display_preferences": updated_user.get("display_preferences", DisplayPreferences().dict()),
            "location": updated_user.get("location"),
            "date_of_birth": updated_user.get("date_of_birth"),
            "age": age,
            "timezone": updated_user.get("timezone"),
            "gender": updated_user.get("gender"),
            "pronouns": updated_user.get("pronouns")
        }

@app.get("/check-url")
@limiter.limit(RateLimits.READ_LIMIT)
async def check_url_availability(request: Request, url: str):
    RESERVED_WORDS = [
        "api", "admin", "login", "register", "verify", "reset", "password",
        "dashboard", "profile", "settings", "terms", "privacy", "about",
        "contact", "help", "support", "templates", "explore", "discover",
        "trending", "popular", "new", "featured", "me", "user", "users",
        "account", "accounts", "auth", "billing", "upgrade", "premium"
    ]
    
    # Check for reserved words
    if url.lower() in RESERVED_WORDS:
        return {"url": url, "available": False}
    
    # Check for valid characters
    if not url.isalnum() and not all(c.isalnum() or c == '_' for c in url):
        return {"url": url, "available": False}
    
    # Check database
    async with get_database() as db:
        available = await is_url_available(db, url)
        return {"url": url, "available": available}

@app.post("/pages", response_model=ProfilePage)
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def create_profile_page(
    request: Request,
    page_data: ProfilePage,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check if user has reached max pages
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        if page_count >= settings.MAX_PROFILE_PAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_PROFILE_PAGES} profile pages"
            )
        
        # Check URL availability
        if not await is_url_available(db, page_data.url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL already taken"
            )
        
        # Validate avatar URL if provided
        if page_data.avatar_url and not await validate_avatar(page_data.avatar_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid avatar URL or file too large (max 1MB)"
            )
            
        # Validate avatar decoration if provided
        if page_data.avatar_decoration and not await validate_decoration(page_data.avatar_decoration):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid avatar decoration URL"
            )
            
        # Validate custom fonts if provided
        if page_data.name_style and page_data.name_style.font and page_data.name_style.font.link:
            if not await validate_font(page_data.name_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for name"
                )
                
        if page_data.username_style and page_data.username_style.font and page_data.username_style.font.link:
            if not await validate_font(page_data.username_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for username"
                )
        
        # Generate page ID
        page_id = str(ObjectId())
        
        # Prepare page data for insertion
        page_dict = page_data.dict(exclude={"page_id"})
        page_dict["page_id"] = page_id
        page_dict["user_id"] = current_user["id"]
        page_dict["created_at"] = datetime.utcnow()
        
        # Use timezone from user if not specified in page
        if not page_dict.get("timezone") and current_user.get("timezone"):
            page_dict["timezone"] = current_user["timezone"]
        
        # Initialize views counter
        await db.views.insert_one({
            "url": page_data.url,
            "views": 0
        })
        
        # Insert page
        await db.profile_pages.insert_one(page_dict)
        
        return {**page_data.dict(), "page_id": page_id}

@app.get("/pages", response_model=List[ProfilePage])
@limiter.limit(RateLimits.READ_LIMIT)
async def get_user_pages(
    request: Request,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        pages = []
        async for page in db.profile_pages.find({"user_id": current_user["id"]}):
            # Convert ObjectId to string
            if "_id" in page:
                page["_id"] = str(page["_id"])
            pages.append(page)
        
        return pages

@app.get("/pages/{page_id}", response_model=ProfilePage)
@limiter.limit(RateLimits.READ_LIMIT)
async def get_page_by_id(
    request: Request,
    page_id: str,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        page = await db.profile_pages.find_one({
            "page_id": page_id,
            "user_id": current_user["id"]
        })
        
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found"
            )
        
        # Convert ObjectId to string
        if "_id" in page:
            page["_id"] = str(page["_id"])
        
        return page

@app.put("/pages/{page_id}", response_model=ProfilePage)
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_profile_page(
    request: Request,
    page_id: str,
    page_update: PageUpdate,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check if the page exists and belongs to the user
        existing_page = await db.profile_pages.find_one({
            "page_id": page_id,
            "user_id": current_user["id"]
        })
        
        if not existing_page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found or you don't have permission to update it"
            )
        
        # Validate avatar URL if provided
        if page_update.avatar_url and not await validate_avatar(page_update.avatar_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid avatar URL or file too large (max 1MB)"
            )
            
        # Validate avatar decoration if provided
        if page_update.avatar_decoration and not await validate_decoration(page_update.avatar_decoration):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid avatar decoration URL"
            )
            
        # Validate custom fonts if provided
        if page_update.name_style and page_update.name_style.font and page_update.name_style.font.link:
            if not await validate_font(page_update.name_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for name"
                )
                
        if page_update.username_style and page_update.username_style.font and page_update.username_style.font.link:
            if not await validate_font(page_update.username_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for username"
                )
        
        # Validate timezone if provided
        if page_update.timezone and page_update.timezone not in settings.TIMEZONES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timezone"
            )
        
        # Prepare update data
        update_data = page_update.dict(exclude_unset=True)
        
        # If URL is being updated, check availability
        if "url" in update_data and update_data["url"] != existing_page["url"]:
            if not await is_url_available(db, update_data["url"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL already taken"
                )
            
            # Update views collection with new URL
            await db.views.update_one(
                {"url": existing_page["url"]},
                {"$set": {"url": update_data["url"]}}
            )
        
        # Update the page
        await db.profile_pages.update_one(
            {"page_id": page_id},
            {"$set": {**update_data, "updated_at": datetime.utcnow()}}
        )
        
        # Get updated page
        updated_page = await db.profile_pages.find_one({"page_id": page_id})

        # Convert ObjectId to string
        if "_id" in updated_page:
            updated_page["_id"] = str(updated_page["_id"])
        
        return updated_page

@app.post("/preview-page", response_model=PreviewResponse)
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def create_page_preview(
    request: Request,
    preview_data: ProfilePage,
    current_user: dict = Depends(get_current_verified_user)
):
    """Create a temporary preview of a page without saving it permanently"""
    
    # Validate custom fonts if provided
    if preview_data.name_style and preview_data.name_style.font and preview_data.name_style.font.link:
        if not await validate_font(preview_data.name_style.font.link):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid font link for name"
            )
            
    if preview_data.username_style and preview_data.username_style.font and preview_data.username_style.font.link:
        if not await validate_font(preview_data.username_style.font.link):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid font link for username"
            )
    
    # Generate preview ID
    preview_id = str(ObjectId())
    expires_at = datetime.utcnow() + timedelta(minutes=settings.PREVIEW_EXPIRATION_MINUTES)
    
    # Prepare page data for preview
    preview_dict = preview_data.dict(exclude={"page_id"})
    preview_dict["preview_id"] = preview_id
    preview_dict["user_id"] = current_user["id"]
    preview_dict["created_at"] = datetime.utcnow()
    preview_dict["expires_at"] = expires_at
    preview_dict["is_preview"] = True
    
    async with get_database() as db:
        # Insert preview
        await db.page_previews.insert_one(preview_dict)
        
        # Add to cache
        preview_cache[f"preview:{preview_id}"] = preview_dict
        
        return {
            "preview_id": preview_id,
            "expires_at": expires_at
        }

class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        def default_serializer(obj):
            if isinstance(obj, ObjectId):
                return str(obj)
            elif isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            default=default_serializer,
        ).encode("utf-8")

@app.get("/preview/{preview_id}", response_class=CustomJSONResponse)
@limiter.limit(RateLimits.READ_LIMIT)
async def get_page_preview(request: Request, preview_id: str):
    """Get a temporary page preview by its ID"""
    
    # Try to get from cache first
    cache_key = f"preview:{preview_id}"
    if cache_key in preview_cache:
        preview_data = preview_cache[cache_key]
        
        # Check if expired
        if preview_data.get("expires_at", datetime.min) < datetime.utcnow():
            preview_cache.pop(cache_key, None)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preview expired or not found"
            )
        
        # Convert ObjectId to string before returning
        preview_data = json_serialize(preview_data)
        return preview_data
    
    # If not in cache, get from database
    async with get_database() as db:
        preview = await db.page_previews.find_one({
            "preview_id": preview_id,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not preview:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preview expired or not found"
            )
        
        # Convert MongoDB document to serializable format
        preview = json_serialize(preview)
            
        # Update cache
        preview_cache[cache_key] = preview
        
        return preview

@app.post("/update-profile")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_user_profile(
    request: Request,
    profile_data: dict = Body(...),
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Extract data from request body
        username = profile_data.get("username")
        name = profile_data.get("name")
        avatar_url = profile_data.get("avatar_url")
        avatar_decoration = profile_data.get("avatar_decoration")
        location = profile_data.get("location")
        date_of_birth = profile_data.get("date_of_birth")
        timezone = profile_data.get("timezone")
        gender = profile_data.get("gender")
        pronouns = profile_data.get("pronouns")
        bio = profile_data.get("bio")
        
        # Validate date of birth if provided
        if date_of_birth:
            try:
                date.fromisoformat(date_of_birth)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format for date of birth. Use YYYY-MM-DD"
                )
                
        # Validate timezone if provided
        if timezone and timezone not in settings.TIMEZONES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timezone"
            )
        
        # Update user information
        update_data = {
            "username": username,
            "name": name,
            "avatar_url": avatar_url,
            "avatar_decoration": avatar_decoration,
            "location": location,
            "date_of_birth": date_of_birth,
            "timezone": timezone,
            "gender": gender,
            "pronouns": pronouns,
            "bio": bio,
            "onboarding_completed": True
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_data}
        )
        
        # Create default profile page if user doesn't have any
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        
        if page_count == 0 and username:
            default_page = {
                "user_id": current_user["id"],
                "page_id": str(ObjectId()),
                "url": username,
                "title": f"{name}'s Page" if name else f"{username}'s Page",
                "name": name,
                "avatar_url": avatar_url,
                "avatar_decoration": avatar_decoration,
                "bio": bio or "",
                "background": {
                    "type": "solid",
                    "value": "#ffffff",
                    "opacity": 1.0
                },
                "layout": {
                    "type": "standard",
                    "container_style": {
                        "enabled": True,
                        "background_color": "#ffffff",
                        "opacity": 0.8,
                        "border_radius": 10,
                        "shadow": True
                    }
                },
                "social_links": [],
                "songs": [],
                "show_joined_date": True,
                "show_views": True,
                "created_at": datetime.utcnow(),
                "name_style": {
                    "color": "#000000",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "username_style": {
                    "color": "#555555",
                    "font": {
                        "name": "Default",
                        "value": "",
                        "link": ""
                    }
                },
                "timezone": timezone
            }
            
            await db.profile_pages.insert_one(default_page)
            
            # Initialize views counter
            await db.views.insert_one({
                "url": username,
                "views": 0
            })
        
        # Clear cache
        await user_cache.delete(f"user:{current_user['email']}")
        if current_user.get("username"):
            await user_cache.delete(f"username:{current_user['username']}")
        
        # Get updated user
        updated_user = await db.users.find_one({"id": current_user["id"]})
        
        # Calculate age
        age = None
        if updated_user.get("date_of_birth"):
            age = calculate_age(updated_user["date_of_birth"])
        
        return {
            "message": "Profile updated successfully",
            "profile": {
                "id": updated_user["id"],
                "username": updated_user.get("username"),
                "name": updated_user.get("name"),
                "avatar_url": updated_user.get("avatar_url"),
                "avatar_decoration": updated_user.get("avatar_decoration"),
                "location": updated_user.get("location"),
                "date_of_birth": updated_user.get("date_of_birth"),
                "age": age,
                "timezone": updated_user.get("timezone"),
                "gender": updated_user.get("gender"),
                "pronouns": updated_user.get("pronouns"),
                "bio": updated_user.get("bio")
            }
        }

@app.delete("/pages/{page_id}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def delete_profile_page(
    request: Request,
    page_id: str,
    current_user: dict = Depends(get_current_verified_user)
):
    """Delete a user's profile page"""
    async with get_database() as db:
        # Check if page exists and belongs to user
        page = await db.profile_pages.find_one({
            "page_id": page_id,
            "user_id": current_user["id"]
        })
        
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found or you don't have permission to delete it"
            )
        
        # Check if this is the user's public profile page (URL matches username)
        if current_user.get("username") and page["url"] == current_user["username"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your public profile page"
            )
        
        # Check if this is the user's last page
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        if page_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your last page"
            )
        
        # Delete page
        await db.profile_pages.delete_one({"page_id": page_id})
        
        # Delete associated views
        await db.views.delete_one({"url": page["url"]})
        
        # Clear cache
        if f"views:{page['url']}" in views_cache:
            views_cache.pop(f"views:{page['url']}")
        
        return {"message": "Page deleted successfully"}

        
@app.get("/p/{url}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_public_page(request: Request, url: str, template_id: Optional[str] = None):
    async with get_database() as db:
        # If template_id is provided, return the template preview
        if template_id:
            template = await db.templates.find_one({"id": template_id})
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Template not found"
                )
                
            # Get user who created the template
            template_creator = await db.users.find_one({"id": template["created_by"]})
            
            # Prepare response data with template preview flag
            response_data = {
                "page": template["page_config"],
                "user": {
                    "username": template_creator.get("username") if template_creator else "User",
                    "name": template_creator.get("name") if template_creator else "User",
                },
                "is_template_preview": True,
                "template_id": template_id,
                "template_name": template["name"]
            }
            
            return response_data
        
        # Try to find the page by URL
        page = await db.profile_pages.find_one({"url": url})
        
        if not page:
            # Check if it's a username
            user = await db.users.find_one({"username": url})
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Page not found"
                )
            
            # Find the user's default page
            page = await db.profile_pages.find_one({
                "user_id": user["id"],
                "url": url
            })
            
            if not page:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Page not found"
                )
        
        # Get the user who owns this page
        user = await db.users.find_one({"id": page["user_id"]})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Handle views if enabled
        device_hash = await generate_device_identifier(request)
        views = 0

        if page and "name_style" in page and isinstance(page["name_style"], dict):
            if "font" in page["name_style"] and isinstance(page["name_style"]["font"], dict):
                # Ensure the font link is included
                font = page["name_style"]["font"]
                page["name_style"]["font"] = {
                    "name": font.get("name", "Default"),
                    "value": font.get("value", ""),
                    "link": font.get("link", "")
                }
                
        if page and "username_style" in page and isinstance(page["username_style"], dict):
            if "font" in page["username_style"] and isinstance(page["username_style"]["font"], dict):
                # Ensure the font link is included
                font = page["username_style"]["font"]
                page["username_style"]["font"] = {
                    "name": font.get("name", "Default"),
                    "value": font.get("value", ""),
                    "link": font.get("link", "")
                }
        
        if page.get("show_views", True):
            view_record = ViewRecord(
                url=url,
                device_hash=device_hash,
                timestamp=datetime.utcnow(),
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent", "")
            )
            
            # Check if this view should be counted
            if await should_count_view(db, url, device_hash):
                await db.view_records.insert_one(view_record.dict())
                
                result = await db.views.find_one_and_update(
                    {"url": url},
                    {"$inc": {"views": 1}},
                    upsert=True,
                    return_document=True
                )
                
                views = result["views"] if result else 0
                views_cache[f"views:{url}"] = views
            else:
                views_doc = await db.views.find_one({"url": url})
                views = views_doc["views"] if views_doc else 0
        
        # Prepare response data
        # Convert ObjectId to string
        if "_id" in page:
            page["_id"] = str(page["_id"])
        
        # Calculate age if date_of_birth is present
        age = None
        if user.get("date_of_birth"):
            age = calculate_age(user["date_of_birth"])
        
        response_data = {
            "page": page,
            "user": {
                "username": user.get("username"),
                "name": user.get("name"),
                "joined_at": user.get("joined_at"),
                "tags": user.get("tags", [])
            },
            "views": views
        }
        
        # Filter user data based on display preferences
        display_prefs = user.get("display_preferences", {})
        
        if not display_prefs.get("show_joined_date", True):
            response_data["user"].pop("joined_at", None)
        
        if not display_prefs.get("show_tags", True):
            response_data["user"].pop("tags", None)
        
        # Add user profile data if the preferences allow
        if display_prefs.get("show_location", True) and "location" in user:
            response_data["user"]["location"] = user["location"]
            
        if display_prefs.get("show_dob", True) and "date_of_birth" in user:
            response_data["user"]["date_of_birth"] = user["date_of_birth"]
            response_data["user"]["age"] = age
            
        if display_prefs.get("show_gender", True) and "gender" in user:
            response_data["user"]["gender"] = user["gender"]
            
        if display_prefs.get("show_pronouns", True) and "pronouns" in user:
            response_data["user"]["pronouns"] = user["pronouns"]
            
        if display_prefs.get("show_timezone", True) and "timezone" in user:
            response_data["user"]["timezone"] = user["timezone"]
            
        return response_data

@app.get("/views/{url}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_views(request: Request, url: str):
    cache_key = f"views:{url}"
    if cache_key in views_cache:
        return {"views": views_cache[cache_key]}
    
    async with get_database() as db:
        views_doc = await db.views.find_one({"url": url})
        views = views_doc["views"] if views_doc else 0
        views_cache[cache_key] = views
        return {"views": views}

@app.put("/preferences")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_display_preferences(
    request: Request,
    preferences: DisplayPreferences,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Validate custom fonts if provided
        if preferences.default_name_style and preferences.default_name_style.font and preferences.default_name_style.font.link:
            if not await validate_font(preferences.default_name_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for name"
                )
                
        if preferences.default_username_style and preferences.default_username_style.font and preferences.default_username_style.font.link:
            if not await validate_font(preferences.default_username_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for username"
                )
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"display_preferences": preferences.dict()}}
        )
        await user_cache.delete(f"user:{current_user['email']}")
        if "username" in current_user and current_user["username"]:
            await user_cache.delete(f"username:{current_user['username']}")
        
        return {"message": "Display preferences updated successfully"}

@app.post("/templates", response_model=TemplateResponse)
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def create_template(
    request: Request,
    template_data: Template,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check template quota
        template_count = await db.templates.count_documents({"created_by": current_user["id"]})
        if template_count >= settings.MAX_TEMPLATES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_TEMPLATES} templates"
            )
        
        # Validate custom fonts in the template's page_config
        if template_data.page_config.name_style and template_data.page_config.name_style.font and template_data.page_config.name_style.font.link:
            if not await validate_font(template_data.page_config.name_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for name in template"
                )
                
        if template_data.page_config.username_style and template_data.page_config.username_style.font and template_data.page_config.username_style.font.link:
            if not await validate_font(template_data.page_config.username_style.font.link):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid font link for username in template"
                )
        
        # Generate template ID
        template_id = str(ObjectId())
        
        # Prepare template data
        template_dict = template_data.dict(exclude={"id"})
        template_dict["id"] = template_id
        template_dict["created_by"] = current_user["id"]
        template_dict["created_at"] = datetime.utcnow()
        template_dict["use_count"] = 0
        
        # Make sure the template's page_config has standard layout
        if template_dict["page_config"].get("layout", {}).get("type") != "standard":
            template_dict["page_config"]["layout"] = {"type": "standard", "container_style": ContainerStyle().dict()}
        
        # Insert template
        await db.templates.insert_one(template_dict)
        
        # Get username for response
        template_response = {
            **template_dict,
            "created_by_username": current_user.get("username")
        }
        
        return template_response

@app.get("/templates", response_model=List[TemplateResponse])
@limiter.limit(RateLimits.READ_LIMIT)
async def get_templates(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    sort_by: str = Query("use_count", regex="^(use_count|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    tag: Optional[str] = Query(None)
):
    async with get_database() as db:
        # Prepare filter
        filter_query = {}
        if tag:
            filter_query["tags"] = tag
        
        # Prepare sort
        sort_direction = -1 if sort_order == "desc" else 1
        sort_params = [(sort_by, sort_direction)]
        
        # Calculate skip
        skip = (page - 1) * limit
        
        # Query templates
        templates = []
        cursor = db.templates.find(filter_query).sort(sort_params).skip(skip).limit(limit)
        
        # Process templates and add username
        async for template in cursor:
            # Get username of template creator
            user = await db.users.find_one({"id": template["created_by"]})
            username = user.get("username") if user else None
            
            # Format template
            template["id"] = str(template["id"])
            if "_id" in template:
                template["_id"] = str(template["_id"])
            
            templates.append({
                **template,
                "created_by_username": username
            })
        
        # Get total count for pagination
        total_count = await db.templates.count_documents(filter_query)
        
        return templates

        
@app.post("/upload")
@limiter.limit(RateLimits.UPLOAD_LIMIT)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image to ImgBB and return the URL"""
    # Check file size (32MB max according to ImgBB)
    MAX_SIZE = 32 * 1024 * 1024  # 32MB
    
    # Read the file content
    file_content = await file.read()
    
    # Check file size
    if len(file_content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is 32MB."
        )
    
    # Check file type
    content_type = file.content_type
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed."
        )
    
    # Prepare the request to ImgBB
    IMGBB_API_KEY = os.getenv("IMGBB_API_KEY", "")
    if not IMGBB_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload service is not configured."
        )
    
    try:
        # Convert image to base64
        import base64
        file_base64 = base64.b64encode(file_content).decode("utf-8")
        
        # Send the request to ImgBB
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.imgbb.com/1/upload",
                data={
                    "key": IMGBB_API_KEY,
                    "image": file_base64,
                    "name": file.filename,
                }
            )
            
            # Check if the request was successful
            if response.status_code != 200:
                logger.error(f"ImgBB upload failed: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upload image to external service."
                )
            
            # Parse the response
            result = response.json()
            if not result.get("success"):
                logger.error(f"ImgBB upload error: {result}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upload image to external service."
                )
            
            # Return the image URL
            image_url = result.get("data", {}).get("url")
            if not image_url:
                logger.error(f"ImgBB response missing URL: {result}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid response from image service."
                )
            
            return {
                "url": image_url,
                "display_url": result.get("data", {}).get("display_url"),
                "thumbnail_url": result.get("data", {}).get("thumb", {}).get("url"),
                "size": len(file_content),
                "type": content_type
            }
            
    except httpx.RequestError as e:
        logger.error(f"Error uploading to ImgBB: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to communicate with image service."
        )
    except Exception as e:
        logger.error(f"Unexpected error during image upload: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during image upload."
        )
        
@app.get("/templates/{template_id}", response_model=TemplateResponse)
@limiter.limit(RateLimits.READ_LIMIT)
async def get_template(request: Request, template_id: str):
    # Check cache
    cache_key = f"template:{template_id}"
    if cache_key in template_cache:
        return template_cache[cache_key]
    
    async with get_database() as db:
        template = await db.templates.find_one({"id": template_id})
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get username of template creator
        user = await db.users.find_one({"id": template["created_by"]})
        username = user.get("username") if user else None
        
        # Format template
        if "_id" in template:
            template["_id"] = str(template["_id"])
        
        template_response = {
            **template,
            "created_by_username": username
        }
        
        # Cache result
        template_cache[cache_key] = template_response
        
@app.post("/use-template/{template_id}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def use_template(
    request: Request,
    template_id: str,
    data: dict = Body(...),  # Change this to expect a dict
    current_user: dict = Depends(get_current_verified_user)
):
    url = data.get("url")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is required"
        )
    async with get_database() as db:
        # Check URL availability
        if not await is_url_available(db, url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL already taken"
            )
        
        # Check page quota
        page_count = await db.profile_pages.count_documents({"user_id": current_user["id"]})
        if page_count >= settings.MAX_PROFILE_PAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_PROFILE_PAGES} profile pages"
            )
        
        # Get template
        template = await db.templates.find_one({"id": template_id})
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Generate page ID
        page_id = str(ObjectId())
        
        # Create page from template
        page_config = template["page_config"]
        
        # Make sure we're working with a dict
        if isinstance(page_config, ProfilePage):
            page_config = page_config.dict()
        
        # Update page config with new data
        page_config["url"] = url
        page_config["page_id"] = page_id
        page_config["user_id"] = current_user["id"]
        page_config["created_at"] = datetime.utcnow()
        page_config["created_from_template"] = template_id
        
        # Apply user's timezone if available
        if current_user.get("timezone") and not page_config.get("timezone"):
            page_config["timezone"] = current_user["timezone"]
        
        # Initialize views
        await db.views.insert_one({
            "url": url,
            "views": 0
        })
        
        # Insert page
        await db.profile_pages.insert_one(page_config)
        
        # Increment template use count
        await db.templates.update_one(
            {"id": template_id},
            {"$inc": {"use_count": 1}}
        )
        
        # Clear template cache
        template_cache.pop(f"template:{template_id}", None)
        
        return {
            "message": "Page created from template",
            "page_id": page_id,
            "url": url
        }

@app.get("/social-platforms")
async def get_social_platforms():
    # List of supported social media platforms with their icons
    platforms = [
        {"name": "instagram", "icon": "fab fa-instagram", "url_prefix": "https://instagram.com/"},
        {"name": "twitter", "icon": "fab fa-twitter", "url_prefix": "https://twitter.com/"},
        {"name": "facebook", "icon": "fab fa-facebook", "url_prefix": "https://facebook.com/"},
        {"name": "tiktok", "icon": "fab fa-tiktok", "url_prefix": "https://tiktok.com/@"},
        {"name": "youtube", "icon": "fab fa-youtube", "url_prefix": "https://youtube.com/"},
        {"name": "linkedin", "icon": "fab fa-linkedin", "url_prefix": "https://linkedin.com/in/"},
        {"name": "github", "icon": "fab fa-github", "url_prefix": "https://github.com/"},
        {"name": "twitch", "icon": "fab fa-twitch", "url_prefix": "https://twitch.tv/"},
        {"name": "spotify", "icon": "fab fa-spotify", "url_prefix": "https://open.spotify.com/user/"},
        {"name": "snapchat", "icon": "fab fa-snapchat", "url_prefix": "https://snapchat.com/add/"},
        {"name": "discord", "icon": "fab fa-discord", "url_prefix": "https://discord.gg/"},
        {"name": "pinterest", "icon": "fab fa-pinterest", "url_prefix": "https://pinterest.com/"},
        {"name": "reddit", "icon": "fab fa-reddit", "url_prefix": "https://reddit.com/user/"},
        {"name": "tumblr", "icon": "fab fa-tumblr", "url_prefix": "https://tumblr.com/"},
        {"name": "medium", "icon": "fab fa-medium", "url_prefix": "https://medium.com/@"},
        {"name": "behance", "icon": "fab fa-behance", "url_prefix": "https://behance.net/"},
        {"name": "dribbble", "icon": "fab fa-dribbble", "url_prefix": "https://dribbble.com/"},
        {"name": "soundcloud", "icon": "fab fa-soundcloud", "url_prefix": "https://soundcloud.com/"},
        {"name": "vimeo", "icon": "fab fa-vimeo", "url_prefix": "https://vimeo.com/"},
        {"name": "telegram", "icon": "fab fa-telegram", "url_prefix": "https://t.me/"},
        {"name": "whatsapp", "icon": "fab fa-whatsapp", "url_prefix": "https://wa.me/"},
        {"name": "email", "icon": "fas fa-envelope", "url_prefix": "mailto:"},
        {"name": "website", "icon": "fas fa-globe", "url_prefix": ""}
    ]
    
    return {"platforms": platforms}

@app.get("/layouts")
async def get_available_layouts():
    # Just return the standard layout since we're simplifying
    layouts = [
        {
            "type": "standard",
            "name": "Standard",
            "description": "A clean, well-organized layout with all elements arranged in an optimal way.",
            "preview_image": "https://example.com/previews/standard.jpg"
        }
    ]
    
    return {"layouts": layouts}

@app.get("/effects")
async def get_available_effects():
    # List of available text effects
    effects = [
        {
            "name": "typewriter",
            "label": "Typewriter",
            "description": "Text appears one character at a time, like being typed.",
            "config_options": ["speed", "delay"]
        },
        {
            "name": "fade-in",
            "label": "Fade In",
            "description": "Text gradually fades into view.",
            "config_options": ["speed", "delay"]
        },
        {
            "name": "bounce",
            "label": "Bounce",
            "description": "Text bounces into position.",
            "config_options": ["delay"]
        },
        {
            "name": "pulse",
            "label": "Pulse",
            "description": "Text pulses with a subtle glow effect.",
            "config_options": ["speed"]
        },
        {
            "name": "none",
            "label": "None",
            "description": "No animation effect.",
            "config_options": []
        }
    ]
    
    return {"effects": effects}

@app.get("/background-types")
async def get_background_types():
    # List of available background types
    backgrounds = [
        {
            "type": "solid",
            "label": "Solid Color",
            "description": "Simple solid color background"
        },
        {
            "type": "gradient",
            "label": "Gradient",
            "description": "Smooth gradient between two or more colors"
        },
        {
            "type": "image",
            "label": "Image",
            "description": "Custom image background"
        },
        {
            "type": "video",
            "label": "Video",
            "description": "Animated video background (uses more resources)"
        }
    ]
    
    return {"background_types": backgrounds}

@app.get("/fonts")
async def get_available_fonts():
    # Return the list of default fonts
    return {"fonts": settings.DEFAULT_FONTS}

@app.get("/timezones")
async def get_timezones():
    # Return all available timezones
    return {"timezones": settings.TIMEZONES}

@app.get("/trending-templates")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_trending_templates(
    request: Request,
    limit: int = Query(5, ge=1, le=20)
):
    async with get_database() as db:
        templates = []
        cursor = db.templates.find().sort("use_count", -1).limit(limit)
        
        async for template in cursor:
            # Get username of template creator
            user = await db.users.find_one({"id": template["created_by"]})
            username = user.get("username") if user else None
            
            # Format template
            template["id"] = str(template["id"])
            if "_id" in template:
                template["_id"] = str(template["_id"])
            
            templates.append({
                **template,
                "created_by_username": username
            })
        
        return {"templates": templates}

@app.get("/user/{username}/pages")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_user_public_pages(request: Request, username: str):
    async with get_database() as db:
        user = await db.users.find_one({"username": username})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get only the public information about the user's pages
        pages = []
        async for page in db.profile_pages.find({"user_id": user["id"]}):
            pages.append({
                "url": page["url"],
                "title": page["title"],
                "background": page.get("background", {}).get("type")
            })
        
        return {
            "username": username,
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "avatar_decoration": user.get("avatar_decoration"),
            "pages": pages
        }

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": "Rate limit exceeded. Please try again later."
        }
    )

# Health check ping
async def ping_self():
    async with httpx.AsyncClient() as client:
        try:
            await client.get(f"{settings.API_URL}/health")
            logger.info("Health check ping successful")
        except Exception as e:
            logger.error(f"Health check ping failed: {str(e)}")

def run_ping():
    asyncio.run(ping_self())

def start_ping_scheduler():
    schedule.every(settings.PING_INTERVAL).seconds.do(run_ping)
    while True:
        schedule.run_pending()
        time.sleep(1)

async def start_cleanup_scheduler():
    while True:
        await cleanup_old_view_records()
        await cleanup_expired_previews()
        await asyncio.sleep(24 * 60 * 60)  # Run daily

async def cleanup_expired_registrations():
    """Cleanup function to remove expired pending registrations"""
    async with get_database() as db:
        result = await db.pending_users.delete_many({
            "expires_at": {"$lt": datetime.utcnow()}
        })
        if result.deleted_count > 0:
            logger.info(f"Cleaned up {result.deleted_count} expired pending registrations")
        
        await db.verification.delete_many({
            "expires_at": {"$lt": datetime.utcnow()}
        })

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(start_cleanup_scheduler())
    
    async def periodic_registration_cleanup():
        while True:
            try:
                await cleanup_expired_registrations()
                await asyncio.sleep(3600)  # Run hourly
            except Exception as e:
                logger.error(f"Error in periodic registration cleanup: {str(e)}")
                await asyncio.sleep(60)  # Retry after a minute if there's an error
    
    asyncio.create_task(periodic_registration_cleanup())
   
    ping_thread = threading.Thread(target=start_ping_scheduler, daemon=True)
    ping_thread.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT != "production",
        workers=4
    )
