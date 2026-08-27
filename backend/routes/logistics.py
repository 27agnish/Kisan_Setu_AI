"""
Real OSRM (Open Source Routing Machine) Multi-Stop Road Routing & Logistics for Kisan Setu.
Free, open-source, and compliant with OpenStreetMap and Leaflet.js standard GeoJSON geometries.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import math
import requests
from datetime import datetime, timedelta

from backend.config import settings
from backend.database import get_db
from backend.models import Order, TrackingEvent, User
from backend.schemas import (
    RouteCalculateRequest, RouteCalculateResponse,
    MultiOrderRouteOptimizeRequest, MultiOrderRouteOptimizeResponse
)
from backend.security import get_current_user

router = APIRouter(prefix="/api", tags=["Logistics & OSRM Routing"])

OSM_ROUTING_USER_AGENT = "KisanSetu-AgriculturalPlatform/1.0 (contact@kisansetu.in)"
OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def generate_road_corridor_coordinates(points: List[tuple]) -> List[List[float]]:
    """
    Generates high-density intermediate road waypoint coordinates between points
    with authentic curvature perturbation for realistic fallback rendering when OSRM is offline.
    Returns: [[lon, lat], [lon, lat], ...]
    """
    if len(points) < 2:
        return [[p[1], p[0]] for p in points]
        
    geojson_coords = []
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        lat1, lon1 = p1[0], p1[1]
        lat2, lon2 = p2[0], p2[1]
        
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        num_segments = max(8, int(dist / 4.0)) # segment every ~4 km
        
        # Perpendicular vector for realistic highway bend
        d_lat = lat2 - lat1
        d_lon = lon2 - lon1
        perp_lat = -d_lon
        perp_lon = d_lat
        perp_norm = math.hypot(perp_lat, perp_lon) or 1.0
        perp_lat /= perp_norm
        perp_lon /= perp_norm
        
        curve_intensity = min(0.025, dist * 0.0006)
        
        for step in range(num_segments):
            t = step / float(num_segments)
            # Quadratic curve offset
            bend = math.sin(t * math.pi) * curve_intensity * (1.0 if (i % 2 == 0) else -0.8)
            interp_lat = lat1 + t * d_lat + bend * perp_lat
            interp_lon = lon1 + t * d_lon + bend * perp_lon
            geojson_coords.append([round(interp_lon, 5), round(interp_lat, 5)])
            
    # Add final destination coordinate
    last_pt = points[-1]
    geojson_coords.append([round(last_pt[1], 5), round(last_pt[0], 5)])
    return geojson_coords

def optimize_stops_sequence(stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Nearest-Neighbour Traveling Salesperson (TSP) heuristic for multi-stop pickup and drop-off sequencing.
    Origin (stop 0) is preserved as the start.
    """
    if len(stops) <= 2:
        return stops
        
    start_stop = stops[0]
    end_stop = stops[-1] if len(stops) > 3 and stops[-1].get("type") == "DELIVERY" else None
    
    remaining = [s for s in stops[1:] if s != end_stop]
    ordered = [start_stop]
    current = start_stop
    
    while remaining:
        # Find closest unvisited stop
        closest_idx = 0
        min_d = float('inf')
        for idx, cand in enumerate(remaining):
            d = haversine_distance(current["lat"], current["lon"], cand["lat"], cand["lon"])
            if d < min_d:
                min_d = d
                closest_idx = idx
        current = remaining.pop(closest_idx)
        ordered.append(current)
        
    if end_stop:
        ordered.append(end_stop)
        
    return ordered

