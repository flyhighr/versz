import os
import random
import string
import time
import asyncio
import threading
import logging
import secrets
import hashlib
from functools import lru_cache
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, HTTPException, status, Request, Depends, Form, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr, constr, ValidationError
from jose import JWTError, jwt
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, OperationFailure
from bson.binary import Binary
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
    MAX_FILE_SIZE: int = 20 * 1024 * 1024  # 20MB
    URL_LENGTH: int = 7
    MAX_URLS_PER_USER: int = 10
    CACHE_TTL: int = 300  # 5 minutes
    MONGODB_MAX_POOL_SIZE: int = 100
    MONGODB_MIN_POOL_SIZE: int = 10
    VIEW_COOLDOWN_MINUTES: int = 30
    DEVICE_IDENTIFIER_TTL_DAYS: int = 30
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
url_cache = TTLCache(maxsize=1000, ttl=settings.CACHE_TTL)
views_cache = TTLCache(maxsize=1000, ttl=settings.CACHE_TTL)

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: constr(min_length=8, max_length=64)  # type: ignore
    
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

class UserLogin(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    user_number: int
    is_verified: bool
    url_count: int
    tags: List[Tag] = []
    display_preferences: DisplayPreferences

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
        db = client.gunsdb
        yield db
    finally:
        client.close()

# FastAPI initialization
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Enhanced API", version="2.0.0")
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

async def generate_unique_url() -> str:
    async with get_database() as db:
        while True:
            url = ''.join(secrets.choice(string.ascii_lowercase + string.digits) 
                         for _ in range(settings.URL_LENGTH))
            if url not in url_cache and not await db.files.find_one({"url": url}):
                url_cache[url] = True
                return url

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


def get_email_template(template_type: str, **kwargs) -> str:
    """
    Common email template generator with consistent styling
    """
    base_style = """
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eeeeee;
        }
        .logo {
            width: 120px;
            height: auto;
            margin-bottom: 20px;
        }
        h1 {
            color: #2c3e50;
            font-size: 24px;
            margin: 0;
            padding: 0;
        }
        .content {
            padding: 30px 0;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4ecdc4;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            text-align: center;
            margin: 20px 0;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #eeeeee;
            padding-top: 20px;
        }
        .highlight {
            background-color: #e8f4fd;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            color: #0d47a1;
        }
        .achievement {
            background-color: #fff3cd;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: center;
        }
        .achievement-icon {
            font-size: 48px;
            margin: 10px 0;
        }
    """

    templates = {
        "welcome": f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>{base_style}</style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Our Platform!</h1>
                    </div>
                    <div class="content">
                        <p>Dear {kwargs.get('email')},</p>
                        <p>Welcome to our platform! We're excited to have you join our community.</p>
                        <div class="highlight">
                            <p>Here's what you can do with your account:</p>
                            <ul>
                                <li>Upload and share HTML files</li>
                                <li>Track views and engagement</li>
                                <li>Customize your display preferences</li>
                            </ul>
                        </div>
                        <a href="{kwargs.get('login_url')}" class="button">Get Started</a>
                    </div>
                    <div class="footer">
                        <p>Thank you for choosing our service!</p>
                    </div>
                </div>
            </body>
            </html>
        """,
        
        "password_changed": f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>{base_style}</style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Changed Successfully</h1>
                    </div>
                    <div class="content">
                        <p>Dear {kwargs.get('email')},</p>
                        <p>Your password has been successfully changed.</p>
                        <div class="highlight">
                            <p>If you didn't make this change, please contact our support team immediately.</p>
                        </div>
                        <p>Time of change: {kwargs.get('timestamp')}</p>
                    </div>
                    <div class="footer">
                        <p>Stay secure!</p>
                    </div>
                </div>
            </body>
            </html>
        """,

        "view_milestone": f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>{base_style}</style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Congratulations! 🎉</h1>
                    </div>
                    <div class="content">
                        <div class="achievement">
                            <div class="achievement-icon">🏆</div>
                            <h2>New Milestone Reached!</h2>
                            <p>Your page "{kwargs.get('url')}" has reached {kwargs.get('views')} views!</p>
                        </div>
                        <p>Keep up the great work! Your content is getting noticed.</p>
                        <a href="{kwargs.get('stats_url')}" class="button">View Statistics</a>
                    </div>
                    <div class="footer">
                        <p>Thank you for being part of our community!</p>
                    </div>
                </div>
            </body>
            </html>
        """,

        # Add more email templates as needed
    }

    return templates.get(template_type, "")

async def check_and_send_view_milestone_email(db: AsyncIOMotorDatabase, url: str, views: int, user_id: str):
    """Check if a view milestone has been reached and send appropriate email"""
    milestones = [10, 50, 100, 500, 1000]
    
    for milestone in milestones:
        if views == milestone:
            user = await db.users.find_one({"id": user_id})
            if user:
                email_content = get_email_template(
                    "view_milestone",
                    email=user["email"],
                    url=url,
                    views=views,
                    stats_url=f"{settings.API_URL}/stats/{url}"
                )
                
                await send_email_async(
                    user["email"],
                    f"Congratulations! Your page reached {views} views! 🎉",
                    email_content
                )
                
                # Record milestone in database
                await db.view_milestones.insert_one({
                    "user_id": user_id,
                    "url": url,
                    "milestone": milestone,
                    "achieved_at": datetime.utcnow()
                })

# Endpoints

@app.get("/", response_class=HTMLResponse)
@limiter.limit(RateLimits.READ_LIMIT)
async def root(request: Request):
    return """
    <html>
        <head><title>API Service</title></head>
        <body>
            <h1>Welcome to the API Service</h1>
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
    email: str = Body(...),
    password: str = Body(...)
) -> Dict[str, Any]:
    try:
        user = UserCreate(email=email, password=password)
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
        verification_link = f"https://versz.fun/verify?token={verification_token}"
        
        pending_user_data = {
            "id": user_id,
            "user_number": user_number,
            "email": user.email,
            "hashed_password": get_password_hash(user.password),
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "tags": [],
            "display_preferences": {
                "show_views": True,
                "show_uuid": True,
                "show_tags": True
            }
        }
        
        # Enhanced verification email template
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
                    margin: 20px auto;
                    padding: 40px;
                    background-color: #ffffff;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .logo {{
                    width: 150px;
                    height: auto;
                    margin-bottom: 20px;
                }}
                h1 {{
                    color: #2c3e50;
                    font-size: 28px;
                    margin: 0;
                    padding: 0;
                }}
                .welcome-message {{
                    font-size: 18px;
                    color: #666;
                    margin: 20px 0;
                }}
                .verification-button {{
                    display: inline-block;
                    padding: 15px 30px;
                    background-color: #4ecdc4;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    margin: 20px 0;
                    transition: background-color 0.3s ease;
                }}
                .verification-button:hover {{
                    background-color: #45b7b0;
                }}
                .features {{
                    background-color: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 30px 0;
                }}
                .features h3 {{
                    color: #2c3e50;
                    margin-top: 0;
                }}
                .feature-list {{
                    list-style-type: none;
                    padding: 0;
                }}
                .feature-list li {{
                    margin: 10px 0;
                    padding-left: 25px;
                    position: relative;
                }}
                .feature-list li:before {{
                    content: "✓";
                    color: #4ecdc4;
                    position: absolute;
                    left: 0;
                }}
                .expiry-warning {{
                    background-color: #fff3cd;
                    border: 1px solid #ffeeba;
                    color: #856404;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-size: 14px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #666;
                    font-size: 14px;
                }}
                .social-links {{
                    margin: 20px 0;
                }}
                .social-links a {{
                    color: #4ecdc4;
                    text-decoration: none;
                    margin: 0 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://versz.fun/logo.png" alt="Logo" class="logo">
                    <h1>Welcome to Versz!</h1>
                </div>
                
                <div class="welcome-message">
                    Hi {user.email},<br>
                    Thank you for joining our community! We're excited to have you on board.
                </div>
                
                <div style="text-align: center;">
                    <a href="{verification_link}" class="verification-button">
                        Verify Your Email
                    </a>
                </div>
                
                <div class="features">
                    <h3>What you'll get access to:</h3>
                    <ul class="feature-list">
                        <li>Upload and share HTML files instantly</li>
                        <li>Track views and engagement analytics</li>
                        <li>Customize your display preferences</li>
                        <li>Earn achievements and milestones</li>
                    </ul>
                </div>
                
                <div class="expiry-warning">
                    ⚠️ Please note: This verification link will expire in 1 hour. Make sure to verify your email before then.
                </div>
                
                <div class="footer">
                    <p>Need help? Contact our support team at support@versz.fun</p>
                    <div class="social-links">
                        <a href="https://twitter.com/verszfun">Twitter</a> |
                        <a href="https://discord.gg/versz">Discord</a> |
                        <a href="https://github.com/versz">GitHub</a>
                    </div>
                    <p>© 2024 Versz. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Welcome email template (sent after verification)
        welcome_email = f"""
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
                    margin: 20px auto;
                    padding: 40px;
                    background-color: #ffffff;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .logo {{
                    width: 150px;
                    height: auto;
                    margin-bottom: 20px;
                }}
                h1 {{
                    color: #2c3e50;
                    font-size: 28px;
                    margin: 0;
                    padding: 0;
                }}
                .getting-started {{
                    background-color: #e8f4fd;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 30px 0;
                }}
                .getting-started h3 {{
                    color: #0d47a1;
                    margin-top: 0;
                }}
                .quick-links {{
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    margin: 30px 0;
                }}
                .quick-link {{
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    text-decoration: none;
                    color: #333;
                    width: calc(50% - 10px);
                    margin-bottom: 20px;
                    text-align: center;
                    transition: transform 0.3s ease;
                }}
                .quick-link:hover {{
                    transform: translateY(-3px);
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #666;
                    font-size: 14px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://raw.githubusercontent.com/flyhighr/versz/6e4edb4783b9f95705dd93424d31e9b587409112/download.svg" alt="Logo" class="logo">
                    <h1>🎉 Registration Complete! 🎉</h1>
                </div>
                
                <p>Dear {user.email},</p>
                <p>Your account has been successfully created. Welcome to the Versz community!</p>
                
                <div class="getting-started">
                    <h3>🚀 Getting Started</h3>
                    <p>Here are some things you can do right away:</p>
                    <ul>
                        <li>Upload your first HTML file</li>
                        <li>Customize your profile settings</li>
                        <li>Explore other users' content</li>
                        <li>Join our Discord community</li>
                    </ul>
                </div>
                
                <div class="quick-links">
                    <a href="https://versz.fun/" class="quick-link">
                        📊 Dashboard
                    </a>
                    <a href="https://versz.fun/help" class="quick-link">
                        ❓ Help Center
                    </a>
                </div>
                
                <div class="footer">
                    <p>Need help? Contact our support team at support@versz.fun</p>
                    <p>Follow us on social media for updates and tips:</p>
                    <div class="social-links">
                        <a href="https://twitter.com/verszfun">Twitter</a> |
                        <a href="https://discord.gg/versz">Discord</a> |
                        <a href="https://github.com/versz">GitHub</a>
                    </div>
                    <p>© 2024 Versz. All rights reserved.</p>
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
        
        # Send verification email
        background_tasks.add_task(
            send_email_async,
            user.email,
            "Verify Your Email - Versz Registration",
            verification_email
        )
        
        # Store welcome email to be sent after verification
        await db.email_queue.insert_one({
            "user_id": user_id,
            "email": user.email,
            "subject": "Welcome to Versz! 🎉",
            "content": welcome_email,
            "type": "welcome",
            "status": "pending",
            "created_at": datetime.utcnow()
        })
        
        return {
            "id": user_id,
            "user_number": user_number,
            "email": user.email,
            "is_verified": False,
            "url_count": 0,
            "tags": [],
            "display_preferences": DisplayPreferences()
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
        verification_link = f"https://versz.fun/verify?token={verification_token}"
        
        await db.verification.insert_one({
            "user_id": user_id,
            "email": email,
            "token": verification_token,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration expired or not found"
            )
            
        user_data = {
            "id": pending_user["id"],
            "user_number": pending_user["user_number"],
            "email": verification["email"],
            "hashed_password": pending_user["hashed_password"],
            "is_active": True,
            "is_verified": True,
            "created_at": pending_user["created_at"],
            "tags": [],
            "display_preferences": pending_user["display_preferences"]
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
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "is_verified": user.get("is_verified", False),
            "id": user["id"],
            "user_number": user.get("user_number"),
            "email": user["email"],
            "tags": user.get("tags", []),
            "display_preferences": user.get("display_preferences", {
                "show_views": True,
                "show_uuid": True,
                "show_tags": True
            })
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
        password_changed_email = get_email_template(
            "password_changed",
            email=reset_data.email,
            timestamp=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        )
        
        await send_email_async(
            reset_data.email,
            "Password Changed Successfully",
            password_changed_email
        )
        
        
        return {"message": "Password reset successfully"}

@app.get("/me")
@limiter.limit(RateLimits.READ_LIMIT)
async def read_users_me(request: Request, current_user: dict = Depends(get_current_user)):
    async with get_database() as db:
        url_count = await db.files.count_documents({"user_id": current_user["id"]})
        return {
            "id": current_user["id"],
            "user_number": current_user.get("user_number"),
            "email": current_user["email"],
            "is_verified": current_user.get("is_verified", False),
            "url_count": url_count,
            "tags": current_user.get("tags", []),
            "display_preferences": current_user.get("display_preferences", {
                "show_views": True,
                "show_uuid": True,
                "show_tags": True
            })
        }

RESERVED_WORDS = ["verify", "privacy", "terms", "login", "register", "admin"]

@app.post("/upload")
@limiter.limit(RateLimits.UPLOAD_LIMIT)
async def upload_file(
    request: Request,
    file: UploadFile,
    custom_url: Optional[str] = None,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        # Check user's URL quota
        url_count = await db.files.count_documents({"user_id": current_user["id"]})
        if url_count >= settings.MAX_URLS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_URLS_PER_USER} URLs"
            )
        
        # Validate file size
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large"
            )
        
        # Validate file type
        if not file.filename.endswith('.html'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only HTML files are allowed"
            )
        
        # Handle custom URL
        if custom_url:
            # Check for reserved words
            if custom_url.lower() in RESERVED_WORDS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This URL is reserved and cannot be used"
                )
            
            # Check URL availability
            if await db.files.find_one({"url": custom_url}):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL already taken"
                )
            url = custom_url
        else:
            url = await generate_unique_url()
        
        # Prepare and store document
        document = {
            "url": url,
            "content": Binary(content),
            "filename": file.filename,
            "created_at": datetime.utcnow(),
            "user_id": current_user["id"]
        }
        
        # Insert file and initialize view counter
        await db.files.insert_one(document)
        await db.views.insert_one({
            "url": url,
            "views": 0
        })
        
        logger.info(f"File uploaded successfully: {file.filename} with URL: {url}")
        return {"url": url}

@app.put("/update/{url}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def update_file(
    request: Request,
    url: str,
    file: UploadFile,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        existing_file = await db.files.find_one({"url": url})
        if not existing_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        if existing_file["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this file"
            )
        
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large"
            )
        
        if not file.filename.endswith('.html'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only HTML files are allowed"
            )
        
        await db.files.update_one(
            {"url": url},
            {
                "$set": {
                    "content": Binary(content),
                    "filename": file.filename,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {"message": "File updated successfully"}

@app.delete("/file/{url}")
@limiter.limit(RateLimits.MODIFY_LIMIT)
async def delete_file(
    request: Request,
    url: str,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        existing_file = await db.files.find_one({"url": url})
        if not existing_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        if existing_file["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this file"
            )
        
        await db.files.delete_one({"url": url})
        await db.views.delete_one({"url": url})
        url_cache.pop(url, None)
        views_cache.pop(f"views:{url}", None)
        
        return {"message": "File deleted successfully"}

@app.get("/file/{url}")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_file(request: Request, url: str):
    async with get_database() as db:
        file = await db.files.find_one({"url": url})
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        user = await db.users.find_one({"id": file["user_id"]})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        display_prefs = user.get("display_preferences", {
            "show_views": True,
            "show_uuid": True,
            "show_tags": True
        })
        
        device_hash = await generate_device_identifier(request)
        views = 0
        
        if display_prefs.get("show_views", True):
            if await should_count_view(db, url, device_hash):
                view_record = ViewRecord(
                    url=url,
                    device_hash=device_hash,
                    timestamp=datetime.utcnow(),
                    ip_address=request.client.host,
                    user_agent=request.headers.get("user-agent", "")
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
            else:
                views_doc = await db.views.find_one({"url": url})
                views = views_doc["views"] if views_doc else 0
        
        response_data = {
            "content": file["content"].decode(),
            "filename": file["filename"]
        }
        
        if display_prefs.get("show_views", True):
            if await should_count_view(db, url, device_hash):
                response_data["views"] = views
                await check_and_send_view_milestone_email(db, url, views, file["user_id"])
            
        if display_prefs.get("show_uuid", True):
            response_data["user_id"] = user["id"]
            
        if display_prefs.get("show_tags", True):
            tags_with_types = []
            for tag in user.get("tags", []):
                tag_data = {
                    "name": tag["name"],
                    "icon": tag["icon"],
                    "text": tag["text"],
                    "icon_type": tag.get("icon_type", "emoji")
                }
                tags_with_types.append(tag_data)
            response_data["tags"] = tags_with_types
            
        return response_data


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

@app.get("/my-files")
@limiter.limit(RateLimits.READ_LIMIT)
async def get_user_files(request: Request, current_user: dict = Depends(get_current_verified_user)):
    async with get_database() as db:
        cursor = db.files.find({"user_id": current_user["id"]})
        user_files = []
        async for file in cursor:
            views_doc = await db.views.find_one({"url": file["url"]})
            views = views_doc["views"] if views_doc else 0
            user_files.append({
                "url": file["url"],
                "filename": file["filename"],
                "created_at": file["created_at"],
                "updated_at": file.get("updated_at"),
                "views": views
            })
        return user_files

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
        reload=settings.ENVIRONMENT == "production",
        workers=4
    )
