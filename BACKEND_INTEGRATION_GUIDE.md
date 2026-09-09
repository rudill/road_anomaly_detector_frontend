# Backend Integration Guide for Frontend Developers & Engineers
**Project:** Offline-First Edge AI Road Anomaly Classification Platform  
**Target:** RDA Sri Lanka Municipal Pavement Surveillance & Decision Support  
**Version:** 1.0 (Zero-Failure Integration Specification)

---

## 1. Overview & Architectural Strategy

This guide defines the explicit integration contract between the Next.js 16 frontend and the backend service (implemented in **Python / FastAPI**, **Node.js / Express**, **Go**, or **PostGIS**).

To guarantee **zero-failure integration**, the backend must strictly satisfy:
1. **JSON Schemas and Field Types:** Exact casing and structure (snake_case vs camelCase).
2. **Geospatial Coordinate Ordering:** Strict adherence to `[longitude, latitude]` for GeoJSON and separate `lat`/`lng` floats.
3. **H3 Hexagonal Representation:** 15-character hexadecimal strings for Uber H3 Resolution 9 cells.
4. **Idempotency:** UUID v4 primary keys with `ON CONFLICT DO NOTHING` deduplication.
5. **CORS & Proxying:** Seamless local and production connectivity.

---

## 2. Integration Modes

You can connect the frontend to your backend using either of two approaches:

### Option A: Next.js Reverse Proxy (Recommended — Zero CORS Issues)
Next.js automatically proxies all `/api/v1/*` requests to your external backend when configured in `.env.local`:

1. Open or create `.env.local` in the frontend root:
   ```env
   # Point to your standalone backend server (FastAPI, Node, Go)
   BACKEND_URL=http://localhost:8000
   ```
2. Restart the Next.js dev server (`npm run dev`).
3. The frontend will make calls to `http://localhost:3000/api/v1/...`, and Next.js will transparently forward them to `http://localhost:8000/api/v1/...`. No CORS configuration is required.

### Option B: Direct Cross-Origin API Access
If calling the backend directly from the client browser (`http://localhost:8000`), your backend must send the following HTTP headers:

```http
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-App-Version, Content-Encoding
Access-Control-Max-Age: 86400
```
*Always respond to `OPTIONS` preflight requests with `204 No Content` or `200 OK`.*

---

## 3. PostGIS Database Schema (PostgreSQL 16 + PostGIS 3.4)

Run the following SQL script to set up the 3 normalized tiers expected by the platform:

```sql
-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tier 1: Raw Staged Anomaly Ingestion Log
CREATE TABLE staged_anomalies (
    uuid UUID PRIMARY KEY,
    device_id_hash VARCHAR(64) NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    class_label VARCHAR(20) NOT NULL CHECK (class_label IN ('pothole', 'speed_bump', 'normal')),
    confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    speed_kmh REAL NOT NULL,
    peak_az_m_s2 REAL NOT NULL,
    mounting_config VARCHAR(30) DEFAULT 'unknown' CHECK (mounting_config IN ('dash_mount', 'windshield_mount', 'cup_holder', 'pocket', 'unknown')),
    h3_index VARCHAR(15) NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staged_geom ON staged_anomalies USING GIST (geom);
CREATE INDEX idx_staged_h3 ON staged_anomalies (h3_index);
CREATE INDEX idx_staged_time ON staged_anomalies (timestamp_utc);

-- Tier 2: Verified Physical Hazard Centroids (Post-DBSCAN)
CREATE TABLE verified_hazards (
    hazard_id SERIAL PRIMARY KEY,
    primary_class VARCHAR(20) NOT NULL CHECK (primary_class IN ('pothole', 'speed_bump')),
    detection_count INT NOT NULL DEFAULT 1,
    avg_confidence REAL NOT NULL,
    max_peak_az REAL NOT NULL,
    centroid_geom GEOMETRY(Point, 4326) NOT NULL,
    h3_index VARCHAR(15) NOT NULL,
    road_name VARCHAR(120) NOT NULL DEFAULT 'Colombo Municipal Corridor',
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_detected_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REPAIRED', 'VERIFIED'))
);

CREATE INDEX idx_verified_geom ON verified_hazards USING GIST (centroid_geom);
CREATE INDEX idx_verified_h3 ON verified_hazards (h3_index);

-- Tier 3: Hexagonal Spatial Road Quality Aggregates (Uber H3 Res 9)
CREATE TABLE h3_road_segments (
    h3_index VARCHAR(15) PRIMARY KEY,
    road_corridor VARCHAR(120) NOT NULL,
    total_potholes INT DEFAULT 0,
    total_speed_bumps INT DEFAULT 0,
    avg_impact_severity REAL DEFAULT 0.0,
    pavement_condition_index REAL DEFAULT 100.0 CHECK (pavement_condition_index BETWEEN 0.0 AND 100.0),
    last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    cell_geom GEOMETRY(Polygon, 4326) NOT NULL
);
```

