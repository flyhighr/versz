import os
import random
import string
import time
import asyncio
import threading
import logging
import secrets
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, UploadFile, HTTPException, status, Request, Depends, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, validator
from jose import JWTError, jwt
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
from bson.binary import Binary
import httpx
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import schedule

# Environment variables
MONGODB_URL = os.getenv("MONGODB_URL")
API_URL = os.getenv("API_URL")
PING_INTERVAL = int(os.getenv("PING_INTERVAL", "300"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
RATE_LIMIT = os.getenv("RATE_LIMIT", "5/minute")
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ALGORITHM = "HS256"
EMAIL_HOST = "smtp.mail.yahoo.com"
EMAIL_PORT = 587
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
EMAIL_FROM = EMAIL_USERNAME

logging.basicConfig(
    level=logging.INFO if ENVIRONMENT == "production" else logging.DEBUG,
    format="%(asctime)s - %(levelname)s - [%(name)s] - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12 
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr


class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_verified: bool
    url_count: int

class FileCreate(BaseModel):
    url: str
    filename: str
    user_id: str

class FileUpdate(BaseModel):
    content: bytes
    filename: str

class UserPasswordReset(BaseModel):
    email: EmailStr

class UserPasswordChange(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str
class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @validator('password')
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

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
users_collection = db.users
verification_collection = db.verification
password_reset_collection = db.password_reset

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_user(email):
    user = await users_collection.find_one({"email": email})
    return user

async def authenticate_user(email, password):
    user = await get_user(email)
    if not user:
        return False
    if not verify_password(password, user["hashed_password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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

async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active", False):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_verified_user(current_user: dict = Depends(get_current_active_user)):
    if not current_user.get("is_verified", False):
        raise HTTPException(status_code=400, detail="Email not verified")
    return current_user

async def generate_unique_url():
    while True:
        url = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
        existing = await files_collection.find_one({"url": url})
        if not existing:
            return url

async def get_user_file_count(user_id):
    return await files_collection.count_documents({"user_id": user_id})

async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        if not all([EMAIL_HOST, EMAIL_PORT, EMAIL_USERNAME, EMAIL_PASSWORD]):
            logger.error("Email configuration is incomplete")
            return False

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = EMAIL_FROM
        message["To"] = to_email
        
        text_part = MIMEText(html_content.replace('<br>', '\n'), "plain")
        html_part = MIMEText(html_content, "html")
        
        message.attach(text_part)
        message.attach(html_part)
        
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=10) as server:
            server.starttls()
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, message.as_string())
            
        logger.info(f"Email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error while sending email to {to_email}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error while sending email to {to_email}: {str(e)}")
        return False



@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/register", response_model=UserResponse)
async def register_user(email: str = Body(...), password: str = Body(...)):
    try:
        logger.info(f"Starting registration process for email: {email}")
        
        # Input validation
        if len(password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long"
            )
            
        user = UserCreate(email=email, password=password)
        
        # Check for existing user
        existing_user = await users_collection.find_one({"email": user.email})
        if existing_user:
            logger.warning(f"Registration attempted with existing email: {user.email}")
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        
        try:
            # Generate user data
            hashed_password = get_password_hash(user.password)
            verification_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            user_id = str(random.getrandbits(128))
            
            user_data = {
                "id": user_id,
                "email": user.email,
                "hashed_password": hashed_password,
                "is_active": True,
                "is_verified": False,
                "created_at": time.time()
            }
            
            # Create verification email content
            verification_email = f"""
            <html>
            <body>
            <h2>Verify Your Email</h2>
            <p>Thank you for registering! Please use the following code to verify your email:</p>
            <h3>{verification_code}</h3>
            <p>This code will expire in 1 hour.</p>
            </body>
            </html>
            """
            
            # Send verification email first
            email_sent = await send_email(user.email, "Verify Your Email", verification_email)
            if not email_sent:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to send verification email. Please try again."
                )
            
            # If email sent successfully, create user and verification records
            await users_collection.insert_one(user_data)
            logger.info(f"User created successfully with ID: {user_id}")
            
            await verification_collection.insert_one({
                "user_id": user_id,
                "email": user.email,
                "code": verification_code,
                "expires_at": time.time() + 3600 
            })
            logger.info(f"Verification record created for user: {user_id}")
            
            return {
                "id": user_id,
                "email": user.email,
                "is_verified": False,
                "url_count": 0
            }
            
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Error during user creation: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Failed to create user account. Please try again."
            )
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error during registration: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during registration"
        )

@app.post("/verify-email")
async def verify_email(email: EmailStr = Form(...), code: str = Form(...)):
    verification = await verification_collection.find_one({
        "email": email,
        "code": code,
        "expires_at": {"$gt": time.time()}
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    await users_collection.update_one(
        {"email": email},
        {"$set": {"is_verified": True}}
    )
    
    await verification_collection.delete_one({"email": email})
    
    return {"message": "Email verified successfully"}

@app.post("/resend-verification")
async def resend_verification(email: EmailStr = Form(...)):
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["is_verified"]:
        raise HTTPException(status_code=400, detail="Email already verified")
    
    await verification_collection.delete_one({"email": email})
    verification_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    await verification_collection.insert_one({
        "user_id": user["id"],
        "email": email,
        "code": verification_code,
        "expires_at": time.time() + 3600 
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
    await send_email(email, "Verify Your Email - Versz", verification_email)
    
    return {"message": "Verification email sent"}

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_verified": user.get("is_verified", False),
        "id": user["id"],
        "email": user["email"]
    }

@app.post("/request-password-reset")
async def request_password_reset(reset_request: UserPasswordReset):
    user = await users_collection.find_one({"email": reset_request.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reset_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    await password_reset_collection.insert_one({
        "email": reset_request.email,
        "code": reset_code,
        "expires_at": time.time() + 1800
    })
    reset_email = f"""
    <html>
    <body>
    <h2>Reset Your Password</h2>
    <p>We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
    <p>Your password reset code is:</p>
    <h3>{reset_code}</h3>
    <p>This code will expire in 30 minutes.</p>
    </body>
    </html>
    """
    await send_email(reset_request.email, "Password Reset - Versz", reset_email)
    
    return {"message": "Password reset email sent"}

@app.post("/reset-password")
async def reset_password(reset_data: UserPasswordChange):
    # Verify reset code
    reset_record = await password_reset_collection.find_one({
        "email": reset_data.email,
        "code": reset_data.reset_code,
        "expires_at": {"$gt": time.time()}
    })
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    
    hashed_password = get_password_hash(reset_data.new_password)
    await users_collection.update_one(
        {"email": reset_data.email},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    await password_reset_collection.delete_one({"email": reset_data.email})
    
    return {"message": "Password reset successfully"}

@app.get("/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_active_user)):
    url_count = await get_user_file_count(current_user["id"])
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "is_verified": current_user.get("is_verified", False),
        "url_count": url_count
    }

@app.post("/upload")
async def upload_file(
    file: UploadFile,
    custom_url: str = None,
    current_user: dict = Depends(get_current_verified_user)
):
    # Check user's file limit
    url_count = await get_user_file_count(current_user["id"])
    if url_count >= 10:
        raise HTTPException(status_code=400, detail="You have reached the maximum limit of 10 URLs")
    
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
        "created_at": time.time(),
        "user_id": current_user["id"]
    }
    
    await files_collection.insert_one(document)
    await views_collection.insert_one({
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
    existing_file = await files_collection.find_one({"url": url})
    if not existing_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if existing_file["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this file")
    
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    
    if not file.filename.endswith('.html'):
        raise HTTPException(status_code=400, detail="Only HTML files are allowed")
    
    await files_collection.update_one(
        {"url": url},
        {
            "$set": {
                "content": Binary(content),
                "filename": file.filename,
                "updated_at": time.time()
            }
        }
    )
    
    logger.info(f"File updated successfully: {file.filename} with URL: {url}")
    return {"message": "File updated successfully"}

@app.delete("/file/{url}")
async def delete_file(
    url: str,
    current_user: dict = Depends(get_current_verified_user)
):
    existing_file = await files_collection.find_one({"url": url})
    if not existing_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if existing_file["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this file")
    
    await files_collection.delete_one({"url": url})
    await views_collection.delete_one({"url": url})
    
    logger.info(f"File deleted successfully: {url}")
    return {"message": "File deleted successfully"}

@app.get("/file/{url}")
async def get_file(url: str):
    file = await files_collection.find_one({"url": url})
    if not file:
        logger.warning(f"File not found for URL: {url}")
        raise HTTPException(status_code=404, detail="File not found")
    
    result = await views_collection.find_one_and_update(
        {"url": url},
        {"$inc": {"views": 1}},
        upsert=True,
        return_document=True
    )
    
    views = result["views"] if result else 0
    
    logger.info(f"File retrieved successfully: {file['filename']}")
    return {
        "content": file["content"].decode(),
        "filename": file["filename"],
        "views": views
    }

@app.get("/views/{url}")
async def get_views(url: str):
    views_doc = await views_collection.find_one({"url": url})
    if not views_doc:
        return {"views": 0}
    return {"views": views_doc["views"]}

@app.get("/my-files")
async def get_user_files(current_user: dict = Depends(get_current_verified_user)):
    cursor = files_collection.find({"user_id": current_user["id"]})
    user_files = []
    async for file in cursor:
        views_doc = await views_collection.find_one({"url": file["url"]})
        views = views_doc["views"] if views_doc else 0
        user_files.append({
            "url": file["url"],
            "filename": file["filename"],
            "created_at": file["created_at"],
            "updated_at": file.get("updated_at"),
            "views": views
        })
    return user_files

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
        content={"detail": "Rate limit exceeded. Please try again later."},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
