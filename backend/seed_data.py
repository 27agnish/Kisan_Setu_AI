"""
Initial Database Seeder with authentic Indian agricultural multi-user accounts,
complete 9-stage tracking events, fleet vehicles, drivers, and delivery proofs.
All demo accounts are secured with bcrypt password hashes (Password: 'secret123').
"""

import os
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from backend.models import (
    User, FarmerProfile, BuyerProfile, Listing, Order,
    Delivery, DeliveryVehicle, Driver, DeliveryRoute, RouteStop,
    DeliveryProof, TrackingEvent, Notification, MarketPrice
)
from backend.database import SessionLocal, engine, Base
from backend.security import hash_password

def seed_database(db: Session = None, force_refresh: bool = False):
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
        
    try:
        Base.metadata.create_all(bind=engine)
        
        if not force_refresh and db.query(User).count() > 0:
            return
            
        print("Seeding initial multi-user agricultural records & delivery fleet...")
        
        if force_refresh:
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)

        default_pw_hash = hash_password("secret123")
        now = datetime.utcnow()

        # 1. Seed Users
        farmer1 = User(
            id=1, name="Ramesh Kumar", email="ramesh@kisansetu.in", phone="+91 98231 45012",
            password_hash=default_pw_hash, role="FARMER_FPO", wallet_balance=28520.0
        )
        farmer2 = User(
            id=2, name="Sunita Patil", email="sunita@kisansetu.in", phone="+91 94220 89112",
            password_hash=default_pw_hash, role="FARMER_FPO", wallet_balance=16200.0
        )
        fpo3 = User(
            id=3, name="Suresh Jadhav", email="suresh@kisansetu.in", phone="+91 98901 23456",
            password_hash=default_pw_hash, role="FARMER_FPO", wallet_balance=64600.0
        )
        farmer4 = User(
            id=4, name="Gurpreet Singh", email="gurpreet@kisansetu.in", phone="+91 98140 77654",
            password_hash=default_pw_hash, role="FARMER_FPO", wallet_balance=108000.0
        )
        buyer1 = User(
            id=5, name="City Fresh Retailers", email="cityfresh@kisansetu.in", phone="+91 98200 11223",
            password_hash=default_pw_hash, role="BUYER_CONSUMER", wallet_balance=450000.0
        )
        buyer2 = User(
            id=6, name="Sahakari Bulk Buyer", email="sahakari@kisansetu.in", phone="+91 98211 44556",
            password_hash=default_pw_hash, role="BUYER_CONSUMER", wallet_balance=850000.0
        )
        
        db.add_all([farmer1, farmer2, fpo3, farmer4, buyer1, buyer2])
        db.commit()

        # 2. Seed Profiles
        fp1 = FarmerProfile(
            user_id=1, farm_name="Ramesh Organic Farms", state="Maharashtra", district="Nashik",
            village_town="Dindori", farm_location="Dindori Road, Nashik, Maharashtra",
            crops_grown="Tomato, Potato, Grapes", farm_size_acres=8.5, profile_photo="🧑‍🌾",
            preferred_language="Marathi / English", lat=19.9975, lon=73.7898
        )
        fp2 = FarmerProfile(
            user_id=2, farm_name="Patil Agro Farm", state="Maharashtra", district="Ahmednagar",
            village_town="Sangamner", farm_location="Sangamner Farm Cluster, Maharashtra",
            crops_grown="Onion, Pomegranate", farm_size_acres=6.0, profile_photo="🧑‍🌾",
            preferred_language="Marathi / Hindi", lat=19.5772, lon=74.2081
        )
        fp3 = FarmerProfile(
            user_id=3, farm_name="Lasalgaon Onion & Vegetable FPO", state="Maharashtra", district="Nashik",
            village_town="Lasalgaon", farm_location="Lasalgaon APMC Cluster, Nashik",
            crops_grown="Onion, Garlic, Tomato", farm_size_acres=45.0, profile_photo="🏢",
            preferred_language="Marathi / Hindi", lat=20.1472, lon=74.2263
        )
        fp4 = FarmerProfile(
            user_id=4, farm_name="Khanna Wheat Growers", state="Punjab", district="Ludhiana",
            village_town="Khanna", farm_location="GT Road Mandi Belt, Khanna, Punjab",
            crops_grown="Wheat, Rice, Mustard", farm_size_acres=22.0, profile_photo="🧑‍🌾",
            preferred_language="Punjabi / Hindi", lat=30.7068, lon=76.2201
        )
        bp1 = BuyerProfile(
            user_id=5, business_name="City Fresh Retail Chain Pvt Ltd", buyer_type="Retailer",
            state="Maharashtra", district="Mumbai City",
            address="Shop 14-16, Dadar Wholesale Market, Dadar West, Mumbai",
            delivery_location="Dadar West, Mumbai, Maharashtra", profile_photo="🛒",
            lat=19.0178, lon=72.8478
        )
        bp2 = BuyerProfile(
            user_id=6, business_name="Sahakari Cooperative Bulk Purchasing", buyer_type="Wholesaler",
            state="Maharashtra", district="Thane",
            address="Sector 19, APMC Market-II, Vashi, Navi Mumbai",
            delivery_location="Vashi APMC, Navi Mumbai, Maharashtra", profile_photo="🛒",
            lat=19.0760, lon=72.9984
        )

        db.add_all([fp1, fp2, fp3, fp4, bp1, bp2])
        db.commit()

        # 3. Seed Fleet Vehicles & Drivers
        v1 = DeliveryVehicle(
            id=1, vehicle_number="MH-15-EG-4482", vehicle_type="Mini Truck (14ft)",
            capacity_kg=1500.0, current_status="IN_TRANSIT", is_active=True
        )
        v2 = DeliveryVehicle(
            id=2, vehicle_number="MH-14-AZ-9921", vehicle_type="Eicher 17ft Closed Body",
            capacity_kg=3500.0, current_status="AVAILABLE", is_active=True
        )
        v3 = DeliveryVehicle(
            id=3, vehicle_number="MH-12-QX-3104", vehicle_type="Bolero Maxi Truck",
            capacity_kg=1200.0, current_status="AVAILABLE", is_active=True
        )
        
        dr1 = Driver(
            id=1, name="Suresh Patil", phone="+91 98221 00998",
            license_number="MH15-2018-0091823", is_active=True
        )
        dr2 = Driver(
            id=2, name="Karan Shinde", phone="+91 98904 55112",
            license_number="MH14-2020-0044192", is_active=True
        )

        db.add_all([v1, v2, v3, dr1, dr2])
        db.commit()

        # 4. Seed Produce Listings
        listings = [
            Listing(
                id=1, farmer_id=1, farmer_name="Ramesh Kumar", crop="Tomato", variety="Roma",
                quantity_kg=1240.0, available_kg=820.0, unit="kg", quality_grade="Grade A",
                harvest_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
                expected_avail_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"),
                photo_url="🍅", farm_location="Dindori Road, Nashik, Maharashtra",
                state="Maharashtra", district="Nashik", lat=19.9975, lon=73.7898,
                base_mandi_price=23.0, ai_predicted_price=30.8, asking_price=31.0, status="ACTIVE"
            ),
            Listing(
                id=2, farmer_id=3, farmer_name="Lasalgaon FPO Hub", crop="Onion", variety="Nashik Red",
                quantity_kg=2100.0, available_kg=2100.0, unit="kg", quality_grade="Grade A",
                harvest_date=(now - timedelta(days=2)).strftime("%Y-%m-%d"),
                expected_avail_date=(now - timedelta(days=2)).strftime("%Y-%m-%d"),
                photo_url="🧅", farm_location="Lasalgaon FPO Hub, Nashik, Maharashtra",
                state="Maharashtra", district="Nashik", lat=20.1472, lon=74.2263,
                base_mandi_price=14.0, ai_predicted_price=18.7, asking_price=19.0, status="ACTIVE"
            ),
            Listing(
                id=3, farmer_id=2, farmer_name="Sunita Patil", crop="Onion", variety="Garwa",
                quantity_kg=900.0, available_kg=100.0, unit="kg", quality_grade="Grade B",
                harvest_date=(now - timedelta(days=1)).strftime("%Y-%m-%d"),
                expected_avail_date=(now - timedelta(days=1)).strftime("%Y-%m-%d"),
                photo_url="🧅", farm_location="Sangamner Farm Cluster, Ahmednagar, Maharashtra",
                state="Maharashtra", district="Ahmednagar", lat=19.5772, lon=74.2081,
                base_mandi_price=13.5, ai_predicted_price=17.5, asking_price=19.0, status="ACTIVE"
            ),
            Listing(
                id=4, farmer_id=3, farmer_name="Lasalgaon FPO Hub", crop="Onion", variety="White",
                quantity_kg=3400.0, available_kg=3400.0, unit="kg", quality_grade="Grade A",
                harvest_date=(now - timedelta(days=3)).strftime("%Y-%m-%d"),
                expected_avail_date=(now - timedelta(days=3)).strftime("%Y-%m-%d"),
                photo_url="🧅", farm_location="Niphad Belt, Nashik, Maharashtra",
                state="Maharashtra", district="Nashik", lat=20.0800, lon=74.1100,
                base_mandi_price=14.5, ai_predicted_price=19.2, asking_price=19.5, status="ACTIVE"
            ),
            Listing(
                id=5, farmer_id=4, farmer_name="Gurpreet Singh", crop="Wheat", variety="Sharbati Premium",
                quantity_kg=4500.0, available_kg=4500.0, unit="kg", quality_grade="Grade A",
                harvest_date=(now - timedelta(days=5)).strftime("%Y-%m-%d"),
                expected_avail_date=(now - timedelta(days=5)).strftime("%Y-%m-%d"),
                photo_url="🌾", farm_location="GT Road Mandi, Khanna, Punjab",
                state="Punjab", district="Ludhiana", lat=30.7068, lon=76.2201,
                base_mandi_price=19.0, ai_predicted_price=23.8, asking_price=24.0, status="ACTIVE"
            ),
            Listing(
                id=6, farmer_id=1, farmer_name="Ramesh Kumar", crop="Potato", variety="Jyoti",
                quantity_kg=3200.0, available_kg=2000.0, unit="kg", quality_grade="Grade A",
                harvest_date=(now - timedelta(days=10)).strftime("%Y-%m-%d"),
                expected_avail_date=(now - timedelta(days=10)).strftime("%Y-%m-%d"),
                photo_url="🥔", farm_location="Cold Storage Unit 3, Nashik, Maharashtra",
                state="Maharashtra", district="Nashik", lat=19.9800, lon=73.7700,
                base_mandi_price=11.0, ai_predicted_price=14.8, asking_price=15.0, status="ACTIVE"
            ),
        ]
        db.add_all(listings)
        db.commit()

        # 5. Seed Orders (Spanning different 9-stage milestones)
        
        # Order 1: KS-1024 (IN_TRANSIT)
        order1 = Order(
            id=1, order_code="KS-1024", buyer_id=5, buyer_name="City Fresh Retailers",
            farmer_id=1, farmer_name="Ramesh Kumar", listing_id=1, crop="Tomato", variety="Roma",
            quantity_kg=420.0, price_per_kg=31.0, total_amount=13020.0,
            pickup_address="Dindori Road, Nashik, Maharashtra", pickup_lat=19.9975, pickup_lon=73.7898,
            delivery_address="Dadar West, Mumbai, Maharashtra", delivery_lat=19.0178, delivery_lon=72.8478,
            status="IN_TRANSIT", estimated_delivery_time="Today, 4:35 PM", created_at=now - timedelta(hours=5)
        )

        # Order 2: KS-1028 (READY_FOR_PICKUP)
        order2 = Order(
            id=2, order_code="KS-1028", buyer_id=6, buyer_name="Sahakari Bulk Buyer",
            farmer_id=2, farmer_name="Sunita Patil", listing_id=3, crop="Onion", variety="Garwa",
            quantity_kg=800.0, price_per_kg=19.0, total_amount=15200.0,
            pickup_address="Sangamner Farm Cluster, Ahmednagar, Maharashtra", pickup_lat=19.5772, pickup_lon=74.2081,
            delivery_address="Vashi APMC, Navi Mumbai, Maharashtra", delivery_lat=19.0760, delivery_lon=72.9984,
            status="READY_FOR_PICKUP", estimated_delivery_time="Tomorrow, 11:30 AM", created_at=now - timedelta(hours=3)
        )

        # Order 3: KS-1015 (DELIVERED with proof)
        order3 = Order(
            id=3, order_code="KS-1015", buyer_id=5, buyer_name="City Fresh Retailers",
            farmer_id=1, farmer_name="Ramesh Kumar", listing_id=6, crop="Potato", variety="Jyoti",
            quantity_kg=1200.0, price_per_kg=15.0, total_amount=18000.0,
            pickup_address="Cold Storage Unit 3, Nashik, Maharashtra", pickup_lat=19.9800, pickup_lon=73.7700,
            delivery_address="Dadar West, Mumbai, Maharashtra", delivery_lat=19.0178, delivery_lon=72.8478,
            status="DELIVERED", estimated_delivery_time="Delivered at 4:31 PM", created_at=now - timedelta(days=1)
        )

        db.add_all([order1, order2, order3])
        db.commit()

        # 6. Seed Deliveries
        del1 = Delivery(
            id=1, order_id=1, vehicle_id=1, driver_id=1, status="IN_TRANSIT",
            current_lat=19.6967, current_lon=73.5611, last_location_name="Near Igatpuri Ghats, NH-160",
            last_updated=now - timedelta(minutes=12), estimated_arrival="Today, 4:35 PM",
            started_at=now - timedelta(hours=2, minutes=30)
        )
        del2 = Delivery(
            id=2, order_id=2, vehicle_id=2, driver_id=2, status="READY_FOR_PICKUP",
            current_lat=19.5772, current_lon=74.2081, last_location_name="Sangamner Farm Gate Staging",
            last_updated=now - timedelta(minutes=45), estimated_arrival="Tomorrow, 11:30 AM"
        )
        del3 = Delivery(
            id=3, order_id=3, vehicle_id=1, driver_id=1, status="DELIVERED",
            current_lat=19.0178, current_lon=72.8478, last_location_name="Dadar Wholesale Market, Mumbai",
            last_updated=now - timedelta(hours=14), estimated_arrival="Delivered",
            started_at=now - timedelta(hours=20), delivered_at=now - timedelta(hours=14)
        )
        db.add_all([del1, del2, del3])
        db.commit()

        # 7. Seed Delivery Proof for Order 3
        proof3 = DeliveryProof(
            delivery_id=3, order_id=3, receiver_name="Amit Sharma (Store In-Charge)",
            receiver_phone="+91 98200 11223",
            delivery_notes="40 bags of Jyoti Grade A potatoes inspected, weighed, and verified in excellent condition.",
            photo_url="📦 Verified Crate Seal Acceptance #CF-8821",
            delivered_at=now - timedelta(hours=14)
        )
        db.add(proof3)

        # 8. Seed Tracking Events for Order 1 (KS-1024 - 9-stage progression)
        t_events_1 = [
            TrackingEvent(order_id=1, delivery_id=1, status="ORDER_PLACED", latitude=19.9975, longitude=73.7898, location_name="Dindori Road, Nashik", timestamp=now - timedelta(hours=5), notes="Order placed by City Fresh Retailers for 420 kg Tomato.", updated_by="System"),
            TrackingEvent(order_id=1, delivery_id=1, status="ORDER_CONFIRMED", latitude=19.9975, longitude=73.7898, location_name="Dindori Road, Nashik", timestamp=now - timedelta(hours=4, minutes=45), notes="Farmer Ramesh Kumar acknowledged order and locked harvest lot.", updated_by="Ramesh Kumar"),
            TrackingEvent(order_id=1, delivery_id=1, status="PACKING", latitude=19.9800, longitude=73.7700, location_name="Nashik Packhouse Center", timestamp=now - timedelta(hours=3, minutes=30), notes="14 Grade-A crates weighed, packed, and sealed with tamper security tags.", updated_by="Ramesh Kumar"),
            TrackingEvent(order_id=1, delivery_id=1, status="READY_FOR_PICKUP", latitude=19.9975, longitude=73.7898, location_name="Farm Gate, Nashik", timestamp=now - timedelta(hours=2, minutes=50), notes="Crates staged at farm gate. Freight truck MH-15-EG-4482 arrived.", updated_by="Suresh Patil"),
            TrackingEvent(order_id=1, delivery_id=1, status="PICKED_UP", latitude=19.9975, longitude=73.7898, location_name="Farm Gate, Nashik", timestamp=now - timedelta(hours=2, minutes=30), notes="Loaded into vehicle MH-15-EG-4482. Chain of custody confirmed by driver.", updated_by="Suresh Patil"),
            TrackingEvent(order_id=1, delivery_id=1, status="IN_TRANSIT", latitude=19.6967, longitude=73.5611, location_name="Near Igatpuri Ghats, NH-160", timestamp=now - timedelta(minutes=12), notes="En route on Mumbai-Nashik highway corridor. Steady traffic flow.", updated_by="Suresh Patil"),
        ]
        db.add_all(t_events_1)

        # 9. Seed Notifications
        n1 = Notification(
            user_id=1, title="New Order Received", message="City Fresh Retailers placed an order for 420 kg Tomato (Order #KS-1024).",
            type="ORDER", is_read=False, created_at=now - timedelta(hours=5)
        )
        n2 = Notification(
            user_id=5, title="Shipment In Transit", message="Your order #KS-1024 has passed Igatpuri checkpoint and is on schedule for 4:35 PM delivery.",
            type="DELIVERY", is_read=False, created_at=now - timedelta(minutes=12)
        )
        db.add_all([n1, n2])
        db.commit()

        # 10. Seed Market Prices
        csv_path = "ml/data/agmarknet_historical_prices.csv"
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            recent_df = df.tail(1000)
            mp_records = []
            for _, row in recent_df.iterrows():
                mp_records.append(MarketPrice(
                    date=str(row['date']), commodity=str(row['commodity']), variety=str(row['variety']),
                    state=str(row['state']), district=str(row['district']), market=str(row['market']),
                    min_price=float(row['min_price']), max_price=float(row['max_price']),
                    modal_price=float(row['modal_price']), arrival_quantity=float(row['arrival_quantity'])
                ))
            db.bulk_save_objects(mp_records)
            db.commit()

        print("Multi-user database seeded successfully!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_database(force_refresh=True)