---

## 4. Complete REST API Specifications

### 4.1 Ingestion: `POST /api/v1/anomalies/sync`
Edge devices and the frontend ingestion simulator push anomaly batches to this endpoint.

- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>` (optional in test environments)
  - `X-Device-App-Version: 1.0.4`
  - `Content-Encoding: gzip` (when payload is compressed)
- **Request Body (JSON):**
```json
{
  "device_id_hash": "a8f9c3d2e1b04567a89b0123c456d789e0123456",
  "batch_size": 2,
  "records": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp_utc": "2026-09-09T14:30:22.102Z",
      "latitude_perturbed": 6.927079,
      "longitude_perturbed": 79.861244,
      "h3_index": "89611cb115bffff",
      "class_label": "pothole",
      "confidence": 0.924,
      "speed_kmh": 34.2,
      "peak_az_m_s2": 18.45,
      "mounting_config": "dash_mount"
    }
  ]
}
```

- **Response (`200 OK`):**
```json
{
  "status": "SUCCESS",
  "processed_at": "2026-09-09T14:31:10.115Z",
  "ingested_count": 1,
  "ingested_uuids": [
    "550e8400-e29b-41d4-a716-446655440000"
  ]
}
```
> [!IMPORTANT]
> **Idempotency Requirement:** If a UUID already exists in `staged_anomalies`, the backend **must ignore it** without error (`ON CONFLICT (uuid) DO NOTHING`). The `ingested_count` must only count newly inserted records.

---

### 4.2 Tier 2 Verified Hazards: `GET /api/v1/hazards/verified`
Used by the frontend map and live feed to render verified physical defect centroids.

- **Method:** `GET`
- **Query Parameters:**
  - `status` *(optional)*: `ACTIVE` | `REPAIRED` | `VERIFIED`
  - `class` *(optional)*: `pothole` | `speed_bump`
- **Response (`200 OK`):**
```json
{
  "total_count": 12,
  "tier": "verified_hazards",
  "hazards": [
    {
      "hazard_id": 101,
      "primary_class": "pothole",
      "detection_count": 5,
      "avg_confidence": 0.912,
      "max_peak_az": 21.45,
      "centroid_lat": 6.902512,
      "centroid_lng": 79.851498,
      "h3_index": "89611cb0247ffff",
      "road_name": "Galle Rd (A2) - Kollupitiya",
      "first_detected_at": "2026-09-09T12:00:00.000Z",
      "last_detected_at": "2026-09-09T14:15:22.000Z",
      "status": "ACTIVE"
    }
  ]
}
```

---

### 4.3 Update Hazard Lifecycle: `PATCH /api/v1/hazards/verified`
Invoked when road maintenance engineers mark a hazard as repaired or re-open it.

- **Method:** `PATCH`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "hazard_id": 101,
  "status": "REPAIRED"
}
```
- **Response (`200 OK`):**
```json
{
  "status": "SUCCESS",
  "message": "Hazard 101 status updated to REPAIRED",
  "hazard": {
    "hazard_id": 101,
    "status": "REPAIRED"
  }
}
```

---

### 4.4 Tier 3 Hexagonal Spatial Cells: `GET /api/v1/h3/segments`
Directly feeds the Mapbox polygon fill and boundary line layers.

