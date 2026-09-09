/**
 * Types and Interfaces for the Offline-First Edge AI Road Anomaly Classification Platform
 * Defined in backend-pipeline-architecture-spec.md
 */

// Class Labels recognized by on-device INT8 Quantized TFLite model
export type AnomalyClassLabel = 'pothole' | 'speed_bump' | 'normal';

// Mounting configurations on participating mobile edge vehicles
export type MountingConfig = 'dash_mount' | 'windshield_mount' | 'cup_holder' | 'pocket' | 'unknown';

// Lifecycle status of a verified physical hazard
export type HazardStatus = 'ACTIVE' | 'REPAIRED' | 'VERIFIED';

// RDA Municipal Action Recommendation
export type RDAActionType = 'IMMEDIATE_PATCHING' | 'CAPITAL_RESURFACING' | 'TRAFFIC_CALMING_AUDIT' | 'MONITORING';

/**
 * Tier 1: Raw Staged Anomaly Ingestion Log
 * Matches PostGIS table: `staged_anomalies`
 */
export interface StagedAnomaly {
  uuid: string; // UUID v4 primary key for idempotent deduplication
  device_id_hash: string; // SHA-256 pseudonymized device fingerprint
  timestamp_utc: string; // ISO 8601 UTC timestamp
  latitude_perturbed: number; // Perturbed via Laplacian Differential Privacy (epsilon = 1.0)
  longitude_perturbed: number;
  h3_index: string; // Uber H3 Resolution 9 hexagonal cell index (~105m edge)
  class_label: AnomalyClassLabel;
  confidence: number; // 0.0 to 1.0 classification confidence
  speed_kmh: number; // Vehicle speed at time of incident
  peak_az_m_s2: number; // Peak vertical Z-axis acceleration (m/s^2)
  mounting_config: MountingConfig;
  created_at: string;
}

/**
 * Tier 2: Verified Physical Hazard Centroids (Post-DBSCAN)
 * Matches PostGIS table: `verified_hazards`
 */
export interface VerifiedHazard {
  hazard_id: number; // SERIAL primary key
  primary_class: 'pothole' | 'speed_bump';
  detection_count: number; // Number of independent passes/vehicles in cluster (MinPts >= 3)
  avg_confidence: number; // Average classification confidence of detections
  max_peak_az: number; // Maximum vertical impact recorded (m/s^2)
  centroid_lat: number; // Confidence-weighted centroid latitude
  centroid_lng: number; // Confidence-weighted centroid longitude
  h3_index: string; // Uber H3 Resolution 9 index
  road_name: string; // Localized corridor name (e.g., Galle Rd, Baseline Rd)
  first_detected_at: string;
  last_detected_at: string;
  status: HazardStatus;
  staged_uuids?: string[]; // References to contributing staged detections
}

/**
 * Tier 3: Hexagonal Spatial Road Quality Aggregates (Uber H3 Res 9)
 * Matches PostGIS table: `h3_road_segments`
 */
export interface H3RoadSegment {
  h3_index: string; // Uber H3 Resolution 9 primary key
  road_corridor: string; // Nearest major corridor name
  total_potholes: number;
  total_speed_bumps: number;
  avg_impact_severity: number; // Mean peak vertical acceleration (m/s^2)
  pavement_condition_index: number; // PCI: 0.0 to 100.0
  last_updated_at: string;
  polygon: [number, number][]; // [longitude, latitude][] GeoJSON polygon ring
  rda_action: RDAActionType;
  action_description: string;
}

/**
 * Ingestion Layer: POST /api/v1/anomalies/sync
 * Payload Schema (JSON Batch of up to 50 anomalies)
 */
export interface SyncBatchRecord {
  uuid: string;
  timestamp_utc: string;
  latitude_perturbed: number;
  longitude_perturbed: number;
  h3_index: string;
  class_label: AnomalyClassLabel;
  confidence: number;
  speed_kmh: number;
  peak_az_m_s2: number;
  mounting_config: MountingConfig;
}

export interface SyncBatchPayload {
  device_id_hash: string;
  batch_size: number;
  records: SyncBatchRecord[];
}

export interface SyncBatchResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  processed_at: string;
  ingested_count: number;
  ingested_uuids: string[];
  message?: string;
}

/**
 * DBSCAN Spatial Deduplication Configuration & Results
 */
export interface DBSCANParams {
  distance_metric: 'Haversine';
  d_max_meters: number; // Maximum search radius (default: 5.0m)
  min_pts: number; // Minimum core samples (default: 3)
}

export interface DBSCANExecutionResult {
  executed_at: string;
  raw_points_evaluated: number;
  clusters_formed: number;
  noise_points_filtered: number;
  verified_hazards_updated: number;
  h3_segments_recomputed: number;
  duration_ms: number;
}

/**
 * Municipal Decision Support & System Telemetry Metrics
 */
export interface MunicipalAnalyticsSummary {
  network_pci_avg: number;
  total_staged_detections: number;
  total_verified_potholes: number;
  total_verified_speed_bumps: number;
  total_repaired_hazards: number;
  active_edge_collectors: number;
  h3_cell_count: number;
  high_priority_patches: number;
  capital_resurfacing_projects: number;
  traffic_calming_audits: number;
  telemetry: {
    compression_bandwidth_savings_pct: number; // 78.4%
    sync_latency_ms: number; // 245 ms
    data_loss_rate_pct: number; // 0.00%
    privacy_epsilon: number; // 1.0 (Laplacian DP)
    privacy_mean_shift_m: number; // 14.85 meters
    road_corridor_match_accuracy_pct: number; // 92.4%
  };
}
