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
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, HTTPException, status, Request, Depends, Form, Body, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr, constr, ValidationError, HttpUrl
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
    MAX_FILE_SIZE: int = 5 * 1024 * 1024  # 5MB for avatars and other media
    MAX_PAGES_PER_USER: int = 5  # Free tier limit
    CACHE_TTL: int = 300  # 5 minutes
    MONGODB_MAX_POOL_SIZE: int = 100
    MONGODB_MIN_POOL_SIZE: int = 10
    VIEW_COOLDOWN_MINUTES: int = 30
    DEVICE_IDENTIFIER_TTL_DAYS: int = 30
    MAX_SOCIAL_LINKS: int = 12
    MAX_SONGS: int = 12
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
    VALID_LAYOUTS = ["center", "top", "left", "right", "bottom"]
    VALID_AVATAR_ANIMATIONS = ["none", "bounce", "pulse", "shake", "rotate"]
    VALID_TEXT_EFFECTS = ["none", "typewriter", "fade-in", "glow"]

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
user_cache = AsyncTTLCache(ttl_seconds=settings.CACHE_TTL)
page_cache = TTLCache(maxsize=1000, ttl=settings.CACHE_TTL)
views_cache = TTLCache(maxsize=1000, ttl=settings.CACHE_TTL)
template_cache = TTLCache(maxsize=100, ttl=settings.CACHE_TTL)

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

class ContainerStyle(BaseModel):
    color: Optional[str] = None
    gradient: Optional[str] = None
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    border_radius: Optional[int] = None
    show: bool = True

class BackgroundSettings(BaseModel):
    type: Literal["color", "image", "video"] = "color"
    value: str = "#ffffff"  # Color code, image URL, or video URL
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    blur: Optional[int] = None

class TextEffect(BaseModel):
    type: str = "none"  # none, typewriter, fade-in, glow
    speed: Optional[float] = None
    color: Optional[str] = None

class AvatarSettings(BaseModel):
    url: Optional[str] = None
    animation: str = "none"  # none, bounce, pulse, shake, rotate
    border_color: Optional[str] = None
    border_width: int = 0
    size: str = "medium"  # small, medium, large

class PageLayout(BaseModel):
    type: str = "center"  # center, top, left, right, bottom
    container_style: ContainerStyle = ContainerStyle()
    spacing: int = 10

class PageSettings(BaseModel):
    id: Optional[str] = None
    url_slug: str
    title: str
    description: Optional[str] = None
    layout: PageLayout = PageLayout()
    background: BackgroundSettings = BackgroundSettings()
    name_effect: TextEffect = TextEffect()
    bio_effect: TextEffect = TextEffect()
    show_views: bool = True
    show_user_id: bool = True
    show_join_date: bool = True
    show_profile_info: bool = True
    is_main_page: bool = False