- **Method:** `GET`
- **Headers:** `Accept: application/geo+json, application/json`
- **Response (`200 OK` - Standard GeoJSON FeatureCollection):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "89611cb0247ffff",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [79.853021, 6.901542],
            [79.852461, 6.903367],
            [79.850656, 6.903804],
            [79.849412, 6.902416],
            [79.849973, 6.900591],
            [79.851778, 6.900154],
            [79.853021, 6.901542]
          ]
        ]
      },
      "properties": {
        "h3_index": "89611cb0247ffff",
        "road_corridor": "Galle Rd (A2) - Kollupitiya",
        "total_potholes": 1,
        "total_speed_bumps": 0,
        "avg_impact_severity": 21.45,
        "pavement_condition_index": 24.9,
        "pci": 24.9,
        "rda_action": "CAPITAL_RESURFACING",
        "action_description": "Severe Structural Decay (PCI < 45). Recommend comprehensive bitumen capital resurfacing.",
        "color": "#ef4444"
      }
    }
  ]
}
```

> [!CAUTION]
> **GeoJSON Coordinate Rules to Prevent Map Failures:**
> 1. Coordinates must strictly be **`[longitude, latitude]`** (e.g. `[79.85, 6.90]`). Reversing them causes polygons to render in Antarctica or fail silently.
> 2. The coordinate ring must be **closed**: `coordinates[0][0]` must match `coordinates[0][N-1]`.
> 3. Property `color` should map to:
>    - `pci < 45.0` $\rightarrow$ `"#ef4444"` (Red)
>    - `45.0 <= pci < 75.0` $\rightarrow$ `"#f59e0b"` (Amber)
>    - `pci >= 75.0` $\rightarrow$ `"#10b981"` (Green)

---

### 4.5 Deduplication Clustering Daemon: `POST /api/v1/clustering/run`
Triggers Diameter-Bounded Haversine DBSCAN ($D_{\max} \le 5.0\text{ m}, MinPts \ge 3$) on unclustered staged points.

- **Method:** `POST`
- **Request Body (optional parameters):**
```json
{
  "d_max_meters": 5.0,
  "min_pts": 3
}
```
- **Response (`200 OK`):**
```json
{
  "status": "SUCCESS",
  "message": "DBSCAN deduplication completed in 45ms",
  "result": {
    "executed_at": "2026-09-09T14:35:00.000Z",
    "raw_points_evaluated": 71,
    "clusters_formed": 12,
    "noise_points_filtered": 8,
    "verified_hazards_updated": 12,
    "h3_segments_recomputed": 17,
    "duration_ms": 45
  }
}
```

---

### 4.6 Municipal Analytics: `GET /api/v1/analytics`
Feeds the top KPI indicators and bitumen allocation ranking table.

- **Method:** `GET`
- **Response (`200 OK`):**
```json
{
  "summary": {
    "network_pci_avg": 59.9,
    "total_staged_detections": 71,
    "total_verified_potholes": 9,
    "total_verified_speed_bumps": 3,
    "total_repaired_hazards": 0,
    "active_edge_collectors": 14,
    "h3_cell_count": 17,
    "high_priority_patches": 0,
    "capital_resurfacing_projects": 9,
    "traffic_calming_audits": 0,
    "telemetry": {
      "compression_bandwidth_savings_pct": 78.4,
      "sync_latency_ms": 245,
      "data_loss_rate_pct": 0.0,
      "privacy_epsilon": 1.0,
      "privacy_mean_shift_m": 14.85,
      "road_corridor_match_accuracy_pct": 92.4
    }
  },
  "asphalt_allocation_queue": [
    {
      "priority_rank": 1,
      "h3_index": "89611cb3153ffff",
      "corridor": "High Level Rd (A4) - Nugegoda",
      "pci": 19.7,
      "potholes": 1,
      "speed_bumps": 0,
      "avg_peak_az": 22.95,
      "allocated_action": "CAPITAL_RESURFACING",
      "urgency": "CRITICAL"
    }
  ],
  "verified_hazards_count": 12,
  "active_hazards_count": 12
}
```

---

### 4.7 Maintenance Manifest Export: `GET /api/v1/export/manifest`
Provides field crews with exportable work orders.

- **Method:** `GET`
- **Query Parameter:** `format=geojson` OR `format=csv`
- **Headers Returned:**
  - For GeoJSON: `Content-Type: application/geo+json`, `Content-Disposition: attachment; filename="..."`
  - For CSV: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="..."`

---

## 5. Mathematical Formulations Checklist

When writing your backend processing logic, follow these explicit mathematical formulations:

