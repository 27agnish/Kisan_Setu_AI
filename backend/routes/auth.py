"""
Authentication & Multi-User Profile Routes for Kisan Setu.
Handles real signup, bcrypt authentication, role-specific profile setup, and JWT sessions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.database import get_db
from backend.models import User, FarmerProfile, BuyerProfile, Notification
from backend.schemas import (
    UserSignup, UserLogin, ForgotPasswordRequest,
    TokenResponse, UserResponse,
    FarmerProfileSchema, BuyerProfileSchema,
    NotificationResponse
)
from backend.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication & Profiles"])

@router.post("/signup", response_model=TokenResponse)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    """Register a new Farmer/FPO or Buyer/Consumer."""
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match. Please verify your password."
        )
        
    email_clean = user_data.email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )
        
    role_clean = "FARMER_FPO" if "FARMER" in user_data.role.upper() else "BUYER_CONSUMER"
    
    new_user = User(
        name=user_data.name.strip(),
        email=email_clean,
        phone=user_data.phone.strip(),
        password_hash=hash_password(user_data.password),
        role=role_clean,
        wallet_balance=0.0
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Welcome notification
    welcome_notif = Notification(
        user_id=new_user.id,
        title="Welcome to Kisan Setu",
        message=f"Welcome {new_user.name}! Please complete your {'farm' if role_clean == 'FARMER_FPO' else 'delivery'} profile to begin.",
        type="SYSTEM"
    )
    db.add(welcome_notif)
    db.commit()

    token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user with email & password and return a signed JWT token."""
    email_clean = login_data.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials.",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Simulate secure password reset token delivery."""
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if not user:
        # Don't leak user existence in production, but confirm email received
        return {"message": "If an account with this email exists, a password reset link has been dispatched."}
        
    return {
        "message": f"Password reset instructions have been sent to {req.email}.",
        "reset_token_preview": "KS-RESET-" + str(user.id) + "-SECURE"
    }

@router.post("/profile/setup", response_model=UserResponse)
def setup_profile(
    profile_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sets up the role-specific profile (Farmer Farm location or Buyer Delivery address)
    with precise latitude and longitude captured from Google Maps.
    """
    lat = float(profile_data.get("lat", 19.9975 if current_user.role == "FARMER_FPO" else 19.0178))
    lon = float(profile_data.get("lon", 73.7898 if current_user.role == "FARMER_FPO" else 72.8478))
    
    if current_user.role == "FARMER_FPO":
        farm_name = profile_data.get("farm_name", f"{current_user.name}'s Farm")
        farm_location = profile_data.get("farm_location") or profile_data.get("address", "Nashik, Maharashtra")
        
        if current_user.farmer_profile:
            fp = current_user.farmer_profile
            fp.farm_name = farm_name
            fp.farm_location = farm_location
            fp.state = profile_data.get("state", fp.state)
            fp.district = profile_data.get("district", fp.district)
            fp.city = profile_data.get("city", fp.city)
            fp.pincode = profile_data.get("pincode", fp.pincode)
            fp.google_place_id = profile_data.get("google_place_id", fp.google_place_id)
            fp.village_town = profile_data.get("village_town", fp.village_town)
            fp.crops_grown = profile_data.get("crops_grown", fp.crops_grown)
            fp.farm_size_acres = float(profile_data.get("farm_size_acres", fp.farm_size_acres or 5.0))
            fp.profile_photo = profile_data.get("profile_photo", fp.profile_photo)
            fp.preferred_language = profile_data.get("preferred_language", fp.preferred_language)
            fp.lat = lat
            fp.lon = lon
        else:
            fp = FarmerProfile(
                user_id=current_user.id,
                farm_name=farm_name,
                farm_location=farm_location,
                state=profile_data.get("state", "Maharashtra"),
                district=profile_data.get("district", "Nashik"),
                city=profile_data.get("city", ""),
                pincode=profile_data.get("pincode", ""),
                google_place_id=profile_data.get("google_place_id", ""),
                village_town=profile_data.get("village_town", ""),
                crops_grown=profile_data.get("crops_grown", "Tomato, Onion"),
                farm_size_acres=float(profile_data.get("farm_size_acres", 5.0)),
                profile_photo=profile_data.get("profile_photo", "🧑‍🌾"),
                preferred_language=profile_data.get("preferred_language", "English"),
                lat=lat,
                lon=lon
            )
            db.add(fp)
    else:
        # BUYER_CONSUMER
        business_name = profile_data.get("business_name", current_user.name)
        delivery_loc = profile_data.get("delivery_location") or profile_data.get("address", "Mumbai, Maharashtra")
        address = profile_data.get("address", delivery_loc)
        buyer_type = profile_data.get("buyer_type", "Retailer")
        
        if current_user.buyer_profile:
            bp = current_user.buyer_profile
            bp.business_name = business_name
            bp.buyer_type = buyer_type
            bp.state = profile_data.get("state", bp.state)
            bp.district = profile_data.get("district", bp.district)
            bp.city = profile_data.get("city", bp.city)
            bp.pincode = profile_data.get("pincode", bp.pincode)
            bp.google_place_id = profile_data.get("google_place_id", bp.google_place_id)
            bp.address = address
            bp.delivery_location = delivery_loc
            bp.profile_photo = profile_data.get("profile_photo", bp.profile_photo)
            bp.lat = lat
            bp.lon = lon
        else:
            bp = BuyerProfile(
                user_id=current_user.id,
                business_name=business_name,
                buyer_type=buyer_type,
                state=profile_data.get("state", "Maharashtra"),
                district=profile_data.get("district", "Mumbai City"),
                city=profile_data.get("city", ""),
                pincode=profile_data.get("pincode", ""),
                google_place_id=profile_data.get("google_place_id", ""),
                address=address,
                delivery_location=delivery_loc,
                profile_photo=profile_data.get("profile_photo", "🛒"),
                lat=lat,
                lon=lon
            )
            db.add(bp)
            
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve currently authenticated user and profile information."""
    return current_user

@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update profile attributes."""
    if "name" in data:
        current_user.name = data["name"].strip()
    if "phone" in data:
        current_user.phone = data["phone"].strip()
        
    return setup_profile(data, current_user, db)

@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve notifications for the logged-in user."""
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()

@router.patch("/notifications/{id}/read")
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(Notification.id == id, Notification.user_id == current_user.id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}
