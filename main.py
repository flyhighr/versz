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
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr, constr
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

# Configuration class with improved email settings
class Settings:
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    API_URL: str = os.getenv("API_URL", "http://localhost:8000")
    PING_INTERVAL: int = int(os.getenv("PING_INTERVAL", "300"))
    ALLOWED_ORIGINS: List[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")
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

settings = Settings()

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
    bcrypt__rounds=settings.BCRYPT_ROUNDS,
    bcrypt__ident="2b"
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

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_verified: bool
    url_count: int

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
    return pwd_context.hash(password)

async def send_email_async(to_email: str, subject: str, html_content: str) -> bool:
    try:
        msg = EmailMessage()
        msg.set_content(html_content.replace('<br>', '\n'), subtype='html')
        
        msg['Subject'] = subject
        msg['From'] = settings.EMAIL_FROM
        msg['To'] = to_email
        
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
    user = await get_user(email)
    if not user:
        return None
    
    if not await verify_password(password, user["hashed_password"]):
        return None
        
    return user

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

# Endpoints

@app.get("/", response_class=HTMLResponse)
async def root():
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
async def health_check():
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
async def register_user(
    background_tasks: BackgroundTasks,
    email: str = Body(...),
    password: str = Body(...)
) -> Dict[str, Any]:
    try:
        user = UserCreate(email=email, password=password)
        
        async with get_database() as db:
            existing_user = await db.users.find_one({"email": user.email})
            existing_pending = await db.pending_users.find_one({"email": user.email})
            
            if existing_user or existing_pending:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Email already registered"}
                )
            
            user_id = secrets.token_hex(16)
            verification_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) 
                                      for _ in range(6))
            
            pending_user_data = {
                "id": user_id,
                "email": user.email,
                "hashed_password": get_password_hash(user.password),
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=24)  
            }
            
            verification_email = f"""
            <html>
            <body>
            <h2>Verify Your Email</h2>
            <p>Thank you for registering! Please use the following code to verify your email:</p>
            <h3>{verification_code}</h3>
            <p>This code will expire in 1 hour.</p>
            <p>Your registration will be canceled if you don't verify within 24 hours.</p>
            </body>
            </html>
            """
            
            await db.pending_users.insert_one(pending_user_data)
            await db.verification.insert_one({
                "user_id": user_id,
                "email": user.email,
                "code": verification_code,
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
                "email": user.email,
                "is_verified": False,
                "url_count": 0
            }
            
    except ValidationError as ve:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": str(ve)}
        )
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Registration failed. Please try again."}
        )


@app.post("/verify-email")
async def verify_email(email: EmailStr = Form(...), code: str = Form(...)):
    async with get_database() as db:
        verification = await db.verification.find_one({
            "email": email,
            "code": code,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not verification:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code"
            )
        pending_user = await db.pending_users.find_one({"email": email})
        if not pending_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration expired or not found"
            )
        
        user_data = {
            "id": pending_user["id"],
            "email": email,
            "hashed_password": pending_user["hashed_password"],
            "is_active": True,
            "is_verified": True,
            "created_at": pending_user["created_at"]
        }
        
        await db.users.insert_one(user_data)
        await db.pending_users.delete_one({"email": email})
        await db.verification.delete_one({"email": email})
        await user_cache.delete(f"user:{email}")
        
        return {"message": "Email verified successfully"}

@app.post("/resend-verification")
async def resend_verification(
    background_tasks: BackgroundTasks,
    email: EmailStr = Form(...)
):
    async with get_database() as db:
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.get("is_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )
        
        await db.verification.delete_one({"email": email})
        verification_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) 
                                  for _ in range(6))
        
        await db.verification.insert_one({
            "user_id": user["id"],
            "email": email,
            "code": verification_code,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        })
        
        verification_email = f"""
        <html>
        <body>
        <h2>Verify Your Email</h2>
        <p>Please use the following code to verify your email:</p>
        <h3>{verification_code}</h3>
        <p>This code will expire in 1 hour.</p>
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

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        user = await authenticate_user(form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
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
            "email": user["email"]
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again."
        )

@app.post("/request-password-reset")
async def request_password_reset(
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
        <html>
        <body>
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. If you didn't make this request, 
           you can ignore this email.</p>
        <p>Your password reset code is:</p>
        <h3>{reset_code}</h3>
        <p>This code will expire in 30 minutes.</p>
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
async def reset_password(reset_data: UserPasswordChange):
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
async def read_users_me(current_user: dict = Depends(get_current_user)):
    async with get_database() as db:
        url_count = await db.files.count_documents({"user_id": current_user["id"]})
        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "is_verified": current_user.get("is_verified", False),
            "url_count": url_count
        }

@app.post("/upload")
async def upload_file(
    file: UploadFile,
    custom_url: Optional[str] = None,
    current_user: dict = Depends(get_current_verified_user)
):
    async with get_database() as db:
        url_count = await db.files.count_documents({"user_id": current_user["id"]})
        if url_count >= settings.MAX_URLS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached the maximum limit of {settings.MAX_URLS_PER_USER} URLs"
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
        
        if custom_url:
            if await db.files.find_one({"url": custom_url}):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL already taken"
                )
            url = custom_url
        else:
            url = await generate_unique_url()
        
        document = {
            "url": url,
            "content": Binary(content),
            "filename": file.filename,
            "created_at": datetime.utcnow(),
            "user_id": current_user["id"]
        }
        
        await db.files.insert_one(document)
        await db.views.insert_one({
            "url": url,
            "views": 0
        })
        
        logger.info(f"File uploaded successfully: {file.filename} with URL: {url}")
        return {"url": url}

@app.put("/update/{url}")
async def update_file(
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
async def delete_file(
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
async def get_file(url: str, request: Request):
    async with get_database() as db:
        file = await db.files.find_one({"url": url})
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        device_hash = await generate_device_identifier(request)
        
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
        
        return {
            "content": file["content"].decode(),
            "filename": file["filename"],
            "views": views
        }

@app.get("/views/{url}")
async def get_views(url: str):
    cache_key = f"views:{url}"
    if cache_key in views_cache:
        return {"views": views_cache[cache_key]}
    
    async with get_database() as db:
        views_doc = await db.views.find_one({"url": url})
        views = views_doc["views"] if views_doc else 0
        views_cache[cache_key] = views
        return {"views": views}

@app.get("/my-files")
async def get_user_files(current_user: dict = Depends(get_current_verified_user)):
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
        content={"detail": "Rate limit exceeded. Please try again later."}
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
    async with get_database() as db:
        await db.pending_users.delete_many({
            "expires_at": {"$lt": datetime.utcnow()}
        })

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(start_cleanup_scheduler())
    asyncio.create_task(cleanup_expired_registrations()) 
    async def periodic_registration_cleanup():
        while True:
            await cleanup_expired_registrations()
            await asyncio.sleep(3600)  
    
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