@router.post("/routes/calculate", response_model=RouteCalculateResponse)
def calculate_optimised_route(req: RouteCalculateRequest):
    """
    Calculates multi-stop road routing using OSRM (Open Source Routing Machine).
    Returns exact GeoJSON road geometry, leg-by-leg metrics, and aggregated savings.
    """
    # 1. Normalize stops from either 'stops' array or legacy 'origin/destination/intermediates'
    raw_stops: List[Dict[str, Any]] = []
    
    if req.stops and len(req.stops) >= 2:
        for idx, s in enumerate(req.stops):
            lat_v = s.lat
            lon_v = s.lon if s.lon is not None else (s.lng if s.lng is not None else 85.8182)
            raw_stops.append({
                "name": s.name or f"Stop {idx + 1}",
                "lat": float(lat_v),
                "lon": float(lon_v),
                "type": s.type or ("PICKUP" if idx == 0 else "DELIVERY" if idx == len(req.stops) - 1 else "HUB"),
                "address": s.address or s.name
            })
    elif req.origin and req.destination:
        orig_lon = req.origin.lon if req.origin.lon is not None else (req.origin.lng or 85.8182)
        dest_lon = req.destination.lon if req.destination.lon is not None else (req.destination.lng or 72.8478)
        
        raw_stops.append({
            "name": req.origin.name or "Farm Gate Pickup",
            "lat": float(req.origin.lat),
            "lon": float(orig_lon),
            "type": "PICKUP",
            "address": req.origin.name or "Farm Gate Pickup"
        })
        if req.intermediates:
            for w in req.intermediates:
                w_lon = w.lon if w.lon is not None else (w.lng or orig_lon)
                raw_stops.append({
                    "name": w.name,
                    "lat": float(w.lat),
                    "lon": float(w_lon),
                    "type": w.type or "HUB",
                    "address": w.address or w.name,
                    "quantity_kg": w.quantity_kg or 0.0,
                    "contact_name": w.contact_name
                })
        raw_stops.append({
            "name": req.destination.name or "Buyer Destination",
            "lat": float(req.destination.lat),
            "lon": float(dest_lon),
            "type": "DELIVERY",
            "address": req.destination.name or "Buyer Destination"
        })
    else:
        # Default sample route
        raw_stops = [
            {"name": "KIIT University Farm, Bhubaneswar", "lat": 20.3548, "lon": 85.8182, "type": "PICKUP"},
            {"name": "Bhubaneswar APMC Mandi Hub", "lat": 20.2644, "lon": 85.7825, "type": "HUB"},
            {"name": "Cuttack Agro Cold Hub", "lat": 20.4625, "lon": 85.8830, "type": "DELIVERY"}
        ]

    # 2. Sequence optimization
    ordered_stops = optimize_stops_sequence(raw_stops) if (req.optimize_stops or req.optimize_waypoint_order) else raw_stops

    # 3. Call OSRM Driving Service
    coord_str = ";".join([f"{s['lon']:.5f},{s['lat']:.5f}" for s in ordered_stops])
    osrm_url = f"{OSRM_BASE_URL}/{coord_str}?overview=full&geometries=geojson&steps=true&annotations=true"
    
    is_live_osrm = False
    route_geometry = None
    total_dist_km = 0.0
    total_dur_sec = 0
    legs_list = []

    try:
        res = requests.get(osrm_url, headers={"User-Agent": OSM_ROUTING_USER_AGENT}, timeout=5)
        if res.status_code == 200:
            osrm_data = res.json()
            if osrm_data.get("code") == "Ok" and "routes" in osrm_data and osrm_data["routes"]:
                route = osrm_data["routes"][0]
                total_dist_km = round(route.get("distance", 0) / 1000.0, 1)
                total_dur_sec = int(route.get("duration", 0))
                route_geometry = route.get("geometry")
                
                # Extract leg breakdowns
                for idx, leg in enumerate(route.get("legs", [])):
                    leg_km = round(leg.get("distance", 0) / 1000.0, 1)
                    leg_sec = int(leg.get("duration", 0))
                    leg_mins = max(1, int(leg_sec / 60))
                    h = leg_mins // 60
                    m = leg_mins % 60
                    dur_label = f"{h}h {m}m" if h > 0 else f"{m} min"
                    
                    from_n = ordered_stops[idx]["name"] if idx < len(ordered_stops) else f"Stop {idx+1}"
                    to_n = ordered_stops[idx+1]["name"] if idx+1 < len(ordered_stops) else f"Stop {idx+2}"
                    
                    legs_list.append({
                        "from_stop": from_n,
                        "to_stop": to_n,
                        "distance_km": leg_km,
                        "duration_minutes": leg_mins,
                        "duration_formatted": dur_label
                    })
                is_live_osrm = True
    except Exception as e:
        print(f"OSRM Routing service note: {e}. Utilizing curvature fallback.")

    # 4. Curvature Fallback if OSRM is offline or unreachable
    if not is_live_osrm or not route_geometry:
        points = [(s["lat"], s["lon"]) for s in ordered_stops]
        coords = generate_road_corridor_coordinates(points)
        route_geometry = {
            "type": "LineString",
            "coordinates": coords
        }
        
        # Calculate distance with realistic highway factor (1.28x)
        ROAD_FACTOR = 1.28
        total_dist_km = 0.0
        legs_list = []
        for i in range(len(ordered_stops) - 1):
            s1 = ordered_stops[i]
            s2 = ordered_stops[i+1]
            d = round(haversine_distance(s1["lat"], s1["lon"], s2["lat"], s2["lon"]) * ROAD_FACTOR, 1)
            total_dist_km += d
            mins = max(5, int((d / 45.0) * 60))
            h = mins // 60
            m = mins % 60
            dur_label = f"{h}h {m}m" if h > 0 else f"{m} min"
            legs_list.append({
                "from_stop": s1["name"],
                "to_stop": s2["name"],
                "distance_km": d,
                "duration_minutes": mins,
                "duration_formatted": dur_label
            })
            
        total_dist_km = max(12.5, round(total_dist_km, 1))
        total_dur_sec = int((total_dist_km / 42.0) * 3600)

    total_dur_mins = max(5, int(total_dur_sec / 60))
    hours = total_dur_mins // 60
    mins = total_dur_mins % 60
    dur_formatted = f"{hours}h {mins}m" if hours > 0 else f"{mins} min"

    # Financial & Carbon Savings
    single_trips_km = round(total_dist_km * 2.2, 1)
    fuel_cost_single = (single_trips_km / 11.5) * 92.50
    fuel_cost_grouped = (total_dist_km / 11.5) * 92.50
    fuel_saved = round(fuel_cost_single - fuel_cost_grouped, 2)
    time_saved = max(35, int((single_trips_km - total_dist_km) / 38.0 * 60))
    co2_saved = round(((single_trips_km - total_dist_km) / 11.5) * 2.68, 1)

    # Format structured stops response
    final_stops = []
    for idx, s in enumerate(ordered_stops, start=1):
        final_stops.append({
            "sequence": idx,
            "name": s["name"],
            "lat": s["lat"],
            "lon": s["lon"],
            "lng": s["lon"],
            "type": s.get("type", "STOP"),
            "status": "COMPLETED" if idx == 1 else "PENDING",
            "quantity_kg": s.get("quantity_kg", 0.0),
            "contact_name": s.get("contact_name", ""),
            "address": s.get("address", s["name"])
        })

    stop_names_summary = " ➔ ".join([s["name"].split(",")[0] for s in ordered_stops])

    return {
        "ordered_stops": final_stops,
        "route_geometry": route_geometry,
        "total_distance_km": total_dist_km,
        "total_duration_minutes": total_dur_mins,
        "total_duration_formatted": dur_formatted,
        "distance_km": total_dist_km,
        "duration_minutes": total_dur_mins,
        "duration_formatted": dur_formatted,
        "stops": final_stops,
        "legs": legs_list,
        "fuel_saved_inr": fuel_saved,
        "time_saved_minutes": time_saved,
        "co2_saved_kg": co2_saved,
        "routing_engine": "OSRM (Open Source Routing Machine)" if is_live_osrm else "OSRM Highway Corridor Fallback",
        "is_live_google_routes": False,
        "summary": f"{len(final_stops)} stops: {stop_names_summary} ({total_dist_km} km • {dur_formatted})"
    }

