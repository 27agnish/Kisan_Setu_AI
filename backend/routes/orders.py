"""
Orders Lifecycle Management Routes for Kisan Setu.
Supports 9-stage progression, stock reservation, driver assignment, and transaction settlements.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import random

from backend.database import get_db
from backend.models import (
    Order, Listing, User, Delivery, DeliveryVehicle, Driver,
    TrackingEvent, Notification, DeliveryProof
)
from backend.schemas import OrderCreate, OrderStatusUpdate, OrderCardResponse
from backend.security import get_current_user

router = APIRouter(prefix="/api/orders", tags=["Orders & Fulfillment"])

STAGE_TITLES = {
    "ORDER_PLACED": ("Order Placed", "Order placed by buyer and queued for farm allocation."),
    "ORDER_CONFIRMED": ("Farmer Confirmed", "Farmer acknowledged order and locked harvest allotment."),
    "PACKING": ("Quality Grading & Packing", "Produce graded, weighed into crates, and sealed."),
    "READY_FOR_PICKUP": ("Ready for Pickup", "Crates staged at farm gate; carrier dispatched."),
    "PICKED_UP": ("Picked Up from Farm", "Loaded into freight vehicle MH-15-EG-4482."),
    "IN_TRANSIT": ("In Transit on Highway", "En route via NH-160 highway corridor with live GPS checkpoints."),
    "NEAR_DESTINATION": ("Near Destination", "Approaching destination city aggregation limits."),
    "OUT_FOR_DELIVERY": ("Out for Final Delivery", "Vehicle entering local sector for doorstep delivery."),
    "DELIVERED": ("Delivered & Settled", "Produce inspected, accepted by receiver, and payout settled."),
    "CANCELLED": ("Order Cancelled", "Order was cancelled and produce stock restored.")
}

@router.post("", response_model=OrderCardResponse)
def place_order(
    order_in: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Place a direct purchase order from a farmer's produce listing."""
    if current_user.role != "BUYER_CONSUMER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered Buyers can place produce orders."
        )

    listing = db.query(Listing).filter(Listing.id == order_in.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Produce listing not found.")

    if listing.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Listing is {listing.status}.")

    qty = float(order_in.quantity_kg)
    if qty > listing.available_kg:
        raise HTTPException(
            status_code=400,
            detail=f"Requested quantity ({qty:,.0f} kg) exceeds available stock ({listing.available_kg:,.0f} kg)."
        )

    # Delivery location details
    bp = current_user.buyer_profile
    del_address = order_in.delivery_address or (bp.delivery_location if bp else "Mumbai, Maharashtra")
    del_lat = order_in.delivery_lat or (bp.lat if bp else 19.0178)
    del_lon = order_in.delivery_lon or (bp.lon if bp else 72.8478)

    price_per_kg = float(listing.asking_price)
    total_amount = round(qty * price_per_kg, 2)
    order_code = f"KS-{random.randint(1000, 9999)}"

    new_order = Order(
        order_code=order_code,
        buyer_id=current_user.id,
        buyer_name=current_user.name,
        farmer_id=listing.farmer_id,
        farmer_name=listing.farmer_name,
        listing_id=listing.id,
        crop=listing.crop,
        variety=listing.variety,
        quantity_kg=qty,
        price_per_kg=price_per_kg,
        total_amount=total_amount,
        pickup_address=listing.farm_location,
        pickup_lat=listing.lat,
        pickup_lon=listing.lon,
        delivery_address=del_address,
        delivery_lat=del_lat,
        delivery_lon=del_lon,
        status="ORDER_PLACED",
        estimated_delivery_time="Today, 4:35 PM"
    )
    db.add(new_order)

    # Deduct available inventory
    listing.available_kg = round(listing.available_kg - qty, 2)
    if listing.available_kg <= 0.01:
        listing.available_kg = 0.0
        listing.status = "SOLD_OUT"

    db.commit()
    db.refresh(new_order)

    # Assign default Vehicle & Driver for delivery
    vehicle = db.query(DeliveryVehicle).first()
    driver = db.query(Driver).first()

    delivery = Delivery(
        order_id=new_order.id,
        vehicle_id=vehicle.id if vehicle else None,
        driver_id=driver.id if driver else None,
        status="ORDER_PLACED",
        current_lat=new_order.pickup_lat,
        current_lon=new_order.pickup_lon,
        last_location_name=f"Farm Gate ({new_order.pickup_address})",
        estimated_arrival="Today, 4:35 PM",
        last_updated=datetime.utcnow()
    )
    db.add(delivery)

    # Initial Stage Tracking Event
    event = TrackingEvent(
        order_id=new_order.id,
        delivery_id=delivery.id,
        status="ORDER_PLACED",
        latitude=listing.lat,
        longitude=listing.lon,
        location_name=listing.farm_location,
        timestamp=datetime.utcnow(),
        notes=f"Direct order placed by {current_user.name} for {qty:,.0f} kg {listing.crop} at ₹{price_per_kg}/kg.",
        updated_by=current_user.name
    )
    db.add(event)

    # Notifications
    notif_farmer = Notification(
        user_id=listing.farmer_id,
        title="New Order Received",
        message=f"{current_user.name} ordered {qty:,.0f} kg of {listing.crop} (Order #{order_code}).",
        type="ORDER"
    )
    notif_buyer = Notification(
        user_id=current_user.id,
        title="Order Confirmation",
        message=f"Order #{order_code} for {qty:,.0f} kg of {listing.crop} placed successfully.",
        type="ORDER"
    )
    db.add_all([notif_farmer, notif_buyer])
    db.commit()
    db.refresh(new_order)

    return OrderCardResponse(
        id=new_order.id,
        order_code=new_order.order_code,
        buyer_id=new_order.buyer_id,
        buyer_name=new_order.buyer_name,
        farmer_id=new_order.farmer_id,
        farmer_name=new_order.farmer_name,
        listing_id=new_order.listing_id,
        crop=new_order.crop,
        variety=new_order.variety,
        quantity_kg=new_order.quantity_kg,
        price_per_kg=new_order.price_per_kg,
        total_amount=new_order.total_amount,
        pickup_address=new_order.pickup_address,
        pickup_lat=new_order.pickup_lat,
        pickup_lon=new_order.pickup_lon,
        delivery_address=new_order.delivery_address,
        delivery_lat=new_order.delivery_lat,
        delivery_lon=new_order.delivery_lon,
        status=new_order.status,
        status_label="Order Placed",
        estimated_delivery_time=new_order.estimated_delivery_time,
        created_at=new_order.created_at
    )

@router.get("", response_model=List[OrderCardResponse])
def get_orders(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all orders relevant to the authenticated Farmer or Buyer."""
    query = db.query(Order)

    if current_user.role == "FARMER_FPO":
        query = query.filter(Order.farmer_id == current_user.id)
    else:
        query = query.filter(Order.buyer_id == current_user.id)

    if status and status != "ALL":
        query = query.filter(Order.status == status.upper())

    orders = query.order_by(Order.created_at.desc()).all()

    results = []
    for o in orders:
        title, _ = STAGE_TITLES.get(o.status, (o.status.replace("_", " ").title(), ""))
        results.append(OrderCardResponse(
            id=o.id,
            order_code=o.order_code,
            buyer_id=o.buyer_id,
            buyer_name=o.buyer_name,
            farmer_id=o.farmer_id,
            farmer_name=o.farmer_name,
            listing_id=o.listing_id,
            crop=o.crop,
            variety=o.variety,
            quantity_kg=o.quantity_kg,
            price_per_kg=o.price_per_kg,
            total_amount=o.total_amount,
            pickup_address=o.pickup_address,
            pickup_lat=o.pickup_lat,
            pickup_lon=o.pickup_lon,
            delivery_address=o.delivery_address,
            delivery_lat=o.delivery_lat,
            delivery_lon=o.delivery_lon,
            status=o.status,
            status_label=title,
            estimated_delivery_time=o.estimated_delivery_time or "Today, 4:35 PM",
            created_at=o.created_at
        ))
    return results

@router.get("/{id}", response_model=OrderCardResponse)
def get_order_by_id(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch single order card summary by ID."""
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.buyer_id != current_user.id and order.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this order.")

    title, _ = STAGE_TITLES.get(order.status, (order.status.replace("_", " ").title(), ""))
    return OrderCardResponse(
        id=order.id,
        order_code=order.order_code,
        buyer_id=order.buyer_id,
        buyer_name=order.buyer_name,
        farmer_id=order.farmer_id,
        farmer_name=order.farmer_name,
        listing_id=order.listing_id,
        crop=order.crop,
        variety=order.variety,
        quantity_kg=order.quantity_kg,
        price_per_kg=order.price_per_kg,
        total_amount=order.total_amount,
        pickup_address=order.pickup_address,
        pickup_lat=order.pickup_lat,
        pickup_lon=order.pickup_lon,
        delivery_address=order.delivery_address,
        delivery_lat=order.delivery_lat,
        delivery_lon=order.delivery_lon,
        status=order.status,
        status_label=title,
        estimated_delivery_time=order.estimated_delivery_time or "Today, 4:35 PM",
        created_at=order.created_at
    )

@router.post("/{id}/status")
@router.patch("/{id}/status")
def update_order_status(
    id: int,
    update: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Advance order through any of the 9 fulfillment stages:
    ORDER_PLACED -> ORDER_CONFIRMED -> PACKING -> READY_FOR_PICKUP ->
    PICKED_UP -> IN_TRANSIT -> NEAR_DESTINATION -> OUT_FOR_DELIVERY -> DELIVERED
    """
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    new_status = update.status.upper()
    if new_status not in STAGE_TITLES:
        # Map abbreviations if sent
        if new_status == "CONFIRMED": new_status = "ORDER_CONFIRMED"
        elif new_status == "PLACED": new_status = "ORDER_PLACED"
        elif new_status == "PACKED": new_status = "PACKING"

    order.status = new_status
    order.updated_at = datetime.utcnow()

    # Synchronize Delivery record
    delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()
    if not delivery:
        vehicle = db.query(DeliveryVehicle).first()
        driver = db.query(Driver).first()
        delivery = Delivery(
            order_id=order.id,
            vehicle_id=vehicle.id if vehicle else None,
            driver_id=driver.id if driver else None,
            status=new_status,
            current_lat=order.pickup_lat,
            current_lon=order.pickup_lon,
            last_location_name=order.pickup_address
        )
        db.add(delivery)

    delivery.status = new_status
    delivery.last_updated = datetime.utcnow()

    title, default_desc = STAGE_TITLES.get(new_status, (new_status.title(), "Status updated."))

    # Determine coordinates for the stage
    if new_status == "DELIVERED":
        lat = order.delivery_lat
        lon = order.delivery_lon
        loc_name = order.delivery_address
        delivery.delivered_at = datetime.utcnow()
    elif new_status in ["NEAR_DESTINATION", "OUT_FOR_DELIVERY"]:
        lat = round(order.delivery_lat + 0.05, 4)
        lon = round(order.delivery_lon + 0.04, 4)
        loc_name = f"Near {order.delivery_address}"
    elif new_status == "IN_TRANSIT":
        lat = round((order.pickup_lat + order.delivery_lat) / 2.0, 4)
        lon = round((order.pickup_lon + order.delivery_lon) / 2.0, 4)
        origin_city = order.pickup_address.split(',')[0].strip()
        dest_city = order.delivery_address.split(',')[0].strip()
        loc_name = f"National Highway Corridor ({origin_city} ➔ {dest_city})"
        delivery.started_at = datetime.utcnow()
    else:
        lat = order.pickup_lat
        lon = order.pickup_lon
        loc_name = order.pickup_address

    if update.latitude: lat = update.latitude
    if update.longitude: lon = update.longitude
    if update.location_name: loc_name = update.location_name

    delivery.current_lat = lat
    delivery.current_lon = lon
    delivery.last_location_name = loc_name

    # Tracking Event
    event = TrackingEvent(
        order_id=order.id,
        delivery_id=delivery.id,
        status=new_status,
        latitude=lat,
        longitude=lon,
        location_name=loc_name,
        timestamp=datetime.utcnow(),
        notes=update.notes or default_desc,
        updated_by=current_user.name
    )
    db.add(event)

    # In-App Notifications
    notif_target = order.farmer_id if current_user.id == order.buyer_id else order.buyer_id
    notif = Notification(
        user_id=notif_target,
        title=f"Order #{order.order_code}: {title}",
        message=f"Status update: {title} ({loc_name}).",
        type="DELIVERY"
    )
    db.add(notif)

    # If DELIVERED, record proof & credit farmer wallet
    if new_status == "DELIVERED":
        receiver = update.receiver_name or order.buyer_name
        proof = db.query(DeliveryProof).filter(DeliveryProof.order_id == order.id).first()
        if not proof:
            proof = DeliveryProof(
                delivery_id=delivery.id,
                order_id=order.id,
                receiver_name=receiver,
                receiver_phone=update.receiver_phone,
                delivery_notes=update.notes or "All produce crates inspected and verified in good condition.",
                photo_url="📦 Verified Crate Seal Acceptance",
                delivered_at=datetime.utcnow()
            )
            db.add(proof)

        farmer = db.query(User).filter(User.id == order.farmer_id).first()
        if farmer:
            farmer.wallet_balance = round((farmer.wallet_balance or 0.0) + order.total_amount, 2)

    db.commit()
    db.refresh(order)

    return {
        "status": "success",
        "order_id": order.id,
        "order_code": order.order_code,
        "new_status": new_status,
        "status_label": title,
        "location": loc_name
    }
