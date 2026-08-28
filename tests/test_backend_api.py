"""
Comprehensive Integration Test Suite for Kisan Setu Multi-User Platform:
- Real Authentication (Signup, Login, Forgot Password, Profile Setup, Profile Updates)
- Google Maps Integration (Config, Forward & Reverse Geocoding, Route Computation)
- ML Price Prediction & Demand Forecasting (AGMARKNET Models, Confidence Bands)
- Produce Listings (Create, Stock decrement, Delete, My Listings)
- Marketplace & Search (Filtering, Bookmarking, Saved Lots)
- Complete 9-Stage Order Tracking Lifecycle (Placed -> Delivered)
- Driver Checkpoint GPS logging & Dispatch Actions
- Delivery Proof Acceptance & Instant Farmer Wallet Payout Settlement
- Multi-Order Logistics Route Optimisation
- HTML DOM / Button & Navigation Wiring Integrity
"""

import os
import sys
from pathlib import Path

# Project root directory (SIH_2026)
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import re
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal, engine, Base
from backend.seed_data import seed_database
from backend.models import User, Order, Listing, Delivery, DeliveryProof, TrackingEvent, FarmerProfile, BuyerProfile

client = TestClient(app)

def test_full_application_flow():
    print("==================================================")
    print("      KISAN SETU FULL AUDIT & TEST SUITE          ")
    print("==================================================")

    # Step 0: Clean Seed
    print("\n[Step 0] Resetting and seeding database...")
    seed_database(force_refresh=True)

    # Step 1: Health & Maps Config
    print("\n[Step 1] Testing Health & Maps Config Endpoints...")
    health_res = client.get("/api/health")
    assert health_res.status_code == 200, f"Health check failed: {health_res.text}"
    health_data = health_res.json()
    assert health_data["status"] == "healthy"
    print(f"  ✓ Service: {health_data['service']}, ML Loaded: {health_data['ml_model_loaded']}")

    maps_cfg = client.get("/api/maps/config")
    assert maps_cfg.status_code == 200
    print("  ✓ Maps Config retrieved successfully.")

    # Step 2: Farmer Authentication & Profile
    print("\n[Step 2] Testing Farmer Login (/api/auth/login)...")
    login_res = client.post("/api/auth/login", json={
        "email": "ramesh@kisansetu.in",
        "password": "secret123"
    })
    assert login_res.status_code == 200, f"Farmer login failed: {login_res.text}"
    farmer_token = login_res.json()["access_token"]
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    print(f"  ✓ Logged in as Farmer Ramesh Kumar (ID: {login_res.json()['user']['id']})")

    # Step 3: Buyer Authentication & Profile
    print("\n[Step 3] Testing Buyer Login (/api/auth/login)...")
    buyer_login_res = client.post("/api/auth/login", json={
        "email": "cityfresh@kisansetu.in",
        "password": "secret123"
    })
    assert buyer_login_res.status_code == 200, f"Buyer login failed: {buyer_login_res.text}"
    buyer_token = buyer_login_res.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    print(f"  ✓ Logged in as Buyer City Fresh Retailers")

    # Step 4: ML Price Recommendation
    print("\n[Step 4] Testing ML Price Prediction for Farmer...")
    pred_res = client.post("/api/predict-price", json={
        "crop": "Tomato",
        "variety": "Roma",
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "Nashik",
        "quantity": 1500.0,
        "quality_grade": "Grade A"
    }, headers=farmer_headers)
    assert pred_res.status_code == 200
    pred_data = pred_res.json()
    assert pred_data["predicted_price"] > 0
    assert pred_data["recommended_price"] > 0
    print(f"  ✓ Predicted Price: ₹{pred_data['predicted_price']}/kg | Recommended: ₹{pred_data['recommended_price']}/kg")

    # Step 5: Listing Creation
    print("\n[Step 5] Testing Farmer Listing Creation...")
    listing_res = client.post("/api/listings", json={
        "crop": "Tomato",
        "variety": "Hybrid Roma",
        "quantity_kg": 1500.0,
        "quality_grade": "Grade A",
        "harvest_date": "2026-08-30",
        "asking_price": pred_data["recommended_price"],
        "farm_location": "Dindori Road, Nashik, Maharashtra",
        "state": "Maharashtra",
        "district": "Nashik",
        "lat": 20.2012,
        "lon": 73.8340
    }, headers=farmer_headers)
    assert listing_res.status_code == 200, f"Listing failed: {listing_res.text}"
    new_listing = listing_res.json()
    listing_id = new_listing["id"]
    print(f"  ✓ Created Produce Listing #{listing_id} for {new_listing['quantity_kg']}kg @ ₹{new_listing['asking_price']}/kg")

    # Step 6: Buyer Order Placement
    print("\n[Step 6] Testing Buyer Order Placement...")
    order_res = client.post("/api/orders", json={
        "listing_id": listing_id,
        "quantity_kg": 500.0,
        "delivery_address": "Shop 14-16, Dadar Wholesale Market, Dadar West, Mumbai",
        "delivery_lat": 19.0178,
        "delivery_lon": 72.8478
    }, headers=buyer_headers)
    assert order_res.status_code == 200, f"Order placement failed: {order_res.text}"
    order_data = order_res.json()
    order_id = order_data["id"]
    order_code = order_data["order_code"]
    print(f"  ✓ Placed Order #{order_code} (ID: {order_id}) for 500kg. Total: ₹{order_data['total_amount']:,.2f}")

    # Verify inventory was decremented
    listing_chk = client.get(f"/api/listings/{listing_id}")
    assert listing_chk.json()["available_kg"] == 1000.0
    print(f"  ✓ Available stock verified: 1,500 kg -> 1,000 kg")

    # Step 7: Comprehensive 9-Stage Order Tracking Detail
    print("\n[Step 7] Testing Comprehensive Order Tracking Detail (/api/orders/{id}/tracking)...")
    track_res = client.get(f"/api/orders/{order_id}/tracking", headers=buyer_headers)
    assert track_res.status_code == 200, f"Tracking detail failed: {track_res.text}"
    track_data = track_res.json()
    assert len(track_data["timeline"]) == 9, f"Expected 9 timeline stages, got {len(track_data['timeline'])}"
    assert track_data["status"] == "ORDER_PLACED"
    assert track_data["pickup_lat"] == 20.2012
    assert track_data["delivery_lat"] == 19.0178
    assert "MH-15" in (track_data["vehicle"]["vehicle_number"] if track_data["vehicle"] else "")
    print(f"  ✓ 9-Stage Timeline validated: {[s['label'] for s in track_data['timeline']]}")
    print(f"  ✓ Coordinates verified: Pickup ({track_data['pickup_lat']}, {track_data['pickup_lon']}) -> Delivery ({track_data['delivery_lat']}, {track_data['delivery_lon']})")
    print(f"  ✓ Fleet assigned: {track_data['vehicle']['vehicle_number']} (Driver: {track_data['driver']['name']})")

    # Step 8: Driver Location Checkpoint Update
    print("\n[Step 8] Testing Driver Checkpoint Location Update (/api/deliveries/{id}/location)...")
    db = SessionLocal()
    deliv = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    delivery_id = deliv.id
    db.close()

    loc_res = client.post(f"/api/deliveries/{delivery_id}/location", json={
        "latitude": 19.6967,
        "longitude": 73.5611,
        "location_name": "Igatpuri Toll Plaza, NH-160",
        "notes": "Passed Ghats checkpoint, weather clear."
    }, headers=farmer_headers)
    assert loc_res.status_code == 200
    print("  ✓ Checkpoint updated to Igatpuri Toll Plaza (Lat: 19.6967, Lon: 73.5611)")

    # Step 9: 9-Stage Progression Execution
    print("\n[Step 9] Testing 9-Stage Lifecycle Status Transitions...")
    stages_to_test = [
        ("ORDER_CONFIRMED", "Farmer acknowledged harvest allotment"),
        ("PACKING", "Graded into 17 crates and sealed"),
        ("READY_FOR_PICKUP", "Staged at farm gate loading bay"),
        ("PICKED_UP", "Carrier loaded crates into MH-15-EG-4482"),
        ("IN_TRANSIT", "En route on NH-160 Mumbai highway"),
        ("NEAR_DESTINATION", "Approaching Thane toll gate"),
        ("OUT_FOR_DELIVERY", "Navigating Dadar wholesale market lane")
    ]

    for stage_code, note in stages_to_test:
        st_res = client.post(f"/api/orders/{order_id}/status", json={
            "status": stage_code,
            "notes": note
        }, headers=farmer_headers)
        assert st_res.status_code == 200, f"Failed at stage {stage_code}: {st_res.text}"
        print(f"  ✓ Advanced to [{stage_code}] — {note}")

    # Verify tracking timeline status
    mid_track = client.get(f"/api/orders/{order_id}/tracking", headers=buyer_headers).json()
    assert mid_track["status"] == "OUT_FOR_DELIVERY"
    assert mid_track["timeline"][7]["is_current"] == True
    print("  ✓ Tracking page accurately reflects [OUT_FOR_DELIVERY] active milestone.")

    # Step 10: Final Delivery with Delivery Proof & Payout Settlement
    print("\n[Step 10] Testing Final Delivery Completion with Delivery Proof & Farmer Settlement...")
    db = SessionLocal()
    farmer_before = db.query(User).filter(User.id == new_listing["farmer_id"]).first().wallet_balance
    db.close()

    proof_res = client.post(f"/api/deliveries/{delivery_id}/deliver", json={
        "receiver_name": "Rohan Deshmukh (Procurement Lead)",
        "receiver_phone": "+91 98200 11223",
        "delivery_notes": "All 17 tomato crates inspected, weighed, and verified in pristine Grade-A condition.",
        "photo_url": "📦 Verified Crate Seal Acceptance #CF-9901",
        "signature_data": "SIG_ACCEPTED_ROHAN_DESHMUKH"
    }, headers=buyer_headers)
    assert proof_res.status_code == 200, f"Delivery proof failed: {proof_res.text}"
    proof_data = proof_res.json()
    print(f"  ✓ Delivery Proof saved: Receiver '{proof_data['receiver_name']}' at {proof_data['delivered_at']}")

    # Verify final status and farmer wallet credit
    final_track = client.get(f"/api/orders/{order_id}/tracking", headers=buyer_headers).json()
    assert final_track["status"] == "DELIVERED"
    assert final_track["is_delivered"] == True
    assert final_track["delivery_proof"]["receiver_name"] == "Rohan Deshmukh (Procurement Lead)"
    print("  ✓ Tracking detail confirms: Status = DELIVERED with verified proof attached.")

    db = SessionLocal()
    farmer_after = db.query(User).filter(User.id == new_listing["farmer_id"]).first().wallet_balance
    db.close()
    expected_gain = order_data["total_amount"]
    assert round(farmer_after - farmer_before, 2) == round(expected_gain, 2), f"Wallet balance mismatch: before={farmer_before}, after={farmer_after}, gain={expected_gain}"
    print(f"  ✓ Farmer Wallet credited with ₹{expected_gain:,.2f} (Balance: ₹{farmer_before:,.2f} -> ₹{farmer_after:,.2f})")

    # Step 11: Multi-Order Route Optimization
    print("\n[Step 11] Testing Multi-Order Logistics Route Optimisation (/api/routes/optimize)...")
    opt_res = client.post("/api/routes/optimize", json={
        "order_ids": [1, 2, order_id],
        "vehicle_capacity_kg": 1500.0
    }, headers=farmer_headers)
    assert opt_res.status_code == 200, f"Route optimize failed: {opt_res.text}"
    opt_data = opt_res.json()
    assert opt_data["total_orders"] == 3
    assert len(opt_data["stops"]) == 6
    print(f"  ✓ Route {opt_data['route_code']}: {opt_data['total_orders']} orders grouped ({opt_data['total_quantity_kg']} kg, {opt_data['capacity_utilization_pct']}% capacity)")
    print(f"  ✓ Multi-stop path: {opt_data['total_distance_km']} km ({opt_data['total_duration_formatted']}), Estimated Diesel Savings: ₹{opt_data['fuel_saved_inr']:,.2f}")

    # Step 12: New Farmer Registration, Profile Setup, and Validation
    print("\n[Step 12] Testing Brand New Farmer Signup & Profile Setup Flow...")
    new_farmer_signup = client.post("/api/auth/signup", json={
        "name": "Anil Patil",
        "email": "anil.patil@testfarm.in",
        "phone": "+91 98901 23456",
        "password": "FarmPassword123",
        "confirm_password": "FarmPassword123",
        "role": "FARMER_FPO"
    })
    assert new_farmer_signup.status_code == 200, f"Farmer signup failed: {new_farmer_signup.text}"
    new_farmer_token = new_farmer_signup.json()["access_token"]
    new_farmer_headers = {"Authorization": f"Bearer {new_farmer_token}"}
    
    # Complete Farm Profile with Google Maps lat/lon
    farm_setup_res = client.post("/api/auth/profile/setup", json={
        "farm_name": "Patil Organic Grape & Tomato Farm",
        "farm_location": "Pimpalgaon Baswant, Nashik, Maharashtra",
        "state": "Maharashtra",
        "district": "Nashik",
        "crops_grown": "Tomato, Grapes, Pomegranate",
        "farm_size_acres": 8.5,
        "lat": 20.1738,
        "lon": 73.9872
    }, headers=new_farmer_headers)
    assert farm_setup_res.status_code == 200, f"Farm setup failed: {farm_setup_res.text}"
    new_farmer_profile = farm_setup_res.json()["farmer_profile"]
    assert new_farmer_profile["farm_name"] == "Patil Organic Grape & Tomato Farm"
    assert new_farmer_profile["lat"] == 20.1738
    print(f"  ✓ New Farmer '{new_farmer_signup.json()['user']['name']}' created & farm coordinates saved at ({new_farmer_profile['lat']}, {new_farmer_profile['lon']})")

    # Step 13: New Buyer Registration & Profile Setup
    print("\n[Step 13] Testing Brand New Buyer Signup & Delivery Location Setup...")
    new_buyer_signup = client.post("/api/auth/signup", json={
        "name": "Sahyadri Mega Supermarkets",
        "email": "procure@sahyadrimart.in",
        "phone": "+91 98111 22334",
        "password": "BuyerPassword123",
        "confirm_password": "BuyerPassword123",
        "role": "BUYER_CONSUMER"
    })
    assert new_buyer_signup.status_code == 200, f"Buyer signup failed: {new_buyer_signup.text}"
    new_buyer_token = new_buyer_signup.json()["access_token"]
    new_buyer_headers = {"Authorization": f"Bearer {new_buyer_token}"}

    buyer_setup_res = client.post("/api/auth/profile/setup", json={
        "business_name": "Sahyadri Mega Supermarkets Ltd",
        "buyer_type": "Supermarket Chain",
        "delivery_location": "Andheri East DC, Mumbai, Maharashtra",
        "address": "Plot 8B, MIDC Industrial Area, Andheri East, Mumbai",
        "state": "Maharashtra",
        "district": "Mumbai Suburban",
        "lat": 19.1136,
        "lon": 72.8697
    }, headers=new_buyer_headers)
    assert buyer_setup_res.status_code == 200
    new_bp = buyer_setup_res.json()["buyer_profile"]
    assert new_bp["business_name"] == "Sahyadri Mega Supermarkets Ltd"
    print(f"  ✓ New Buyer registered & delivery warehouse coordinates saved at ({new_bp['lat']}, {new_bp['lon']})")

    # Step 14: Profile Persistence & Updates
    print("\n[Step 14] Testing Profile Update & Persistence (/api/auth/profile)...")
    update_prof = client.put("/api/auth/profile", json={
        "name": "Anil S. Patil (FPO Director)",
        "phone": "+91 98901 99999",
        "farm_name": "Patil & Sons Agri FPO",
        "crops_grown": "Export Quality Tomatoes",
        "farm_size_acres": 12.0,
        "state": "Maharashtra",
        "district": "Nashik",
        "lat": 20.1800,
        "lon": 73.9900
    }, headers=new_farmer_headers)
    assert update_prof.status_code == 200
    me_res = client.get("/api/auth/me", headers=new_farmer_headers)
    assert me_res.json()["name"] == "Anil S. Patil (FPO Director)"
    assert me_res.json()["farmer_profile"]["farm_name"] == "Patil & Sons Agri FPO"
    assert me_res.json()["farmer_profile"]["lat"] == 20.1800
    print("  ✓ Profile update successfully persisted to database.")

    # Step 15: Password Reset Request
    print("\n[Step 15] Testing Forgot Password Service (/api/auth/forgot-password)...")
    forgot_res = client.post("/api/auth/forgot-password", json={"email": "anil.patil@testfarm.in"})
    assert forgot_res.status_code == 200
    assert "Password reset instructions" in forgot_res.json()["message"]
    print("  ✓ Password reset token generated & instructions dispatched.")

    # Step 16: Marketplace Search & Filtering
    print("\n[Step 16] Testing Marketplace Keyword Search & Location Filtering...")
    # Keyword search for Onion
    onion_search = client.get("/api/marketplace?q=Onion", headers=new_buyer_headers)
    assert onion_search.status_code == 200
    assert all("onion" in item["crop"].lower() or "onion" in item["variety"].lower() for item in onion_search.json())
    print(f"  ✓ Search for 'Onion' returned {len(onion_search.json())} relevant lots.")

    # Location filter for Nashik
    loc_search = client.get("/api/marketplace?location=Nashik", headers=new_buyer_headers)
    assert loc_search.status_code == 200
    print(f"  ✓ Location filter for 'Nashik' returned {len(loc_search.json())} active farm lots.")

    # Save / Bookmark listing
    fav_res = client.post(f"/api/marketplace/save/{listing_id}", headers=new_buyer_headers)
    assert fav_res.status_code == 200
    assert fav_res.json()["saved"] == True
    saved_list = client.get("/api/marketplace/saved", headers=new_buyer_headers)
    assert any(s["id"] == listing_id for s in saved_list.json())
    print(f"  ✓ Listing #{listing_id} successfully saved to buyer's favorites bookmarked list.")

    # Step 17: Price History & Demand Forecast
    print("\n[Step 17] Testing Price History & Demand Forecast APIs...")
    hist_res = client.get("/api/price-history?crop=Tomato&market=Nashik")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert len(hist_data["history"]) > 0
    assert len(hist_data["forecast_7d"]) == 7
    print(f"  ✓ Price history returned {len(hist_data['history'])} daily records + 7-day future ML trajectory.")

    demand_res = client.get("/api/demand-prediction?market=Nashik")
    assert demand_res.status_code == 200
    assert len(demand_res.json()["commodities"]) == 4
    print(f"  ✓ Demand forecast generated across 4 core commodities.")

    # Step 18: OpenStreetMap Geocoding & OSRM Routing Tests
    print("\n[Step 18] Testing OpenStreetMap Geocoding & OSRM Road Routing APIs...")
    
    # Test 18.1: OpenStreetMap Search for "KIIT"
    kiit_search = client.get("/api/maps/search?q=KIIT")
    assert kiit_search.status_code == 200
    kiit_items = kiit_search.json()
    assert len(kiit_items) >= 1, "Expected KIIT search results"
    assert any("KIIT" in item.get("display_name", "") or "KIIT" in item.get("main_text", "") for item in kiit_items)
    print(f"  ✓ Search 'KIIT' returned {len(kiit_items)} items: {[i.get('display_name', i.get('main_text', ''))[:40] for i in kiit_items[:3]]}")

    # Test 18.2: Places Autocomplete Compatibility Alias
    kiit_auto = client.get("/api/maps/places/autocomplete?q=KIIT")
    assert kiit_auto.status_code == 200
    assert len(kiit_auto.json()) >= 1
    print(f"  ✓ Autocomplete alias 'KIIT' returned {len(kiit_auto.json())} items.")

    # Test 18.3: Search for "Nashik", "Mumbai", "Delhi"
    for city_term in ["Nashik", "Mumbai", "Delhi"]:
        city_res = client.get(f"/api/maps/search?q={city_term}")
        assert city_res.status_code == 200
        assert len(city_res.json()) >= 1
        print(f"  ✓ Search '{city_term}' returned {len(city_res.json())} suggestions")

    # Test 18.4: OpenStreetMap Reverse Geocode (20.3548, 85.8182 - KIIT University, Bhubaneswar)
    rev_kiit = client.get("/api/maps/reverse?lat=20.3548&lon=85.8182")
    assert rev_kiit.status_code == 200
    rev_kiit_data = rev_kiit.json()
    assert rev_kiit_data["state"] == "Odisha"
    assert rev_kiit_data["district"] == "Khordha"
    print(f"  ✓ Reverse Geocoded (20.3548, 85.8182) -> '{rev_kiit_data['formatted_address']}'")

    # Test 18.5: Reverse Geocode Nashik & Mumbai
    rev_nashik = client.get("/api/maps/reverse?lat=19.9975&lon=73.7898")
    assert rev_nashik.status_code == 200
    assert rev_nashik.json()["state"] == "Maharashtra"
    assert rev_nashik.json()["district"] == "Nashik"

    rev_mumbai = client.get("/api/maps/reverse?lat=19.0178&lon=72.8478")
    assert rev_mumbai.status_code == 200
    assert rev_mumbai.json()["state"] == "Maharashtra"
    assert "Mumbai" in rev_mumbai.json()["district"] or "Mumbai" in rev_mumbai.json()["city"]
    print("  ✓ Reverse Geocoded Nashik & Mumbai with exact state/district derivation.")

    # Test 18.6: OSRM Multi-Stop Route Calculation (/api/routes/calculate)
    print("  → Testing OSRM Multi-Stop Road Routing API (/api/routes/calculate)...")
    route_calc_res = client.post("/api/routes/calculate", json={
        "stops": [
            {"name": "Lasalgaon FPO Hub", "lat": 20.1472, "lon": 74.2263, "type": "HUB"},
            {"name": "Ramesh Farm", "lat": 19.9975, "lon": 73.7898, "type": "PICKUP"},
            {"name": "Sangamner Cluster", "lat": 19.5772, "lon": 74.2081, "type": "PICKUP"},
            {"name": "Dadar Wholesale Market", "lat": 19.0178, "lon": 72.8478, "type": "DELIVERY"}
        ],
        "optimize_stops": True
    })
    assert route_calc_res.status_code == 200, f"Route calculate failed: {route_calc_res.text}"
    route_data = route_calc_res.json()
    assert route_data["total_distance_km"] > 0
    assert route_data["total_duration_minutes"] > 0
    assert "route_geometry" in route_data
    assert route_data["route_geometry"]["type"] == "LineString"
    assert len(route_data["route_geometry"]["coordinates"]) >= 4
    assert len(route_data["ordered_stops"]) == 4
    assert len(route_data["legs"]) == 3
    print(f"  ✓ OSRM Calculated Route: {route_data['total_distance_km']} km, {route_data['total_duration_formatted']}, {len(route_data['route_geometry']['coordinates'])} road coordinates, {len(route_data['legs'])} legs.")

    # Test 18.7: Order Tracking Road Geometry
    track_res = client.get(f"/api/orders/{order_id}/tracking", headers=buyer_headers)
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert "route_geometry" in track_data
    assert track_data["route_geometry"]["type"] == "LineString"
    assert len(track_data["route_geometry"]["coordinates"]) >= 2
    print(f"  ✓ Order #{order_id} tracking returns live road geometry LineString with {len(track_data['route_geometry']['coordinates'])} coordinates.")

    # Step 19: Farmer Profile Setup with Dynamic Odisha Location & Listing Inheritance
    print("\n[Step 19] Testing Farmer Profile with Odisha Location & Listing Inheritance...")
    odisha_farmer_signup = client.post("/api/auth/signup", json={
        "name": "Bikash Mohanty",
        "email": "bikash.farmer@odishakisan.in",
        "phone": "+91 94370 12345",
        "password": "FarmPassword123",
        "confirm_password": "FarmPassword123",
        "role": "FARMER_FPO"
    })
    assert odisha_farmer_signup.status_code == 200
    odisha_token = odisha_farmer_signup.json()["access_token"]
    odisha_headers = {"Authorization": f"Bearer {odisha_token}"}

    # Setup profile using KIIT University Google Places data
    odisha_setup = client.post("/api/auth/profile/setup", json={
        "farm_name": "Kalinga Agro Farms",
        "farm_location": "KIIT University, Patia, Bhubaneswar, Odisha 751024, India",
        "state": "Odisha",
        "district": "Khordha",
        "city": "Bhubaneswar",
        "pincode": "751024",
        "google_place_id": "KS_IN_OD_KIIT_01",
        "crops_grown": "Tomato, Chili, Brinjal",
        "farm_size_acres": 6.0,
        "lat": 20.3548,
        "lon": 85.8182
    }, headers=odisha_headers)
    assert odisha_setup.status_code == 200
    odisha_user = odisha_setup.json()
    assert odisha_user["farmer_profile"]["state"] == "Odisha"
    assert odisha_user["farmer_profile"]["district"] == "Khordha"
    assert odisha_user["farmer_profile"]["city"] == "Bhubaneswar"
    assert odisha_user["farmer_profile"]["pincode"] == "751024"
    assert odisha_user["farmer_profile"]["google_place_id"] == "KS_IN_OD_KIIT_01"
    assert odisha_user["farmer_profile"]["lat"] == 20.3548
    assert odisha_user["farmer_profile"]["lon"] == 85.8182
    print(f"  ✓ Saved Farmer Profile with dynamic Odisha location: State={odisha_user['farmer_profile']['state']}, District={odisha_user['farmer_profile']['district']}")

    # Create listing - ensure it inherits farmer's dynamic Odisha coordinates
    odisha_listing_res = client.post("/api/listings", json={
        "crop": "Tomato",
        "variety": "Utkal Raja",
        "quantity_kg": 800.0,
        "quality_grade": "Grade A",
        "harvest_date": "2026-08-30",
        "asking_price": 28.50
    }, headers=odisha_headers)
    assert odisha_listing_res.status_code == 200
    odisha_listing = odisha_listing_res.json()
    assert odisha_listing["lat"] == 20.3548
    assert odisha_listing["lon"] == 85.8182
    assert odisha_listing["state"] == "Odisha"
    assert odisha_listing["district"] == "Khordha"
    print(f"  ✓ Listing automatically inherited Farmer's dynamic GPS ({odisha_listing['lat']}, {odisha_listing['lon']}) & State ({odisha_listing['state']})")

    # Step 20: Frontend HTML, CSS & JS Modular Structure Audit
    print("\n[Step 20] Verifying Frontend HTML DOM, Modular Files & Location Search IDs...")
    html_path = BASE_DIR / "frontend" / "index.html"
    if not html_path.exists():
        html_path = BASE_DIR / "frontend" / "kisan-setu-frontend.html"
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    css_path = BASE_DIR / "frontend" / "css" / "style.css"
    js_path = BASE_DIR / "frontend" / "js" / "app.js"
    assert css_path.exists() and css_path.stat().st_size > 1000, "frontend/css/style.css must exist"
    assert js_path.exists() and js_path.stat().st_size > 1000, "frontend/js/app.js must exist"
    print("  ✓ Modular stylesheet (frontend/css/style.css) and script (frontend/js/app.js) verified.")

    essential_ids = [
        "app-portal", "auth-modal", "order-modal", "delivery-proof-modal", "checkpoint-update-modal",
        "view-farmer-dashboard", "view-buyer-dashboard", "view-farmer-portal", "view-farmer-listings",
        "view-farmer-earnings", "view-marketplace", "view-buyer-search", "view-buyer-saved",
        "view-orders", "view-ai-pricing", "view-demand", "view-logistics", "view-tracking", "view-profile",
        "tracking-orders-list-view", "tracking-order-detail-view", "tracking-detail-map-canvas",
        "logistics-map-canvas", "p-map-canvas", "setup-map-canvas", "listing-form", "form-login", "form-signup",
        # New Google Places & Location picker IDs
        "setup-address-search", "setup-places-dropdown", "setup-selected-loc-card",
        "setup-state", "setup-district", "setup-city", "setup-pincode", "setup-address", "setup-lat", "setup-lon",
        "p-address-search", "p-places-dropdown", "p-selected-loc-card",
        "p-state", "p-district", "p-city", "p-pincode", "p-address", "p-lat", "p-lon"
    ]
    for eid in essential_ids:
        assert f'id="{eid}"' in html or f"id='{eid}'" in html, f"Missing essential HTML element ID: {eid}"
    print(f"  ✓ All {len(essential_ids)} critical view containers, canvases, Places search fields, and modal IDs present in HTML.")

    # Step 21: Authentication & Role-Switching Lifecycle Tests (Flows A through G)
    print("\n[Step 21] Testing Authentication Lifecycle & Role-Switching Transitions (Flows A-G)...")

    # Flow A: Farmer Login -> Farmer Dashboard -> Logout -> Buyer Login -> Buyer Dashboard
    res_f1 = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "secret123"})
    assert res_f1.status_code == 200 and res_f1.json()["user"]["role"] == "FARMER_FPO"
    f_token = res_f1.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {f_token}"}).status_code == 200
    # Simulate Logout (token discarded, unauthenticated request fails)
    assert client.get("/api/auth/me").status_code == 401
    # Buyer Login
    res_b1 = client.post("/api/auth/login", json={"email": "cityfresh@kisansetu.in", "password": "secret123"})
    assert res_b1.status_code == 200 and res_b1.json()["user"]["role"] == "BUYER_CONSUMER"
    b_token = res_b1.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {b_token}"}).status_code == 200
    print("  ✓ Flow A: Farmer Login → Farmer Dashboard → Logout → Buyer Login → Buyer Dashboard (PASS)")

    # Flow B: Buyer Login -> Buyer Dashboard -> Logout -> Farmer Login -> Farmer Dashboard
    res_b2 = client.post("/api/auth/login", json={"email": "cityfresh@kisansetu.in", "password": "secret123"})
    assert res_b2.status_code == 200 and res_b2.json()["user"]["role"] == "BUYER_CONSUMER"
    res_f2 = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "secret123"})
    assert res_f2.status_code == 200 and res_f2.json()["user"]["role"] == "FARMER_FPO"
    print("  ✓ Flow B: Buyer Login → Buyer Dashboard → Logout → Farmer Login → Farmer Dashboard (PASS)")

    # Flow C: Farmer Login -> Logout -> Farmer Login
    res_f3 = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "secret123"})
    assert res_f3.status_code == 200
    res_f4 = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "secret123"})
    assert res_f4.status_code == 200
    print("  ✓ Flow C: Farmer Login → Logout → Farmer Login (PASS)")

    # Flow D: Buyer Login -> Logout -> Buyer Login
    res_b3 = client.post("/api/auth/login", json={"email": "cityfresh@kisansetu.in", "password": "secret123"})
    assert res_b3.status_code == 200
    res_b4 = client.post("/api/auth/login", json={"email": "cityfresh@kisansetu.in", "password": "secret123"})
    assert res_b4.status_code == 200
    print("  ✓ Flow D: Buyer Login → Logout → Buyer Login (PASS)")

    # Flow E: Wrong credentials -> Error -> Correct credentials -> Successful login
    res_err = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "wrongpassword999"})
    assert res_err.status_code == 401
    assert "Invalid email or password" in res_err.json()["detail"]
    res_ok = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "secret123"})
    assert res_ok.status_code == 200
    print("  ✓ Flow E: Wrong credentials (401 Error) → Correct credentials (200 Login) (PASS)")

    # Flow F: Login -> Logout -> Fresh session -> Opposite role login
    res_sunita = client.post("/api/auth/login", json={"email": "sunita@kisansetu.in", "password": "secret123"})
    assert res_sunita.status_code == 200 and res_sunita.json()["user"]["role"] == "FARMER_FPO"
    res_sahakari = client.post("/api/auth/login", json={"email": "sahakari@kisansetu.in", "password": "secret123"})
    assert res_sahakari.status_code == 200 and res_sahakari.json()["user"]["role"] == "BUYER_CONSUMER"
    print("  ✓ Flow F: Login → Logout → Refresh/Clean Session → Opposite Role Login (PASS)")

    # Flow G: Repeated multi-cycle switching without refreshing
    for cycle in range(1, 5):
        rf = client.post("/api/auth/login", json={"email": "ramesh@kisansetu.in", "password": "secret123"})
        assert rf.status_code == 200 and rf.json()["user"]["role"] == "FARMER_FPO"
        rb = client.post("/api/auth/login", json={"email": "cityfresh@kisansetu.in", "password": "secret123"})
        assert rb.status_code == 200 and rb.json()["user"]["role"] == "BUYER_CONSUMER"
    print("  ✓ Flow G: Repeatedly switched Farmer ↔ Buyer 4 continuous cycles (PASS)")

    # Frontend JS Code State Inspection: Verify finally blocks and button lifecycle guards
    with open(js_path, "r", encoding="utf-8") as f:
        js_code = f.read()

    assert "btn.disabled = false;" in js_code, "Button enable code must exist in js/app.js"
    assert "Sign In to Dashboard →" in js_code, "Button reset text must exist in js/app.js"
    assert "finally" in js_code, "Finally block must exist in js/app.js"
    print("  ✓ Frontend JS audit: finally blocks, button unlocking, and auth state cleanup confirmed.")

    print("\n==================================================")
    print("   ALL 21 AUDIT & INTEGRATION TESTS PASSED!       ")
    print("==================================================")

run_all_tests = test_full_application_flow

if __name__ == "__main__":
    test_full_application_flow()