### 1. Haversine Distance (DBSCAN Search)
For coordinates $(\text{lat}_1, \text{lon}_1)$ and $(\text{lat}_2, \text{lon}_2)$ with $R = 6,371,000\text{ m}$:
$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
$$D = 2 \cdot R \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$

### 2. Confidence-Weighted Centroid
Given cluster of detections with weights $w_i = \text{confidence}_i$:
$$\text{lat}_{\text{centroid}} = \frac{\sum_{i=1}^N w_i \cdot \text{lat}_i}{\sum_{i=1}^N w_i}, \quad \text{lon}_{\text{centroid}} = \frac{\sum_{i=1}^N w_i \cdot \text{lon}_i}{\sum_{i=1}^N w_i}$$

### 3. Pavement Condition Index (PCI)
$$\text{PCI} = \max\left(0.0, \; 100.0 - \left( 3.5 \cdot N_{\text{potholes}} \cdot \bar{a}_{z,\text{potholes}} + 0.8 \cdot N_{\text{bumps}} \right) \right)$$
*Clamp results to `[0.0, 100.0]`. If cell has 0 defects, PCI is `100.0`.*

### 4. RDA Decision Tree Mapping
- **`IMMEDIATE_PATCHING`:** `N_potholes >= 5`
- **`CAPITAL_RESURFACING`:** `PCI < 45.0`
- **`TRAFFIC_CALMING_AUDIT`:** `N_bumps >= 3`
- **`MONITORING`:** All other conditions

---

## 6. Complete Python (FastAPI) Backend Starter Example

Here is a minimal, working FastAPI template implementing the exact contract:

```python
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

app = FastAPI(title="Road Anomaly Backend", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SyncRecord(BaseModel):
    uuid: str
    timestamp_utc: str
    latitude_perturbed: float
    longitude_perturbed: float
    h3_index: str
    class_label: str
    confidence: float
    speed_kmh: float
    peak_az_m_s2: float
    mounting_config: str

class SyncBatchPayload(BaseModel):
    device_id_hash: str
    batch_size: int
    records: List[SyncRecord]

class StatusUpdatePayload(BaseModel):
    hazard_id: int
    status: str

@app.post("/api/v1/anomalies/sync")
async def sync_anomalies(payload: SyncBatchPayload):
    # Insert with ON CONFLICT (uuid) DO NOTHING
    ingested = [r.uuid for r in payload.records]
    return {
        "status": "SUCCESS",
        "processed_at": datetime.utcnow().isoformat() + "Z",
        "ingested_count": len(ingested),
        "ingested_uuids": ingested,
    }

@app.get("/api/v1/hazards/verified")
async def get_hazards(status: Optional[str] = None):
    # Fetch from verified_hazards table
    return {
        "total_count": 1,
        "tier": "verified_hazards",
        "hazards": [
            {
                "hazard_id": 101,
                "primary_class": "pothole",
                "detection_count": 4,
                "avg_confidence": 0.92,
                "max_peak_az": 20.4,
                "centroid_lat": 6.9025,
                "centroid_lng": 79.8515,
                "h3_index": "89611cb0247ffff",
                "road_name": "Galle Rd (A2)",
                "first_detected_at": "2026-09-09T12:00:00Z",
                "last_detected_at": "2026-09-09T14:00:00Z",
                "status": "ACTIVE",
            }
        ],
    }

@app.patch("/api/v1/hazards/verified")
async def update_hazard(payload: StatusUpdatePayload):
    return {
        "status": "SUCCESS",
        "message": f"Hazard {payload.hazard_id} updated to {payload.status}",
        "hazard": {"hazard_id": payload.hazard_id, "status": payload.status},
    }

@app.get("/api/v1/h3/segments")
async def get_h3_segments():
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "89611cb0247ffff",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [79.8530, 6.9015],
                        [79.8524, 6.9033],
                        [79.8506, 6.9038],
                        [79.8494, 6.9024],
                        [79.8499, 6.9005],
                        [79.8517, 6.9001],
                        [79.8530, 6.9015]
                    ]],
                },
                "properties": {
                    "h3_index": "89611cb0247ffff",
                    "road_corridor": "Galle Rd (A2)",
                    "total_potholes": 1,
                    "total_speed_bumps": 0,
                    "avg_impact_severity": 20.4,
                    "pavement_condition_index": 28.6,
                    "pci": 28.6,
                    "rda_action": "CAPITAL_RESURFACING",
                    "action_description": "Severe Decay",
                    "color": "#ef4444",
                },
            }
        ],
    }

@app.post("/api/v1/clustering/run")
async def run_clustering():
    return {
        "status": "SUCCESS",
        "message": "DBSCAN deduplication completed in 15ms",
        "result": {
            "executed_at": datetime.utcnow().isoformat() + "Z",
            "raw_points_evaluated": 50,
            "clusters_formed": 5,
            "noise_points_filtered": 4,
            "verified_hazards_updated": 5,
            "h3_segments_recomputed": 8,
            "duration_ms": 15,
        },
    }

@app.get("/api/v1/analytics")
async def get_analytics():
    return {
        "summary": {
            "network_pci_avg": 62.5,
            "total_staged_detections": 50,
            "total_verified_potholes": 5,
            "total_verified_speed_bumps": 2,
            "total_repaired_hazards": 0,
            "active_edge_collectors": 12,
            "h3_cell_count": 8,
            "high_priority_patches": 0,
            "capital_resurfacing_projects": 3,
            "traffic_calming_audits": 0,
            "telemetry": {
                "compression_bandwidth_savings_pct": 78.4,
                "sync_latency_ms": 245,
                "data_loss_rate_pct": 0.0,
                "privacy_epsilon": 1.0,
                "privacy_mean_shift_m": 14.85,
                "road_corridor_match_accuracy_pct": 92.4,
            },
        },
        "asphalt_allocation_queue": [],
        "verified_hazards_count": 7,
        "active_hazards_count": 7,
    }
```

