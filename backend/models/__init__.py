"""
SQLAlchemy ORM Models for Kisan Setu Multi-User & Professional Order/Delivery Tracking System.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="FARMER_FPO") # FARMER_FPO, BUYER_CONSUMER, DRIVER, ADMIN
    is_active = Column(Boolean, default=True)
    wallet_balance = Column(Float, default=0.0) # Farmer earnings / Buyer budget
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    farmer_profile = relationship("FarmerProfile", uselist=False, back_populates="user", cascade="all, delete-orphan", lazy="joined")
    buyer_profile = relationship("BuyerProfile", uselist=False, back_populates="user", cascade="all, delete-orphan", lazy="joined")
    listings = relationship("Listing", back_populates="farmer", cascade="all, delete-orphan")
    orders_placed = relationship("Order", foreign_keys="Order.buyer_id", back_populates="buyer")
    orders_received = relationship("Order", foreign_keys="Order.farmer_id", back_populates="farmer")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    saved_listings = relationship("SavedListing", back_populates="buyer", cascade="all, delete-orphan")
    driver_profile = relationship("Driver", uselist=False, back_populates="user")


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    farm_name = Column(String(150), nullable=False)
    state = Column(String(50), nullable=False, default="Maharashtra")
    district = Column(String(50), nullable=False, default="Nashik")
    city = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    google_place_id = Column(String(255), nullable=True)
    village_town = Column(String(100), nullable=True)
    farm_location = Column(String(255), nullable=False)
    crops_grown = Column(String(255), default="Tomato, Onion")
    farm_size_acres = Column(Float, nullable=True, default=5.0)
    profile_photo = Column(String(255), default="🧑‍🌾")
    preferred_language = Column(String(30), default="English")
    lat = Column(Float, default=19.9975)
    lon = Column(Float, default=73.7898)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="farmer_profile")


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    business_name = Column(String(150), nullable=True)
    buyer_type = Column(String(50), default="Retailer") # Retailer, Wholesaler, Restaurant, Food processor, Individual consumer, Other
    state = Column(String(50), nullable=False, default="Maharashtra")
    district = Column(String(50), nullable=False, default="Mumbai City")
    city = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    google_place_id = Column(String(255), nullable=True)
    address = Column(String(255), nullable=False)
    delivery_location = Column(String(255), nullable=False)
    profile_photo = Column(String(255), default="🛒")
    lat = Column(Float, default=19.0178)
    lon = Column(Float, default=72.8478)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="buyer_profile")


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    farmer_name = Column(String(100), nullable=False)
    crop = Column(String(50), index=True, nullable=False)
    variety = Column(String(50), nullable=False, default="Standard")
    quantity_kg = Column(Float, nullable=False)
    available_kg = Column(Float, nullable=False)
    unit = Column(String(10), default="kg")
    quality_grade = Column(String(20), nullable=False, default="Grade A")
    harvest_date = Column(String(30), nullable=False)
    expected_avail_date = Column(String(30), nullable=True)
    photo_url = Column(String(255), default="🍅")
    farm_location = Column(String(255), nullable=False)
    state = Column(String(50), nullable=False, default="Maharashtra")
    district = Column(String(50), nullable=False, default="Nashik")
    lat = Column(Float, default=19.9975)
    lon = Column(Float, default=73.7898)
    base_mandi_price = Column(Float, default=0.0)
    ai_predicted_price = Column(Float, default=0.0)
    asking_price = Column(Float, nullable=False)
    status = Column(String(20), default="ACTIVE") # ACTIVE, SOLD_OUT, CANCELLED, PAUSED
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    farmer = relationship("User", back_populates="listings")
    orders = relationship("Order", back_populates="listing")


class DeliveryVehicle(Base):
    __tablename__ = "delivery_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(30), unique=True, index=True, nullable=False) # e.g. MH-15-EG-4482
    vehicle_type = Column(String(50), default="Mini Truck (14ft)") # Mini Truck, Eicher 17ft, Pickup Van, Refrigerated Truck
    capacity_kg = Column(Float, default=1500.0)
    current_status = Column(String(30), default="AVAILABLE") # AVAILABLE, IN_TRANSIT, MAINTENANCE
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    deliveries = relationship("Delivery", back_populates="vehicle")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    license_number = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="driver_profile")
    deliveries = relationship("Delivery", back_populates="driver")


class DeliveryRoute(Base):
    __tablename__ = "delivery_routes"

    id = Column(Integer, primary_key=True, index=True)
    route_code = Column(String(30), unique=True, index=True, nullable=False) # e.g. RT-2026-NASHIK-MUMBAI
    origin_name = Column(String(150), nullable=False)
    origin_lat = Column(Float, nullable=False)
    origin_lon = Column(Float, nullable=False)
    destination_name = Column(String(150), nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lon = Column(Float, nullable=False)
    total_distance_km = Column(Float, default=0.0)
    total_duration_minutes = Column(Integer, default=0)
    duration_formatted = Column(String(50), default="2 hr 15 min")
    traffic_duration_minutes = Column(Integer, nullable=True)
    traffic_duration_formatted = Column(String(50), nullable=True)
    fuel_saved_inr = Column(Float, default=0.0)
    co2_saved_kg = Column(Float, default=0.0)
    encoded_polyline = Column(Text, nullable=True)
    status = Column(String(30), default="PLANNED") # PLANNED, ACTIVE, COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)

    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan")
    deliveries = relationship("Delivery", back_populates="route")


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("delivery_routes.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    stop_sequence = Column(Integer, nullable=False)
    stop_type = Column(String(20), nullable=False) # PICKUP, INTERMEDIATE_HUB, DELIVERY
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    quantity_kg = Column(Float, default=0.0)
    contact_name = Column(String(100), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    status = Column(String(30), default="PENDING") # PENDING, COMPLETED, SKIPPED
    completed_at = Column(DateTime, nullable=True)

    route = relationship("DeliveryRoute", back_populates="stops")
    order = relationship("Order")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(30), unique=True, index=True, nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    buyer_name = Column(String(100), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    farmer_name = Column(String(100), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    crop = Column(String(50), nullable=False)
    variety = Column(String(50), default="Standard")
    quantity_kg = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    pickup_address = Column(String(255), nullable=False)
    pickup_lat = Column(Float, default=19.9975)
    pickup_lon = Column(Float, default=73.7898)
    delivery_address = Column(String(255), nullable=False)
    delivery_lat = Column(Float, default=19.0178)
    delivery_lon = Column(Float, default=72.8478)
    
    # 9-Stage Status
    # ORDER_PLACED, ORDER_CONFIRMED, PACKING, READY_FOR_PICKUP, PICKED_UP, IN_TRANSIT, NEAR_DESTINATION, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
    status = Column(String(30), default="ORDER_PLACED")
    estimated_delivery_time = Column(String(50), default="Today, 4:35 PM")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="orders_placed")
    farmer = relationship("User", foreign_keys=[farmer_id], back_populates="orders_received")
    listing = relationship("Listing", back_populates="orders")
    delivery = relationship("Delivery", uselist=False, back_populates="order", cascade="all, delete-orphan")
    tracking_events = relationship("TrackingEvent", back_populates="order", cascade="all, delete-orphan")
    delivery_proof = relationship("DeliveryProof", uselist=False, back_populates="order", cascade="all, delete-orphan")


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    vehicle_id = Column(Integer, ForeignKey("delivery_vehicles.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    route_id = Column(Integer, ForeignKey("delivery_routes.id"), nullable=True)
    status = Column(String(30), default="ORDER_PLACED") # Mirrors or refines order status
    current_lat = Column(Float, default=19.9975)
    current_lon = Column(Float, default=73.7898)
    last_location_name = Column(String(150), default="Farm Gate, Nashik")
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    estimated_arrival = Column(String(50), default="Today, 4:35 PM")
    traffic_duration_minutes = Column(Integer, nullable=True)
    traffic_delay_minutes = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    # Relationships
    order = relationship("Order", back_populates="delivery")
    vehicle = relationship("DeliveryVehicle", back_populates="deliveries")
    driver = relationship("Driver", back_populates="deliveries")
    route = relationship("DeliveryRoute", back_populates="deliveries")
    proof = relationship("DeliveryProof", uselist=False, back_populates="delivery", cascade="all, delete-orphan")


class DeliveryProof(Base):
    __tablename__ = "delivery_proofs"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), unique=True, nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    receiver_name = Column(String(100), nullable=False)
    receiver_phone = Column(String(20), nullable=True)
    delivery_notes = Column(Text, nullable=True)
    photo_url = Column(String(255), default="📦 Verified Crate Seal Acceptance")
    signature_data = Column(Text, nullable=True)
    delivered_at = Column(DateTime, default=datetime.utcnow)

    delivery = relationship("Delivery", back_populates="proof")
    order = relationship("Order", back_populates="delivery_proof")


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=True)
    status = Column(String(30), nullable=False) # 9 stages
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(150), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    updated_by = Column(String(100), default="System") # Driver, Farmer, Buyer, Dispatch Engine

    order = relationship("Order", back_populates="tracking_events")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="INFO") # ORDER, PRICE, DELIVERY, SYSTEM
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class SavedListing(Base):
    __tablename__ = "saved_listings"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship("User", back_populates="saved_listings")
    listing = relationship("Listing")


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), index=True, nullable=False)
    commodity = Column(String(50), index=True, nullable=False)
    variety = Column(String(50), nullable=False)
    state = Column(String(50), nullable=False)
    district = Column(String(50), nullable=False)
    market = Column(String(50), index=True, nullable=False)
    min_price = Column(Float, nullable=False)
    max_price = Column(Float, nullable=False)
    modal_price = Column(Float, nullable=False)
    arrival_quantity = Column(Float, nullable=False)
