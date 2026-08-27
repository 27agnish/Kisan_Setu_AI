# 🌾 Kisan Setu (किसान सेतु)
### Multi-User Agricultural Marketplace, AI Price Prediction & 9-Stage Google Maps Delivery Tracking
**Design & Engineering Concept for Ministry of Consumer Affairs, Food & Public Distribution — Dept. of Consumer Affairs (DoCA)**

---

## 📌 Overview

**Kisan Setu** is an end-to-end multi-user agricultural marketplace bridging farmers and Farmer Producer Organisations (FPOs) directly with bulk buyers, institutions, and retailers. It replaces intermediate middleman commissions with:
1. **Professional 9-Stage Order & Delivery Tracking System**: Real-time lifecycle visibility from farm harvest gate to doorstep delivery with authentic Google Maps tracking, driver dispatch milestones, checkpoint coordinate updates, and verified digital delivery proofs.
2. **Real Interactive Google Maps Platform Integration**: Real map location pickers, farm gate coordinate storage, multi-stop corridor routing via Google Routes API, and live shipment tracking.
3. **Role-Based Multi-User Authentication**: Strict separation between **Farmer/FPO** and **Buyer/Consumer** workflows with bcrypt password hashing and secure JWT session tokens.
4. **Genuine ML Price Prediction Pipeline**: Autoregressive XGBoost and Random Forest models trained on 48,000+ daily AGMARKNET records predicting fair modal prices with 95% confidence bands.
5. **Shared Freight Logistics & Route Optimisation**: Grouping multi-farm pickups with multi-drop deliveries to save ₹2,400+ to ₹5,100+ in diesel fuel and reduce transport delays.
6. **Smart Settlement & Real Earnings**: Direct buyer-to-farmer orders with instant wallet credit upon confirmed digital delivery proof.

---

## 🚚 9-Stage Order Fulfillment Lifecycle

```
[1. ORDER_PLACED] ──> [2. ORDER_CONFIRMED] ──> [3. PACKING] ──> [4. READY_FOR_PICKUP]
                                                                          │
  ┌───────────────────────────────────────────────────────────────────────┘
  ▼
[5. PICKED_UP] ──> [6. IN_TRANSIT] ──> [7. NEAR_DESTINATION] ──> [8. OUT_FOR_DELIVERY]
                                                                          │
  ┌───────────────────────────────────────────────────────────────────────┘
  ▼
[9. DELIVERED & SETTLED] (✓ Delivery Proof + Instant Farmer Wallet Payout)
```

| Stage | Name | Description | Actors |
| :--- | :--- | :--- | :--- |
| **1** | `ORDER_PLACED` | Order submitted by buyer and registered in queue | Buyer / System |
| **2** | `ORDER_CONFIRMED` | Farmer verifies harvest lot and locks allotment | Farmer |
| **3** | `PACKING` | Produce graded, weighed into standard crates, and sealed | Farmer / Packhouse |
| **4** | `READY_FOR_PICKUP` | Crates staged at farm gate; freight vehicle assigned | Farmer / Dispatch |
| **5** | `PICKED_UP` | Loaded into carrier truck; chain-of-custody verified | Driver / Carrier |
| **6** | `IN_TRANSIT` | Vehicle actively navigating highway freight corridor | Driver / Google Routes |
| **7** | `NEAR_DESTINATION` | Vehicle reached urban perimeter / city aggregation junction | Driver / Checkpoint |
| **8** | `OUT_FOR_DELIVERY` | Navigating destination market lanes for doorstep drop | Driver |
| **9** | `DELIVERED` | Produce inspected, receiver proof recorded, farmer wallet credited | Receiver / Driver |

---

## 🗺️ Google Maps Platform Setup & Configuration

Kisan Setu integrates **Google Maps Platform** for farm location selection, buyer delivery positioning, multi-stop route optimization, and live order tracking.

### 1. Enable Required Google Maps APIs
In your [Google Cloud Console](https://console.cloud.google.com):
1. Create a new Google Cloud Project (or select an existing one).
2. Navigate to **APIs & Services > Library** and enable:
   - **Maps JavaScript API** (For interactive frontend map canvas and marker dragging)
   - **Places API (New)** (For address autocomplete and location search)
   - **Routes API** (For multi-stop route computation, traffic-aware durations, and waypoint optimization)
   - **Geocoding API** (For coordinate-to-address reverse geocoding)

### 2. Create and Restrict Your API Key
1. Go to **APIs & Services > Credentials** and click **+ Create Credentials > API Key**.
2. **Restrict the Key** (Recommended for security):
   - Under **Set application restrictions**, select **HTTP referrers (websites)** and add `http://localhost:8000/*` and `http://127.0.0.1:8000/*`.
   - Under **API restrictions**, select **Restrict key** and check: *Maps JavaScript API*, *Places API (New)*, *Routes API*, and *Geocoding API*.
   - Guide: [https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys)

### 3. Add Key to Environment
Edit `.env` in the project root:
```ini
GOOGLE_MAPS_API_KEY=AIzaSyYourActualGoogleMapsAPIKeyHere
```

> [!NOTE]
> **Prototyping / Maps Demo Key**: You can also use the free **Google Maps Demo Key** for prototyping without entering billing details at:
> `https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_git_agentskills_v1`
>
> If `GOOGLE_MAPS_API_KEY` is left blank, Kisan Setu gracefully displays an informative notice banner and activates an interactive vector map coordinate picker and corridor matrix solver so the entire application remains testable out-of-the-box.

---

## 🚀 Quick Start Guide

### 1. Installation & Environment Setup
```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Start Application Server
```bash
.venv/bin/python run_app.py --port 8000
```
Visit the application in your browser:
👉 **`http://localhost:8000`**

Interactive Swagger API Documentation:
👉 **`http://localhost:8000/docs`**

---

## 🧪 Demo Evaluator Test Accounts (Pre-Seeded)

For rapid evaluation, the database is pre-seeded with authentic accounts (Password: `secret123`):

| Persona | Email | Password | Role | Features Accessible |
| :--- | :--- | :--- | :--- | :--- |
| **Ramesh Kumar** | `ramesh@kisansetu.in` | `secret123` | `FARMER_FPO` | Farmer Dashboard, Produce Listing, Orders Received, 9-Stage Tracking, Settled Earnings |
| **City Fresh Retailers** | `cityfresh@kisansetu.in` | `secret123` | `BUYER_CONSUMER` | Buyer Dashboard, Marketplace, My Orders, 9-Stage Google Map Delivery Tracking |
| **Sunita Patil** | `sunita@kisansetu.in` | `secret123` | `FARMER_FPO` | Sangamner cluster farm, Onion inventory, Payouts |
| **Sahakari Bulk Buyer** | `sahakari@kisansetu.in` | `secret123` | `BUYER_CONSUMER` | Vashi APMC bulk procurement, Route coordination |

*On the Sign In screen, click **"🧑‍🌾 Farmer (Ramesh)"** or **"🛒 Buyer (City Fresh)"** to fill credentials with one click!*

---

## 🧪 Automated Integration Testing Suite

Run the full end-to-end integration test suite verifying authentication, bcrypt hashing, JWT validation, profile setups, AI price predictions, order placement, stock decrement, Google routes, 9-stage tracking progression, delivery proofs, and farmer payouts:
```bash
.venv/bin/python test_backend_api.py
```
or
```bash
.venv/bin/python run_app.py --test
```

---

## 🤖 ML Model Retraining Pipeline

To retrain the ML price prediction models with new AGMARKNET mandi CSV dumps:
```bash
.venv/bin/python ml/train_model.py
```
