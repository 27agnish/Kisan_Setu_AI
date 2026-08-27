"""
Farmer Produce Listing Management Routes with Role Protection for Kisan Setu.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models import Listing, User, Notification
from backend.schemas import ListingCreate, ListingUpdate, ListingResponse
from backend.security import get_current_user

router = APIRouter(prefix="/api/listings", tags=["Farmer Listings"])

CROP_EMOJIS = {
    "Tomato": "🍅",
    "Onion": "🧅",
    "Wheat": "🌾",
    "Potato": "🥔",
    "Rice": "🍚",
    "Maize": "🌽",
    "Soybean": "🌱",
    "Garlic": "🧄",
    "Chilli": "🌶️",
}

@router.get("", response_model=List[ListingResponse])
def get_farmer_listings(
    status: Optional[str] = "ACTIVE",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve listings owned by the authenticated farmer/FPO."""
    query = db.query(Listing).filter(Listing.farmer_id == current_user.id)
    if status and status != "ALL":
        query = query.filter(Listing.status == status.upper())
    return query.order_by(Listing.created_at.desc()).all()

@router.get("/{id}", response_model=ListingResponse)
def get_listing_by_id(id: int, db: Session = Depends(get_db)):
    """Fetch single listing details."""
    listing = db.query(Listing).filter(Listing.id == id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Crop listing not found.")
    return listing

@router.post("", response_model=ListingResponse)
def create_listing(
    listing_in: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new farmer produce listing (Farmer/FPO role only)."""
    if current_user.role != "FARMER_FPO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered Farmers and FPOs can list produce for sale."
        )
        
    crop_name = listing_in.crop.strip().capitalize()
    emoji = listing_in.photo_url if (listing_in.photo_url and len(listing_in.photo_url) <= 4) else CROP_EMOJIS.get(crop_name, "🌿")
    
    # Extract coordinates from farmer profile if not supplied in form
    fp = current_user.farmer_profile
    lat = listing_in.lat or (fp.lat if fp else 19.9975)
    lon = listing_in.lon or (fp.lon if fp else 73.7898)
    farm_loc = listing_in.farm_location or (fp.farm_location if fp else "Nashik, Maharashtra")
    state = listing_in.state or (fp.state if fp else "Maharashtra")
    district = listing_in.district or (fp.district if fp else "Nashik")
    
    new_listing = Listing(
        farmer_id=current_user.id,
        farmer_name=current_user.name,
        crop=crop_name,
        variety=listing_in.variety.strip().title(),
        quantity_kg=float(listing_in.quantity_kg),
        available_kg=float(listing_in.quantity_kg),
        unit=listing_in.unit or "kg",
        quality_grade=listing_in.quality_grade,
        harvest_date=listing_in.harvest_date,
        expected_avail_date=listing_in.expected_avail_date or listing_in.harvest_date,
        photo_url=emoji,
        farm_location=farm_loc,
        state=state,
        district=district,
        lat=lat,
        lon=lon,
        base_mandi_price=listing_in.base_mandi_price or (listing_in.asking_price * 0.75),
        ai_predicted_price=listing_in.ai_predicted_price or listing_in.asking_price,
        asking_price=float(listing_in.asking_price),
        status="ACTIVE"
    )
    
    db.add(new_listing)
    db.commit()
    db.refresh(new_listing)
    return new_listing

@router.put("/{id}", response_model=ListingResponse)
def update_listing(
    id: int,
    listing_update: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing produce listing (Owner only)."""
    listing = db.query(Listing).filter(Listing.id == id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")
        
    if listing.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this listing.")
        
    update_data = listing_update.dict(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(listing, field, val)
            
    if "quantity_kg" in update_data and "available_kg" not in update_data:
        listing.available_kg = min(listing.available_kg, listing.quantity_kg)
        
    db.commit()
    db.refresh(listing)
    return listing

@router.delete("/{id}")
def delete_listing(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a produce listing (Owner only)."""
    listing = db.query(Listing).filter(Listing.id == id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found.")
        
    if listing.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this listing.")
        
    db.delete(listing)
    db.commit()
    return {"message": "Listing deleted successfully", "id": id}
