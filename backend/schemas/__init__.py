"""
Pydantic Schemas for Multi-User Kisan Setu, 9-Stage Order Tracking, Deliveries, and Route Logistics.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# --- Auth & User Schemas ---
class UserSignup(BaseModel):
    name: str = Field(..., min_length=2, description="Full Name")
    email: str = Field(..., min_length=5, description="Email address")
    phone: str = Field(..., min_length=10, description="Mobile number")
    password: str = Field(..., min_length=6, description="Password")
    confirm_password: str = Field(..., min_length=6, description="Confirm Password")
    role: str = Field(..., description="FARMER_FPO or BUYER_CONSUMER")

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class FarmerProfileSchema(BaseModel):
    farm_name: str
    state: str = "Maharashtra"
    district: str = "Nashik"
    city: Optional[str] = None
    pincode: Optional[str] = None
    google_place_id: Optional[str] = None
    village_town: Optional[str] = None
    farm_location: str
    crops_grown: Optional[str] = "Tomato, Onion"
    farm_size_acres: Optional[float] = 5.0
    profile_photo: Optional[str] = "🧑‍🌾"
    preferred_language: Optional[str] = "English"
    lat: float = 19.9975
    lon: float = 73.7898

    class Config:
        from_attributes = True

class BuyerProfileSchema(BaseModel):
    business_name: Optional[str] = None
    buyer_type: str = "Retailer"
    state: str = "Maharashtra"
    district: str = "Mumbai City"
    city: Optional[str] = None
    pincode: Optional[str] = None
    google_place_id: Optional[str] = None
    address: str
    delivery_location: str
    profile_photo: Optional[str] = "🛒"
    lat: float = 19.0178
    lon: float = 72.8478

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    role: str
    is_active: bool = True
    wallet_balance: float = 0.0
    created_at: Optional[datetime] = None
    farmer_profile: Optional[FarmerProfileSchema] = None
    buyer_profile: Optional[BuyerProfileSchema] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Listing Schemas ---
class ListingCreate(BaseModel):
    crop: str
    variety: str = "Standard"
    quantity_kg: float = Field(..., gt=0)
    unit: str = "kg"
    quality_grade: str = "Grade A"
    harvest_date: str
    expected_avail_date: Optional[str] = None
    photo_url: Optional[str] = "🍅"
    farm_location: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    asking_price: float = Field(..., gt=0)
    base_mandi_price: Optional[float] = None
    ai_predicted_price: Optional[float] = None

class ListingUpdate(BaseModel):
    crop: Optional[str] = None
    variety: Optional[str] = None
    quantity_kg: Optional[float] = None
    available_kg: Optional[float] = None
    quality_grade: Optional[str] = None
    harvest_date: Optional[str] = None
    asking_price: Optional[float] = None
    status: Optional[str] = None

class ListingResponse(BaseModel):
    id: int
    farmer_id: int
    farmer_name: str
    crop: str
    variety: str
    quantity_kg: float
    available_kg: float
    unit: str
    quality_grade: str
    harvest_date: str
    expected_avail_date: Optional[str]
    photo_url: str
    farm_location: str
    state: str
    district: str
    lat: float
    lon: float
    base_mandi_price: float
    ai_predicted_price: float
    asking_price: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Delivery & Tracking Schemas ---
class DeliveryVehicleSchema(BaseModel):
    id: int
    vehicle_number: str
    vehicle_type: str
    capacity_kg: float
    current_status: str

    class Config:
        from_attributes = True

class DriverSchema(BaseModel):
    id: int
    name: str
    phone: str
    license_number: str

    class Config:
        from_attributes = True

class DeliveryProofCreate(BaseModel):
    receiver_name: str
    receiver_phone: Optional[str] = None
    delivery_notes: Optional[str] = "Produce crates inspected and accepted in good order."
    photo_url: Optional[str] = "📦 Verified Crate Seal Acceptance"
    signature_data: Optional[str] = None

class DeliveryProofResponse(BaseModel):
    id: int
    order_id: int
    receiver_name: str
    receiver_phone: Optional[str] = None
    delivery_notes: Optional[str] = None
    photo_url: Optional[str] = None
    delivered_at: datetime

    class Config:
        from_attributes = True

class DeliveryLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    location_name: str = "Checkpoint along Transit Corridor"
    notes: Optional[str] = None
    status: Optional[str] = None # Optionally transition status

class TrackingEventResponse(BaseModel):
    id: int
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: str
    timestamp: datetime
    notes: Optional[str] = None
    updated_by: Optional[str] = "System"

    class Config:
        from_attributes = True

class TimelineStep(BaseModel):
    stage: str
    step_number: int
    label: str
    is_completed: bool
    is_current: bool
    timestamp: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    listing_id: int
    quantity_kg: float = Field(..., gt=0)
    delivery_address: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lon: Optional[float] = None

class OrderStatusUpdate(BaseModel):
    status: str # 9 stages
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None

class OrderCardResponse(BaseModel):
    id: int
    order_code: str
    buyer_id: int
    buyer_name: str
    farmer_id: int
    farmer_name: str
    listing_id: int
    crop: str
    variety: str
    quantity_kg: float
    price_per_kg: float
    total_amount: float
    pickup_address: str
    pickup_lat: float
    pickup_lon: float
    delivery_address: str
    delivery_lat: float
    delivery_lon: float
    status: str
    status_label: str
    estimated_delivery_time: str
    created_at: datetime

    class Config:
        from_attributes = True

class OrderTrackingDetailResponse(BaseModel):
    order_id: int
    order_code: str
    crop: str
    variety: str
    quantity_kg: float
    price_per_kg: float
    total_amount: float
    
    # Farmer / Pickup Info
    farmer_id: int
    farmer_name: str
    farmer_phone: str
    pickup_address: str
    pickup_lat: float
    pickup_lon: float

    # Buyer / Destination Info
    buyer_id: int
    buyer_name: str
    buyer_phone: str
    delivery_address: str
    delivery_lat: float
    delivery_lon: float

    # Status & Timing
    status: str
    status_label: str
    is_delivered: bool
    estimated_delivery_time: str
    traffic_delay_minutes: int
    is_traffic_aware: bool

    # Live / Last Known Location
    last_known_location: Dict[str, Any]
    
    # Assigned Fleet & Driver
    vehicle: Optional[DeliveryVehicleSchema] = None
    driver: Optional[DriverSchema] = None

    # Complete 9-Stage Timeline
    timeline: List[TimelineStep]
    tracking_events: List[TrackingEventResponse]

    # Delivery Proof (if delivered)
    delivery_proof: Optional[DeliveryProofResponse] = None

    # OpenStreetMap / OSRM Routes Info
    distance_km: float
    duration_formatted: str
    encoded_polyline: Optional[str] = None
    route_geometry: Optional[Dict[str, Any]] = None # GeoJSON LineString coordinates

# --- Geocoding & OpenStreetMap Schemas ---
class GeocodeSearchResult(BaseModel):
    place_id: Optional[str] = None
    display_name: str
    name: Optional[str] = None
    main_text: Optional[str] = None
    secondary_text: Optional[str] = None
    description: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    village_town: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = "India"
    lat: float
    lon: float
    lng: Optional[float] = None

class ReverseGeocodeResult(BaseModel):
    lat: float
    lon: float
    lng: Optional[float] = None
    display_name: str
    formatted_address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    village_town: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = "India"
    place_id: Optional[str] = None

# --- Multi-Order Logistics Routing ---
class Coordinate(BaseModel):
    lat: float
    lng: Optional[float] = None
    lon: Optional[float] = None
    name: Optional[str] = None

class RouteStopInput(BaseModel):
    name: str
    lat: float
    lon: Optional[float] = None
    lng: Optional[float] = None
    type: Optional[str] = "STOP" # PICKUP, HUB, DELIVERY
    address: Optional[str] = None

class WaypointStop(BaseModel):
    name: str
    lat: float
    lng: Optional[float] = None
    lon: Optional[float] = None
    type: str # PICKUP or DELIVERY or HUB
    order_code: Optional[str] = None
    quantity_kg: Optional[float] = None
    contact_name: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = "PENDING"

class RouteLeg(BaseModel):
    from_stop: str
    to_stop: str
    distance_km: float
    duration_minutes: int
    duration_formatted: str

class RouteCalculateRequest(BaseModel):
    stops: Optional[List[RouteStopInput]] = None
    origin: Optional[Coordinate] = None
    destination: Optional[Coordinate] = None
    intermediates: Optional[List[WaypointStop]] = []
    travel_mode: Optional[str] = "DRIVE"
    optimize_stops: Optional[bool] = True
    optimize_waypoint_order: Optional[bool] = True

class RouteCalculateResponse(BaseModel):
    ordered_stops: List[Dict[str, Any]] = []
    route_geometry: Optional[Dict[str, Any]] = None # GeoJSON LineString coordinates
    total_distance_km: float = 0.0
    total_duration_minutes: int = 0
    total_duration_formatted: str = "0 min"
    distance_km: float = 0.0
    duration_minutes: int = 0
    duration_formatted: str = "0 min"
    traffic_duration_minutes: Optional[int] = None
    traffic_duration_formatted: Optional[str] = None
    encoded_polyline: Optional[str] = None
    stops: List[Dict[str, Any]] = []
    legs: List[RouteLeg] = []
    fuel_saved_inr: float = 0.0
    time_saved_minutes: int = 0
    co2_saved_kg: float = 0.0
    routing_engine: str = "OSRM (Open Source Routing Machine)"
    is_live_google_routes: bool = False
    summary: str = ""

class MultiOrderRouteOptimizeRequest(BaseModel):
    order_ids: List[int]
    vehicle_capacity_kg: Optional[float] = 1500.0

class MultiOrderRouteOptimizeResponse(BaseModel):
    route_code: str
    total_orders: int
    total_quantity_kg: float
    vehicle_capacity_kg: float
    capacity_utilization_pct: float
    total_distance_km: float
    total_duration_formatted: str
    fuel_saved_inr: float
    stops: List[Dict[str, Any]]
    route_geometry: Optional[Dict[str, Any]] = None
    encoded_polyline: Optional[str] = None

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Price Prediction & Demand Schemas ---
class PricePredictionRequest(BaseModel):
    crop: str = Field(..., description="Crop name (e.g. Tomato, Onion, Wheat, Potato)")
    variety: Optional[str] = "Standard"
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = "Nashik"
    market: Optional[str] = "Nashik"
    quantity: float = Field(default=1000.0, description="Quantity in kg")
    quality_grade: Optional[str] = "Grade A"
    harvest_date: Optional[str] = None
    target_prediction_date: Optional[str] = None
    prediction_horizon_days: Optional[int] = 7

class PredictionInterval(BaseModel):
    lower: float
    upper: float
    confidence: str = "95%"

class PricePredictionResponse(BaseModel):
    crop: str
    variety: str
    state: str
    district: str
    market: str
    quantity_kg: float
    quality_grade: str
    current_market_price: float
    predicted_price: float
    recommended_price: float
    nearby_market_average: Optional[float] = None
    currency: str = "INR"
    unit: str = "kg"
    price_trend: str
    demand: str
    prediction_horizon_days: int = 7
    confidence_or_prediction_interval: str
    prediction_interval: PredictionInterval
    model: str
    data_source: str
    explanation: str

class PriceHistoryPoint(BaseModel):
    date: str
    price: float
    type: str
    market: str

class DemandForecastItem(BaseModel):
    commodity: str
    demand_index: int
    trend: str
    expected_change_pct: float
    analysis: str
    daily_forecast: List[Dict[str, Any]]