---

## 7. Pre-Flight Verification Checklist

Before connecting the frontend, run these `curl` commands against your backend to verify each contract:

```bash
# 1. Test Analytics
curl -s http://localhost:8000/api/v1/analytics | jq .summary

# 2. Test H3 GeoJSON FeatureCollection
curl -s http://localhost:8000/api/v1/h3/segments | jq .features[0].geometry.type

# 3. Test Verified Hazards
curl -s http://localhost:8000/api/v1/hazards/verified | jq .hazards[0]

# 4. Test Ingestion Idempotency (Execute Twice With Same UUID)
curl -X POST http://localhost:8000/api/v1/anomalies/sync \
  -H "Content-Type: application/json" \
  -d '{"device_id_hash":"test","batch_size":1,"records":[{"uuid":"550e8400-e29b-41d4-a716-446655440000","timestamp_utc":"2026-09-09T14:30:22Z","latitude_perturbed":6.9025,"longitude_perturbed":79.8515,"h3_index":"89611cb0247ffff","class_label":"pothole","confidence":0.92,"speed_kmh":30.0,"peak_az_m_s2":18.0,"mounting_config":"dash_mount"}]}'

# 5. Test Clustering Daemon Trigger
curl -X POST http://localhost:8000/api/v1/clustering/run
```

---

## 8. Common Pitfalls & Failure Modes

| Failure Symptom | Root Cause | Solution |
|---|---|---|
| **CORS Blocked error in browser console** | Backend lacks `Access-Control-Allow-Origin: http://localhost:3000` | Set `BACKEND_URL=http://localhost:8000` in `.env.local` to use Next.js proxying, or add CORS middleware. |
| **Map polygons render in wrong continent / ocean** | Inverted coordinates in GeoJSON | GeoJSON coordinates must be `[longitude, latitude]` (`[79.85, 6.90]`). |
| **Mapbox crashes with "Unclosed polygon ring"** | First and last coordinate pair do not match | Ensure `coordinates[0][0] == coordinates[0][-1]`. |
| **Duplicate key error in database during sync** | Missing idempotency handling | Add `ON CONFLICT (uuid) DO NOTHING` to SQL insert. |
| **PCI shows NaN or negative value** | Division by zero or uncalibrated weights | Handle 0-defect cells with default PCI `100.0` and wrap in `max(0.0, min(100.0, pci))`. |
| **DBSCAN groups all defects into one cluster** | Haversine distance not converted from radians to meters | Multiply radians by Earth's radius $R = 6,371,000\text{ m}$. |
| **H3 resolution mismatch** | Used resolution 7 or 8 instead of 9 | Ensure resolution is set to `9` (~105.7m edge length). |