class ProfileInfo(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    avatar: AvatarSettings = AvatarSettings()
    show_location: bool = False
    show_age: bool = False
    show_gender: bool = False
    show_pronouns: bool = False

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: constr(min_length=8, max_length=64)  # type: ignore
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

class Tag(BaseModel):
    name: str
    icon: str
    text: str
    icon_type: str = Field(
        default="emoji",
        description="Type of icon: 'emoji', 'svg', or 'image'"
    )

class DisplayPreferences(BaseModel):
    enable_music_player: bool = True
    show_views: bool = True
    show_user_id: bool = True
    show_join_date: bool = True
    show_tags: bool = True
    show_profile_info: bool = True
    default_page_layout: str = "center"

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    user_number: int
    name: Optional[str] = None
    is_verified: bool
    page_count: int
    created_at: datetime
    tags: List[Tag] = []
    display_preferences: DisplayPreferences
    profile_info: ProfileInfo

class UserPasswordReset(BaseModel):
    email: EmailStr

class UserPasswordChange(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: constr(min_length=8, max_length=64)  # type: ignore

class ViewRecord(BaseModel):
    page_id: str
    device_hash: str
    timestamp: datetime
    ip_address: str
    user_agent: str

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    page_settings: PageSettings
    tags: List[str] = []
    is_public: bool = True

class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    page_settings: PageSettings
    created_by: str
    uses_count: int
    created_at: datetime
    tags: List[str] = []
    is_public: bool = True

class UrlCheckResponse(BaseModel):
    is_available: bool
    suggestion: Optional[str] = None

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
        db = client.biolink_db
        yield db
    finally:
        client.close()

# FastAPI initialization
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="BioLink API", version="2.0.0")
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
            # Convert ObjectId to string
            if "_id" in user:
                user["_id"] = str(user["_id"])
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

async def is_url_slug_available(db: AsyncIOMotorDatabase, url_slug: str) -> bool:
    # Check if URL is already taken by any page
    existing_page = await db.pages.find_one({"url_slug": url_slug})
    if existing_page:
        return False
    
    # Check against reserved words
    reserved_words = ["verify", "privacy", "terms", "login", "register", "admin", 
                      "dashboard", "settings", "account", "profile", "api", "templates"]
    if url_slug.lower() in reserved_words:
        return False
    
    return True

async def suggest_url_slug(db: AsyncIOMotorDatabase, base_slug: str) -> str:
    # Try adding numbers to the end until we find an available one
    counter = 1
    while counter < 100:  # Limit to prevent infinite loop
        suggestion = f"{base_slug}{counter}"
        if await is_url_slug_available(db, suggestion):
            return suggestion
        counter += 1
    
    # If all numbered suggestions are taken, add random characters
    random_suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    return f"{base_slug}-{random_suffix}"

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

async def should_count_view(db: AsyncIOMotorDatabase, page_id: str, device_hash: str) -> bool:
    last_view = await db.view_records.find_one(
        {
            "page_id": page_id,
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

async def get_template_by_id(db: AsyncIOMotorDatabase, template_id: str) -> Optional[Dict[str, Any]]:
    if not ObjectId.is_valid(template_id):
        return None
    
    template = await db.templates.find_one({"_id": ObjectId(template_id)})
    if template:
        template["id"] = str(template["_id"])
        return template
    return None

async def increment_template_usage(db: AsyncIOMotorDatabase, template_id: str):
    if not ObjectId.is_valid(template_id):
        return
    
    await db.templates.update_one(
        {"_id": ObjectId(template_id)},
        {"$inc": {"uses_count": 1}}
    )

# Endpoints

@app.get("/", response_class=HTMLResponse)
@limiter.limit(RateLimits.READ_LIMIT)
async def root(request: Request):
    return """
    <html>
        <head><title>BioLink API</title></head>
        <body>
            <h1>Welcome to the BioLink API</h1>
            <p>Please refer to the documentation for available endpoints.</p>
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
    user_data: UserCreate
) -> Dict[str, Any]:
    try:
        # Validate the user data
        user = UserCreate(email=user_data.email, password=user_data.password, name=user_data.name)
    except ValidationError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    
    async with get_database() as db:
        user_number = await get_next_user_number(db)
        
        existing_user = await db.users.find_one({"email": user.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
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
        verification_link = f"{settings.API_URL}/verify?token={verification_token}"
        
        # Create default profile info
        profile_info = ProfileInfo(
            name=user.name,
            avatar=AvatarSettings()
        ).dict()
        
        # Create default display preferences
        display_preferences = DisplayPreferences().dict()
        
        pending_user_data = {
            "id": user_id,
            "user_number": user_number,
            "email": user.email,
            "name": user.name,
            "hashed_password": get_password_hash(user.password),
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=settings.PENDING_REGISTRATION_EXPIRE_HOURS),
            "tags": [],
            "profile_info": profile_info,
            "display_preferences": display_preferences,
            "social_links": [],
            "songs": []
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
                    <p>This link will expire in {settings.PENDING_REGISTRATION_EXPIRE_HOURS} hour(s).</p>
                    <div class="warning">
                        Your registration will be canceled if you don't verify within {settings.PENDING_REGISTRATION_EXPIRE_HOURS} hour(s).
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
            "expires_at": datetime.utcnow() + timedelta(hours=settings.PENDING_REGISTRATION_EXPIRE_HOURS)
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
            "name": user.name,
            "is_verified": False,
            "page_count": 0,
            "created_at": datetime.utcnow(),
            "tags": [],
            "display_preferences": DisplayPreferences(),
            "profile_info": ProfileInfo(name=user.name)
        }

@app.post("/resend-verification")
@limiter.limit(RateLimits.AUTH_LIMIT)
async def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    email: EmailStr = Form(...)
):
    async with get_database() as db:
        # Check both users and pending_users collections
        user = await db.users.find_one({"email": email})
        pending_user = await db.pending_users.find_one({"email": email})
        
        if not user and not pending_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user and user.get("is_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )
        
        # Use the appropriate user data
        user_data = user or pending_user
        user_id = user_data["id"]
        
        # Delete any existing verification tokens
        await db.verification.delete_one({"email": email})
        
        verification_token = secrets.token_urlsafe(32)
        verification_link = f"{settings.API_URL}/verify?token={verification_token}"
        
        await db.verification.insert_one({
            "user_id": user_id,
            "email": email,
            "token": verification_token,
            "expires_at": datetime.utcnow() + timedelta(hours=settings.PENDING_REGISTRATION_EXPIRE_HOURS)
        })
        
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
                    <p>This link will expire in {settings.PENDING_REGISTRATION_EXPIRE_HOURS} hour(s).</p>
                    <div class="warning">
                        Please verify your email within {settings.PENDING_REGISTRATION_EXPIRE_HOURS} hour(s) to complete the registration process.
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration expired or not found"
            )
            
        user_data = {
            "id": pending_user["id"],
            "user_number": pending_user["user_number"],
            "email": verification["email"],
            "name": pending_user.get("name"),
            "hashed_password": pending_user["hashed_password"],
            "is_active": True,
            "is_verified": True,
            "created_at": pending_user["created_at"],
            "tags": pending_user.get("tags", []),
            "profile_info": pending_user.get("profile_info", {}),
            "display_preferences": pending_user.get("display_preferences", {}),
            "social_links": pending_user.get("social_links", []),
            "songs": pending_user.get("songs", [])
        }
        
        await db.users.insert_one(user_data)
        
        # Create a default main page for the user
        default_page = {
            "user_id": user_data["id"],
            "url_slug": f"user{user_data['user_number']}",
            "title": f"{user_data.get('name', 'My')} Bio Link",
            "description": "My personal bio link page",
            "layout": {
                "type": "center",
                "container_style": {
                    "color": "#ffffff",
                    "opacity": 0.9,
                    "border_radius": 10,
                    "show": True
                },
                "spacing": 10
            },
            "background": {
                "type": "color",
                "value": "#f0f2f5",
                "opacity": 1.0
            },
            "name_effect": {
                "type": "none"
            },
            "bio_effect": {
                "type": "none"
            },
            "show_views": True,
            "show_user_id": True,
            "show_join_date": True,
            "show_profile_info": True,
            "is_main_page": True,
            "created_at": datetime.utcnow(),
            "views": 0
        }
        
        await db.pages.insert_one(default_page)
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
        
        async with get_database() as db:
            page_count = await db.pages.count_documents({"user_id": user["id"]})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "is_verified": user.get("is_verified", False),
            "id": user["id"],
            "user_number": user.get("user_number"),
            "email": user["email"],
            "name": user.get("name"),
            "page_count": page_count,
            "tags": user.get("tags", []),
            "display_preferences": user.get("display_preferences", {
                "enable_music_player": True,
                "show_views": True,
                "show_user_id": True,
                "show_join_date": True,
                "show_tags": True,
                "show_profile_info": True,
                "default_page_layout": "center"
            }),
            "profile_info": user.get("profile_info", {})
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

@app.get("/me")
@limiter.limit(RateLimits.READ_LIMIT)
async def read_users_me(request: Request, current_user: dict = Depends(get_current_user)):
    async with get_database() as db:
        page_count = await db.pages.count_documents({"user_id": current_user["id"]})
        
        return {
            "id": current_user["id"],
            "user_number": current_user.get("user_number"),
            "email": current_user["email"],
            "name": current_user.get("name"),
            "is_verified": current_user.get("is_verified", False),
            "page_count": page_count,
            "created_at": current_user.get("created_at", datetime.utcnow()),
            "tags": current_user.get("tags", []),
            "profile_info": current_user.get("profile_info", {}),
            "display_preferences": current_user.get("display_preferences", {
                "enable_music_player": True,
                "show_views": True,
                "show_user_id": True,
                "show_join_date": True,
                "show_tags": True,
                "show_profile_info": True,
                "default_page_layout": "center"
            })
        }

@app.get("/check-url/{url_slug}")
@limiter.limit(RateLimits.READ_LIMIT)
async def check_url_availability(request: Request, url_slug: str):
    async with get_database() as db:
        is_available = await is_url_slug_available(db, url_slug)
        
        response = {"is_available": is_available}
        
        if not is_available:
            suggestion = await suggest_url_slug(db, url_slug)
            response["suggestion"] = suggestion
        
        return response

@app.put("/profile")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_profile(
    request: Request,
    profile_info: ProfileInfo,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"profile_info": profile_info.dict()}}
        )
        await user_cache.delete(f"user:{current_user['email']}")
        return {"message": "Profile information updated successfully"}

@app.put("/avatar")
@limiter.limit(RateLimits.UPLOAD_LIMIT)
async def update_avatar(
    request: Request,
    file: UploadFile,
    current_user: dict = Depends(get_current_verified_user)
):
    # Check file type
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {', '.join(allowed_extensions)} files are allowed"
        )
    
    # Read and validate file size
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE / (1024 * 1024)}MB"
        )
    
    # For GIFs, check they are under 1MB
    if file_ext == '.gif' and len(content) > 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GIF files must be under 1MB"
        )
    
    # Create a unique filename
    timestamp = int(datetime.utcnow().timestamp())
    filename = f"avatar_{current_user['id']}_{timestamp}{file_ext}"
    
    # Store the file in the database
    async with get_database() as db:
        await db.avatars.insert_one({
            "user_id": current_user["id"],
            "filename": filename,
            "content": Binary(content),
            "content_type": file.content_type,
            "uploaded_at": datetime.utcnow()
        })
        
        # Update user's profile with avatar URL
        avatar_url = f"/api/avatar/{filename}"
        
        # Get current profile info
        user = await db.users.find_one({"id": current_user["id"]})
        profile_info = user.get("profile_info", {})
        
        # Update avatar URL
        if "avatar" not in profile_info:
            profile_info["avatar"] = {}
        
        profile_info["avatar"]["url"] = avatar_url
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"profile_info": profile_info}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {
            "message": "Avatar updated successfully",
            "avatar_url": avatar_url
        }

@app.get("/api/avatar/{filename}")
async def get_avatar(request: Request, filename: str):
    async with get_database() as db:
        avatar = await db.avatars.find_one({"filename": filename})
        if not avatar:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Avatar not found"
            )
        
        return JSONResponse(
            content=avatar["content"],
            media_type=avatar["content_type"]
        )

@app.put("/preferences")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_display_preferences(
    request: Request,
    preferences: DisplayPreferences,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"display_preferences": preferences.dict()}}
        )
        await user_cache.delete(f"user:{current_user['email']}")
        return {"message": "Display preferences updated successfully"}

@app.post("/pages")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def create_page(
    request: Request,
    page_settings: PageSettings,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check page limit
        page_count = await db.pages.count_documents({"user_id": current_user["id"]})
        if page_count >= settings.MAX_PAGES_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_PAGES_PER_USER} pages"
            )
        
        # Check if URL slug is available
        if not await is_url_slug_available(db, page_settings.url_slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL slug is already taken"
            )
        
        # If this is marked as the main page, unmark any existing main page
        if page_settings.is_main_page:
            await db.pages.update_many(
                {"user_id": current_user["id"], "is_main_page": True},
                {"$set": {"is_main_page": False}}
            )
        
        # Prepare the page data
        page_data = page_settings.dict()
        page_data["user_id"] = current_user["id"]
        page_data["created_at"] = datetime.utcnow()
        page_data["views"] = 0
        
        # Insert the page
        result = await db.pages.insert_one(page_data)
        
        # Return the created page with its ID
        created_page = await db.pages.find_one({"_id": result.inserted_id})
        created_page["id"] = str(created_page.pop("_id"))
        
        return created_page

@app.get("/pages")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_user_pages(
    request: Request, 
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        cursor = db.pages.find({"user_id": current_user["id"]})
        pages = []
        
        async for page in cursor:
            page["id"] = str(page.pop("_id"))
            pages.append(page)
            
        return pages

@app.get("/pages/{page_id}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_page_by_id(
    request: Request,
    page_id: str,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        if not ObjectId.is_valid(page_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid page ID format"
            )
            
        page = await db.pages.find_one({"_id": ObjectId(page_id)})
        
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found"
            )
            
        if page["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this page"
            )
            
        page["id"] = str(page.pop("_id"))
        return page

@app.put("/pages/{page_id}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_page(
    request: Request,
    page_id: str,
    page_settings: PageSettings,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        if not ObjectId.is_valid(page_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid page ID format"
            )
            
        existing_page = await db.pages.find_one({"_id": ObjectId(page_id)})
        
        if not existing_page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found"
            )
            
        if existing_page["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this page"
            )
        
        # If URL slug has changed, check if the new one is available
        if page_settings.url_slug != existing_page["url_slug"]:
            if not await is_url_slug_available(db, page_settings.url_slug):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL slug is already taken"
                )
        
        # If this is marked as the main page, unmark any existing main page
        if page_settings.is_main_page and not existing_page.get("is_main_page", False):
            await db.pages.update_many(
                {"user_id": current_user["id"], "is_main_page": True},
                {"$set": {"is_main_page": False}}
            )
        
        # Prepare the update data
        update_data = page_settings.dict(exclude={"id"})
        update_data["updated_at"] = datetime.utcnow()
        
        # Update the page
        await db.pages.update_one(
            {"_id": ObjectId(page_id)},
            {"$set": update_data}
        )
        
        # Get and return the updated page
        updated_page = await db.pages.find_one({"_id": ObjectId(page_id)})
        updated_page["id"] = str(updated_page.pop("_id"))
        
        return updated_page

@app.delete("/pages/{page_id}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def delete_page(
    request: Request,
    page_id: str,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        if not ObjectId.is_valid(page_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid page ID format"
            )
            
        page = await db.pages.find_one({"_id": ObjectId(page_id)})
        
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found"
            )
            
        if page["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this page"
            )
        
        # Check if this is the user's only page
        page_count = await db.pages.count_documents({"user_id": current_user["id"]})
        if page_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only page. Users must have at least one page."
            )
        
        # If we're deleting the main page, set another page as the main page
        if page.get("is_main_page", False):
            other_page = await db.pages.find_one(
                {"user_id": current_user["id"], "_id": {"$ne": ObjectId(page_id)}}
            )
            if other_page:
                await db.pages.update_one(
                    {"_id": other_page["_id"]},
                    {"$set": {"is_main_page": True}}
                )
        
        # Delete the page
        await db.pages.delete_one({"_id": ObjectId(page_id)})
        
        return {"message": "Page deleted successfully"}

@app.post("/social-links")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def add_social_link(
    request: Request,
    social_link: SocialLink,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check if user has reached the maximum number of social links
        user = await db.users.find_one({"id": current_user["id"]})
        social_links = user.get("social_links", [])
        
        if len(social_links) >= settings.MAX_SOCIAL_LINKS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_SOCIAL_LINKS} social links"
            )
        
        # Add the new social link
        social_links.append(social_link.dict())
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"social_links": social_links}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {"message": "Social link added successfully"}

@app.get("/social-links")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_social_links(
    request: Request,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        user = await db.users.find_one({"id": current_user["id"]})
        return user.get("social_links", [])

@app.put("/social-links/{index}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_social_link(
    request: Request,
    index: int,
    social_link: SocialLink,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Get current social links
        user = await db.users.find_one({"id": current_user["id"]})
        social_links = user.get("social_links", [])
        
        # Check if the index is valid
        if index < 0 or index >= len(social_links):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid social link index"
            )
        
        # Update the social link
        social_links[index] = social_link.dict()
        
                await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"social_links": social_links}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {"message": "Social link updated successfully"}

@app.delete("/social-links/{index}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def delete_social_link(
    request: Request,
    index: int,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Get current social links
        user = await db.users.find_one({"id": current_user["id"]})
        social_links = user.get("social_links", [])
        
        # Check if the index is valid
        if index < 0 or index >= len(social_links):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid social link index"
            )
        
        # Remove the social link
        social_links.pop(index)
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"social_links": social_links}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {"message": "Social link deleted successfully"}

@app.post("/songs")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def add_song(
    request: Request,
    song: Song,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check if user has reached the maximum number of songs
        user = await db.users.find_one({"id": current_user["id"]})
        songs = user.get("songs", [])
        
        if len(songs) >= settings.MAX_SONGS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_SONGS} songs"
            )
        
        # Add the new song
        songs.append(song.dict())
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"songs": songs}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {"message": "Song added successfully"}

@app.get("/songs")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_songs(
    request: Request,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        user = await db.users.find_one({"id": current_user["id"]})
        return user.get("songs", [])

@app.put("/songs/{index}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_song(
    request: Request,
    index: int,
    song: Song,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Get current songs
        user = await db.users.find_one({"id": current_user["id"]})
        songs = user.get("songs", [])
        
        # Check if the index is valid
        if index < 0 or index >= len(songs):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid song index"
            )
        
        # Update the song
        songs[index] = song.dict()
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"songs": songs}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {"message": "Song updated successfully"}

@app.delete("/songs/{index}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def delete_song(
    request: Request,
    index: int,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Get current songs
        user = await db.users.find_one({"id": current_user["id"]})
        songs = user.get("songs", [])
        
        # Check if the index is valid
        if index < 0 or index >= len(songs):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid song index"
            )
        
        # Remove the song
        songs.pop(index)
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"songs": songs}}
        )
        
        await user_cache.delete(f"user:{current_user['email']}")
        
        return {"message": "Song deleted successfully"}

@app.post("/templates")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def create_template(
    request: Request,
    template: TemplateCreate,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Prepare the template data
        template_data = template.dict()
        template_data["created_by"] = current_user["id"]
        template_data["created_at"] = datetime.utcnow()
        template_data["uses_count"] = 0
        
        # Insert the template
        result = await db.templates.insert_one(template_data)
        
        # Return the created template with its ID
        created_template = await db.templates.find_one({"_id": result.inserted_id})
        created_template["id"] = str(created_template.pop("_id"))
        
        return created_template

@app.get("/templates")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_templates(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    search: Optional[str] = None,
    tags: Optional[str] = None,
    sort_by: Optional[str] = "popular"  # popular, newest, oldest
):
    async with get_database() as db:
        # Build the query
        query = {"is_public": True}
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        
        if tags:
            tag_list = tags.split(",")
            query["tags"] = {"$in": tag_list}
        
        # Determine sort order
        sort_options = {
            "popular": [("uses_count", -1)],
            "newest": [("created_at", -1)],
            "oldest": [("created_at", 1)]
        }
        sort_order = sort_options.get(sort_by, sort_options["popular"])
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Get total count for pagination
        total_count = await db.templates.count_documents(query)
        
        # Get templates
        cursor = db.templates.find(query).sort(sort_order).skip(skip).limit(limit)
        
        templates = []
        async for template in cursor:
            template["id"] = str(template.pop("_id"))
            templates.append(template)
        
        # Calculate pagination metadata
        total_pages = (total_count + limit - 1) // limit
        
        return {
            "templates": templates,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_count": total_count,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }

@app.get("/templates/{template_id}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_template(request: Request, template_id: str):
    async with get_database() as db:
        if not ObjectId.is_valid(template_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid template ID format"
            )
            
        template = await get_template_by_id(db, template_id)
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
            
        return template

@app.post("/apply-template/{template_id}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def apply_template(
    request: Request,
    template_id: str,
    page_id: Optional[str] = None,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        if not ObjectId.is_valid(template_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid template ID format"
            )
            
        template = await get_template_by_id(db, template_id)
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get the page settings from the template
        page_settings = template["page_settings"]
        
        if page_id:
            # Update existing page
            if not ObjectId.is_valid(page_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid page ID format"
                )
                
            existing_page = await db.pages.find_one({"_id": ObjectId(page_id)})
            
            if not existing_page:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Page not found"
                )
                
            if existing_page["user_id"] != current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this page"
                )
            
            # Keep the original URL slug and title
            page_settings["url_slug"] = existing_page["url_slug"]
            page_settings["title"] = existing_page["title"]
            
            # Update the page with template settings
            await db.pages.update_one(
                {"_id": ObjectId(page_id)},
                {"$set": {
                    "layout": page_settings["layout"],
                    "background": page_settings["background"],
                    "name_effect": page_settings["name_effect"],
                    "bio_effect": page_settings["bio_effect"],
                    "updated_at": datetime.utcnow()
                }}
            )
            
            response_page = await db.pages.find_one({"_id": ObjectId(page_id)})
            response_page["id"] = str(response_page.pop("_id"))
            
        else:
            # Create a new page with template settings
            # Check page limit
            page_count = await db.pages.count_documents({"user_id": current_user["id"]})
            if page_count >= settings.MAX_PAGES_PER_USER:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"You have reached the maximum limit of {settings.MAX_PAGES_PER_USER} pages"
                )
            
            # Generate a unique URL slug based on template name
            base_slug = template["name"].lower().replace(" ", "-")
            url_slug = base_slug
            
            # Make sure the URL slug is available
            if not await is_url_slug_available(db, url_slug):
                url_slug = await suggest_url_slug(db, base_slug)
            
            # Prepare the page data
            page_data = {
                "user_id": current_user["id"],
                "url_slug": url_slug,
                "title": f"{template['name']} Page",
                "description": template.get("description", ""),
                "layout": page_settings["layout"],
                "background": page_settings["background"],
                "name_effect": page_settings["name_effect"],
                "bio_effect": page_settings["bio_effect"],
                "show_views": page_settings.get("show_views", True),
                "show_user_id": page_settings.get("show_user_id", True),
                "show_join_date": page_settings.get("show_join_date", True),
                "show_profile_info": page_settings.get("show_profile_info", True),
                "is_main_page": False,
                "created_at": datetime.utcnow(),
                "views": 0
            }
            
            # Insert the page
            result = await db.pages.insert_one(page_data)
            
            response_page = await db.pages.find_one({"_id": result.inserted_id})
            response_page["id"] = str(response_page.pop("_id"))
        
        # Increment the template usage count
        await increment_template_usage(db, template_id)
        
        return {
            "message": "Template applied successfully",
            "page": response_page
        }

@app.get("/u/{url_slug}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_page_by_url(
    request: Request,
    url_slug: str,
    include_views: bool = True
):
    # Try to get from cache first
    cache_key = f"page:{url_slug}"
    cached_page = page_cache.get(cache_key)
    
    if cached_page:
        return cached_page
    
    async with get_database() as db:
        page = await db.pages.find_one({"url_slug": url_slug})
        
        if not page:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Page not found"
            )
        
        # Get the page owner
        user = await db.users.find_one({"id": page["user_id"]})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Increment view count if needed
        if include_views:
            device_hash = await generate_device_identifier(request)
            
            if await should_count_view(db, str(page["_id"]), device_hash):
                view_record = ViewRecord(
                    page_id=str(page["_id"]),
                    device_hash=device_hash,
                    timestamp=datetime.utcnow(),
                    ip_address=request.client.host,
                    user_agent=request.headers.get("user-agent", "")
                )
                
                await db.view_records.insert_one(view_record.dict())
                
                await db.pages.update_one(
                    {"_id": page["_id"]},
                    {"$inc": {"views": 1}}
                )
                
                page["views"] = page.get("views", 0) + 1
        
                # Prepare the response
        response = {
            "page": {
                "id": str(page["_id"]),
                "url_slug": page["url_slug"],
                "title": page["title"],
                "description": page.get("description"),
                "layout": page.get("layout"),
                "background": page.get("background"),
                "name_effect": page.get("name_effect"),
                "bio_effect": page.get("bio_effect"),
                "views": page.get("views", 0),
                "created_at": page.get("created_at")
            },
            "user": {
                "id": user["id"],
                "name": user.get("name"),
                "profile_info": user.get("profile_info", {}),
                "social_links": user.get("social_links", []),
                "songs": user.get("songs", []),
                "tags": user.get("tags", []),
                "joined_at": user.get("created_at")
            },
            "display": {
                "show_views": page.get("show_views", True) and user.get("display_preferences", {}).get("show_views", True),
                "show_user_id": page.get("show_user_id", True) and user.get("display_preferences", {}).get("show_user_id", True),
                "show_join_date": page.get("show_join_date", True) and user.get("display_preferences", {}).get("show_join_date", True),
                "show_profile_info": page.get("show_profile_info", True) and user.get("display_preferences", {}).get("show_profile_info", True),
                "show_tags": user.get("display_preferences", {}).get("show_tags", True),
                "enable_music_player": user.get("display_preferences", {}).get("enable_music_player", True)
            }
        }
        
        # Cache the response
        page_cache[cache_key] = response
        
        return response

@app.get("/views/{page_id}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_views(request: Request, page_id: str):
    cache_key = f"views:{page_id}"
    if cache_key in views_cache:
        return {"views": views_cache[cache_key]}
    
    async with get_database() as db:
        if not ObjectId.is_valid(page_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid page ID format"
            )
            
        page = await db.pages.find_one({"_id": ObjectId(page_id)})
        views = page.get("views", 0) if page else 0
        views_cache[cache_key] = views
        return {"views": views}

@app.get("/template-stats")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_template_stats(request: Request):
    async with get_database() as db:
        # Get top used templates
        top_templates_cursor = db.templates.find(
            {"is_public": True}
        ).sort([("uses_count", -1)]).limit(10)
        
        top_templates = []
        async for template in top_templates_cursor:
            template["id"] = str(template.pop("_id"))
            top_templates.append(template)
        
        # Get newest templates
        newest_templates_cursor = db.templates.find(
            {"is_public": True}
        ).sort([("created_at", -1)]).limit(5)
        
        newest_templates = []
        async for template in newest_templates_cursor:
            template["id"] = str(template.pop("_id"))
            newest_templates.append(template)
        
        # Get tag statistics
        pipeline = [
            {"$match": {"is_public": True}},
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]
        
        tag_stats_cursor = db.templates.aggregate(pipeline)
        
        tag_stats = []
        async for tag_stat in tag_stats_cursor:
            tag_stats.append({
                "tag": tag_stat["_id"],
                "count": tag_stat["count"]
            })
        
        return {
            "top_templates": top_templates,
            "newest_templates": newest_templates,
            "tag_stats": tag_stats
        }

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": "Rate limit exceeded. Please try again later.",
            "retry_after": exc.retry_after
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
                await asyncio.sleep(3600) 
            except Exception as e:
                logger.error(f"Error in periodic registration cleanup: {str(e)}")
                await asyncio.sleep(60) 
    
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