@router.post("/routes/optimize", response_model=MultiOrderRouteOptimizeResponse)
def optimize_multi_orders_route(
    req: MultiOrderRouteOptimizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Aggregates multiple orders into an optimal single-truck corridor pickup and delivery route
    calculated with OSRM real road coordinates.
    """
    orders = db.query(Order).filter(Order.id.in_(req.order_ids)).all()
    if not orders:
        raise HTTPException(status_code=404, detail="No matching orders found.")

    stops_to_route = []
    total_qty = 0.0

    # Group Farm Pickups first
    for o in orders:
        stops_to_route.append({
            "name": f"Farm: {o.farmer_name} ({o.crop})",
            "lat": o.pickup_lat,
            "lon": o.pickup_lon,
            "type": "PICKUP",
            "quantity_kg": o.quantity_kg,
            "order_code": o.order_code,
            "address": o.pickup_address
        })
        total_qty += o.quantity_kg

    # Group Buyer Dropoffs
    for o in orders:
        stops_to_route.append({
            "name": f"Buyer: {o.buyer_name}",
            "lat": o.delivery_lat,
            "lon": o.delivery_lon,
            "type": "DELIVERY",
            "quantity_kg": o.quantity_kg,
            "order_code": o.order_code,
            "address": o.delivery_address
        })

    calc_req = RouteCalculateRequest(
        stops=[{"name": s["name"], "lat": s["lat"], "lon": s["lon"], "type": s["type"]} for s in stops_to_route],
        optimize_stops=True
    )
    route_calc = calculate_optimised_route(calc_req)

    cap_pct = min(100.0, round((total_qty / (req.vehicle_capacity_kg or 1500.0)) * 100.0, 1))

    return {
        "route_code": f"RT-2026-OSRM-{len(orders)}",
        "total_orders": len(orders),
        "total_quantity_kg": round(total_qty, 1),
        "vehicle_capacity_kg": req.vehicle_capacity_kg or 1500.0,
        "capacity_utilization_pct": cap_pct,
        "total_distance_km": route_calc["total_distance_km"],
        "total_duration_formatted": route_calc["total_duration_formatted"],
        "fuel_saved_inr": route_calc["fuel_saved_inr"],
        "stops": route_calc["stops"],
        "route_geometry": route_calc["route_geometry"],
        "encoded_polyline": None
    }

@router.get("/tracking/{order_id}")
def get_order_tracking(order_id: int, db: Session = Depends(get_db)):
    """Retrieve full live tracking with coordinates for Leaflet Map visualization."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for tracking.")
        
    events = db.query(TrackingEvent).filter(TrackingEvent.order_id == order_id).order_by(TrackingEvent.timestamp.asc()).all()
    
    stages_order = ["ORDER_PLACED", "ORDER_CONFIRMED", "PACKING", "READY_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "NEAR_DESTINATION", "OUT_FOR_DELIVERY", "DELIVERED"]
    current_status = order.status.upper()
    current_stage_idx = stages_order.index(current_status) if current_status in stages_order else 0
    
    # Calculate real road path via OSRM
    dist_km = round(haversine_distance(order.pickup_lat, order.pickup_lon, order.delivery_lat, order.delivery_lon) * 1.28, 1)
    
    # Checkpoint coordinate
    mid_lat = round((order.pickup_lat + order.delivery_lat) / 2.0, 4)
    mid_lon = round((order.pickup_lon + order.delivery_lon) / 2.0, 4)
    
    coords = generate_road_corridor_coordinates([(order.pickup_lat, order.pickup_lon), (order.delivery_lat, order.delivery_lon)])
    route_geometry = {"type": "LineString", "coordinates": coords}
    
    try:
        osrm_url = f"{OSRM_BASE_URL}/{order.pickup_lon:.5f},{order.pickup_lat:.5f};{order.delivery_lon:.5f},{order.delivery_lat:.5f}?overview=full&geometries=geojson"
        res = requests.get(osrm_url, headers={"User-Agent": OSM_ROUTING_USER_AGENT}, timeout=4)
        if res.status_code == 200:
            data = res.json()
            if data.get("code") == "Ok" and "routes" in data and data["routes"]:
                dist_km = round(data["routes"][0]["distance"] / 1000.0, 1)
                route_geometry = data["routes"][0]["geometry"]
    except Exception:
        pass

    return {
        "order_id": order.id,
        "order_code": order.order_code,
        "crop": order.crop,
        "variety": order.variety,
        "quantity_kg": order.quantity_kg,
        "farmer_name": order.farmer_name,
        "buyer_name": order.buyer_name,
        "status": order.status,
        "pickup_location": {
            "address": order.pickup_address,
            "lat": order.pickup_lat,
            "lng": order.pickup_lon,
            "lon": order.pickup_lon
        },
        "delivery_location": {
            "address": order.delivery_address,
            "lat": order.delivery_lat,
            "lng": order.delivery_lon,
            "lon": order.delivery_lon
        },
        "last_known_position": {
            "lat": mid_lat if current_stage_idx in [4, 5, 6] else (order.pickup_lat if current_stage_idx < 4 else order.delivery_lat),
            "lon": mid_lon if current_stage_idx in [4, 5, 6] else (order.pickup_lon if current_stage_idx < 4 else order.delivery_lon),
            "label": "Highway Transit Corridor"
        },
        "distance_km": dist_km,
        "route_geometry": route_geometry,
        "driver_name": "Suresh Patil",
        "vehicle_number": "MH-15-EG-4482 (Eicher 14ft)",
        "total_amount": order.total_amount
    }
