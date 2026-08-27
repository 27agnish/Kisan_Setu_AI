"""
Buyer Marketplace Search, Discovery & Saved Listings for Kisan Setu.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import math

from backend.database import get_db
from backend.models import Listing, SavedListing, User
from backend.security import get_current_user

router = APIRouter(prefix="/api/marketplace", tags=["Buyer Marketplace"])

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

from sqlalchemy import or_

@router.get("", response_model=List[Dict[str, Any]])
def get_marketplace(
    q: Optional[str] = None,
    location: Optional[str] = None,
    crop: Optional[str] = None,
    variety: Optional[str] = None,
    max_price: Optional[float] = None,
    min_quantity: Optional[float] = None,
    quality_grade: Optional[str] = None,
    sort_by: Optional[str] = "date_desc",
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Browse all available agricultural produce in the marketplace with real distance calculations."""
    query = db.query(Listing).filter(Listing.status == "ACTIVE", Listing.available_kg > 0)
    
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Listing.crop.ilike(term),
                Listing.variety.ilike(term),
                Listing.farmer_name.ilike(term),
                Listing.farm_location.ilike(term),
                Listing.district.ilike(term),
                Listing.state.ilike(term)
            )
        )
    if location and location.strip():
        loc_term = f"%{location.strip()}%"
        query = query.filter(
            or_(
                Listing.farm_location.ilike(loc_term),
                Listing.district.ilike(loc_term),
                Listing.state.ilike(loc_term)
            )
        )
    if crop and crop.lower() != "all":
        query = query.filter(Listing.crop.ilike(f"%{crop.strip()}%"))
    if variety:
        query = query.filter(Listing.variety.ilike(f"%{variety.strip()}%"))
    if max_price:
        query = query.filter(Listing.asking_price <= max_price)
    if min_quantity:
        query = query.filter(Listing.available_kg >= min_quantity)
    if quality_grade and quality_grade.lower() != "all":
        query = query.filter(Listing.quality_grade == quality_grade)
        
    listings = query.all()
    
    # Get buyer coordinates if available
    buyer_lat = 19.0178
    buyer_lon = 72.8478
    if current_user and current_user.buyer_profile:
        buyer_lat = current_user.buyer_profile.lat
        buyer_lon = current_user.buyer_profile.lon
        
    # Get saved listing IDs
    saved_ids = set()
    if current_user:
        saved_rows = db.query(SavedListing.listing_id).filter(SavedListing.buyer_id == current_user.id).all()
        saved_ids = {r[0] for r in saved_rows}

    results = []
    for l in listings:
        mandi_rate = l.base_mandi_price or round(l.asking_price * 0.8, 1)
        retail_est = round(l.asking_price * 1.25, 1)
        buyer_savings_pct = max(5, int(((retail_est - l.asking_price) / retail_est) * 100))
        
        # Real distance between buyer and farm coordinates
        dist_km = round(haversine_distance(buyer_lat, buyer_lon, l.lat, l.lon), 1)
        
        results.append({
            "id": l.id,
            "farmer_id": l.farmer_id,
            "farmer_name": l.farmer_name,
            "crop": l.crop,
            "variety": l.variety,
            "quantity_kg": l.quantity_kg,
            "available_kg": l.available_kg,
            "unit": l.unit,
            "quality_grade": l.quality_grade,
            "harvest_date": l.harvest_date,
            "expected_avail_date": l.expected_avail_date,
            "photo_url": l.photo_url,
            "farm_location": l.farm_location,
            "state": l.state,
            "district": l.district,
            "lat": l.lat,
            "lon": l.lon,
            "asking_price": l.asking_price,
            "base_mandi_price": mandi_rate,
            "ai_predicted_price": l.ai_predicted_price,
            "retail_estimated_price": retail_est,
            "buyer_savings_pct": buyer_savings_pct,
            "status": l.status,
            "badge": "FRESH" if l.available_kg < 2000 else "BULK",
            "distance_km": dist_km,
            "is_saved": l.id in saved_ids
        })
        
    if sort_by == "price_asc":
        results.sort(key=lambda x: x["asking_price"])
    elif sort_by == "price_desc":
        results.sort(key=lambda x: x["asking_price"], reverse=True)
    elif sort_by == "qty_desc":
        results.sort(key=lambda x: x["available_kg"], reverse=True)
    elif sort_by == "dist_asc":
        results.sort(key=lambda x: x["distance_km"])
    else:
        results.sort(key=lambda x: x["id"], reverse=True)
        
    return results

@router.post("/save/{listing_id}")
def toggle_save_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bookmark or remove a produce listing from saved items."""
    existing = db.query(SavedListing).filter(
        SavedListing.buyer_id == current_user.id,
        SavedListing.listing_id == listing_id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False, "message": "Removed from saved listings."}
    else:
        new_save = SavedListing(buyer_id=current_user.id, listing_id=listing_id)
        db.add(new_save)
        db.commit()
        return {"saved": True, "message": "Listing saved to favorites."}

@router.get("/saved", response_model=List[Dict[str, Any]])
def get_saved_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all listings bookmarked by the logged in buyer."""
    saved = db.query(SavedListing).filter(SavedListing.buyer_id == current_user.id).all()
    listing_ids = [s.listing_id for s in saved]
    listings = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    
    results = []
    for l in listings:
        results.append({
            "id": l.id,
            "farmer_name": l.farmer_name,
            "crop": l.crop,
            "variety": l.variety,
            "available_kg": l.available_kg,
            "asking_price": l.asking_price,
            "farm_location": l.farm_location,
            "photo_url": l.photo_url,
            "status": l.status,
            "quality_grade": l.quality_grade
        })
    return results
