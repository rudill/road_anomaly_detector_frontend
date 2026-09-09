'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { VerifiedHazard, StagedAnomaly, H3RoadSegment, HazardStatus } from '@/types/road-anomaly';

export interface MapboxMapRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetLocation: () => void;
  toggleStyle: () => void;
  flyToHazard: (hazard: VerifiedHazard) => void;
  flyToH3: (segment: H3RoadSegment) => void;
  getStyleName: () => string;
}

interface MapboxMapProps {
  hazards: VerifiedHazard[];
  stagedAnomalies?: StagedAnomaly[];
  h3Segments?: H3RoadSegment[];
  showH3Grid?: boolean;
  showVerifiedHazards?: boolean;
  showStagedPoints?: boolean;
  selectedHazardId?: number | null;
  onSelectHazard?: (hazard: VerifiedHazard) => void;
  onSelectH3Segment?: (segment: H3RoadSegment) => void;
  onUpdateHazardStatus?: (hazardId: number, status: HazardStatus) => void;
}

// Map styles available
const MAP_STYLES = [
  { id: 'mapbox://styles/mapbox/dark-v11', label: 'Dark Canvas' },
  { id: 'mapbox://styles/mapbox/navigation-night-v1', label: 'Night Nav' },
  { id: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite' },
  { id: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
];

const COLOMBO_DEFAULT_CENTER: [number, number] = [79.861, 6.912];

export const MapboxMap = forwardRef<MapboxMapRef, MapboxMapProps>(
  (
    {
      hazards,
      stagedAnomalies = [],
      h3Segments = [],
      showH3Grid = true,
      showVerifiedHazards = true,
      showStagedPoints = false,
      selectedHazardId,
      onSelectHazard,
      onSelectH3Segment,
      onUpdateHazardStatus,
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const hazardMarkersRef = useRef<{ [id: number]: mapboxgl.Marker }>({});
    const stagedMarkersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});

    const [token, setToken] = useState<string>('');
    const [tokenInput, setTokenInput] = useState<string>('');
    const [currentStyleIndex, setCurrentStyleIndex] = useState<number>(0);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

    // 1. Resolve Mapbox Token
    useEffect(() => {
      const envToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('mapbox_access_token') || '' : '';
      const activeToken = envToken || localToken;
      if (activeToken) {
        setToken(activeToken);
        setTokenInput(activeToken);
      } else {
        setShowTokenModal(true);
      }
    }, []);

    // 2. Helper to build H3 GeoJSON FeatureCollection
    const buildH3GeoJSON = useCallback(
      (): GeoJSON.FeatureCollection => ({
        type: 'FeatureCollection',
        features: h3Segments.map((seg) => ({
          type: 'Feature',
          id: seg.h3_index,
          geometry: {
            type: 'Polygon',
            coordinates: [seg.polygon],
          },
          properties: {
            h3_index: seg.h3_index,
            road_corridor: seg.road_corridor,
            total_potholes: seg.total_potholes,
            total_speed_bumps: seg.total_speed_bumps,
            avg_impact_severity: seg.avg_impact_severity,
            pci: seg.pavement_condition_index,
            rda_action: seg.rda_action,
            action_description: seg.action_description,
            color:
              seg.pavement_condition_index < 45.0
                ? '#ef4444' // Red - Severe decay
                : seg.pavement_condition_index < 75.0
                ? '#f59e0b' // Amber - Deteriorating
                : '#10b981', // Green - Good
          },
        })),
      }),
      [h3Segments]
    );

    // 3. Update H3 GeoJSON Source & Layers on Map
    const syncH3Layers = useCallback(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      const sourceId = 'h3-hex-source';
      const fillLayerId = 'h3-hex-fill';
      const lineLayerId = 'h3-hex-line';

      const data = buildH3GeoJSON();

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data,
        });

        // Fill layer with PCI color mapping
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.65, 0.32],
          },
        });

        // Hexagon cell outline layer
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#4cd7f6',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.2],
            'line-opacity': 0.8,
          },
        });

        // Click on H3 Hexagon
        map.on('click', fillLayerId, (e) => {
          if (e.features && e.features.length > 0) {
            const feat = e.features[0];
            const seg = h3Segments.find((s) => s.h3_index === feat.properties?.h3_index);
            if (seg && onSelectH3Segment) {
              onSelectH3Segment(seg);
            }
          }
        });

        // Hover cursor styling
        map.on('mouseenter', fillLayerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', fillLayerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      // Toggle visibility based on prop
      if (map.getLayer(fillLayerId)) {
        map.setLayoutProperty(fillLayerId, 'visibility', showH3Grid ? 'visible' : 'none');
      }
      if (map.getLayer(lineLayerId)) {
        map.setLayoutProperty(lineLayerId, 'visibility', showH3Grid ? 'visible' : 'none');
      }
    }, [buildH3GeoJSON, h3Segments, onSelectH3Segment, showH3Grid]);

    // 4. Initialize Mapbox Map
    useEffect(() => {
      if (!token || !mapContainerRef.current || mapRef.current) return;

      try {
        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: MAP_STYLES[currentStyleIndex].id,
          center: COLOMBO_DEFAULT_CENTER,
          zoom: 13.5,
          pitch: 45,
          bearing: -12,
          antialias: true,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right');
        map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        map.on('load', () => {
          setIsLoaded(true);
          map.resize();
          syncH3Layers();
        });

        map.on('style.load', () => {
          syncH3Layers();
        });

        mapRef.current = map;

        return () => {
          map.remove();
          mapRef.current = null;
        };
      } catch (err) {
        console.error('Failed to initialize Mapbox map:', err);
      }
    }, [token, currentStyleIndex, syncH3Layers]);

    // Re-sync H3 layers whenever segments or visibility changes
    useEffect(() => {
      if (isLoaded) {
        syncH3Layers();
      }
    }, [isLoaded, syncH3Layers]);

    // 5. Expose Imperative Controls
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (mapRef.current) mapRef.current.zoomIn();
      },
      zoomOut: () => {
        if (mapRef.current) mapRef.current.zoomOut();
      },
      resetLocation: () => {
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: COLOMBO_DEFAULT_CENTER,
            zoom: 13.5,
            pitch: 45,
            bearing: -12,
            duration: 1500,
          });
        }
      },
      toggleStyle: () => {
        const nextIndex = (currentStyleIndex + 1) % MAP_STYLES.length;
        setCurrentStyleIndex(nextIndex);
        if (mapRef.current) {
          mapRef.current.setStyle(MAP_STYLES[nextIndex].id);
        }
      },
      flyToHazard: (hazard: VerifiedHazard) => {
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [hazard.centroid_lng, hazard.centroid_lat],
            zoom: 16.8,
            pitch: 55,
            bearing: 0,
            duration: 1800,
            essential: true,
          });

          const marker = hazardMarkersRef.current[hazard.hazard_id];
          if (marker) {
            const popup = marker.getPopup();
            if (popup) popup.addTo(mapRef.current);
          }
        }
      },
      flyToH3: (segment: H3RoadSegment) => {
        if (mapRef.current && segment.polygon.length > 0) {
          // Average polygon coordinates for centroid
          const avgLng = segment.polygon.reduce((acc, p) => acc + p[0], 0) / segment.polygon.length;
          const avgLat = segment.polygon.reduce((acc, p) => acc + p[1], 0) / segment.polygon.length;
          mapRef.current.flyTo({
            center: [avgLng, avgLat],
            zoom: 15.5,
            pitch: 40,
            duration: 1600,
          });
        }
      },
      getStyleName: () => MAP_STYLES[currentStyleIndex].label,
    }));

    // 6. Render Verified Hazard Centroid Markers (Tier 2)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Clear existing markers
      Object.values(hazardMarkersRef.current).forEach((marker) => marker.remove());
      hazardMarkersRef.current = {};

      if (!showVerifiedHazards) return;

      hazards.forEach((hazard) => {
        const isPothole = hazard.primary_class === 'pothole';
        const isRepaired = hazard.status === 'REPAIRED';

        const colorBg = isRepaired
          ? 'bg-emerald-500 text-surface'
          : isPothole
          ? 'bg-error text-surface glow-red'
          : 'bg-secondary text-surface';

        const pulseRing = isRepaired
          ? 'hidden'
          : isPothole
          ? 'pulse-red bg-error/40'
          : 'bg-secondary/40 animate-pulse';

        // Custom HTML Marker
        const el = document.createElement('div');
        el.className = `custom-mapbox-marker group relative ${selectedHazardId === hazard.hazard_id ? 'scale-125 z-30' : ''}`;

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-2 rounded-full ${pulseRing} blur-xs"></div>
            <div class="w-8 h-8 rounded-full ${colorBg} border-2 border-white/90 shadow-2xl flex items-center justify-center font-bold text-xs">
              <span class="material-symbols-outlined text-sm font-bold">
                ${isRepaired ? 'check_circle' : isPothole ? 'warning' : 'waves'}
              </span>
            </div>
            <!-- Detection Count Badge (DBSCAN cluster size) -->
            <div class="absolute -top-1 -right-1 bg-surface-container-lowest text-primary text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-primary/50 shadow-md">
              ${hazard.detection_count}x
            </div>
            <!-- Tooltip on hover -->
            <div class="absolute bottom-full mb-1 hidden group-hover:block bg-surface-container-high text-on-surface text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap font-medium border border-white/10 z-50">
              #${hazard.hazard_id} ${hazard.road_name} (${hazard.primary_class.toUpperCase()})
            </div>
          </div>
        `;

        // Rich Civil Engineering Telemetry Popup
        const popupContent = document.createElement('div');
        popupContent.className = 'p-1 text-xs';
        popupContent.innerHTML = `
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              isRepaired
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : isPothole
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }">
              ${hazard.status} • ${hazard.primary_class.toUpperCase()}
            </span>
            <span class="text-[10px] font-mono text-cyan-400 font-bold">${hazard.detection_count} Cluster Hits</span>
          </div>

          <h4 class="font-bold text-sm text-cyan-300 mb-1">${hazard.road_name}</h4>

          <div class="grid grid-cols-2 gap-1.5 my-2 p-2 bg-white/5 rounded border border-white/10 font-mono text-[11px]">
            <div>
              <span class="text-gray-400 text-[9px] block uppercase">Peak Az Accel</span>
              <strong class="text-red-400">${hazard.max_peak_az} m/s²</strong>
            </div>
            <div>
              <span class="text-gray-400 text-[9px] block uppercase">Avg Confidence</span>
              <strong class="text-cyan-300">${(hazard.avg_confidence * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <span class="text-gray-400 text-[9px] block uppercase">H3 Res 9 Cell</span>
              <span class="text-gray-300 text-[10px] truncate block">${hazard.h3_index.slice(0, 10)}...</span>
            </div>
            <div>
              <span class="text-gray-400 text-[9px] block uppercase">DBSCAN D_max</span>
              <span class="text-emerald-400">≤ 5.0m Radius</span>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-1 border-t border-gray-700">
            <button id="toggle-status-btn-${hazard.hazard_id}" class="text-[11px] font-bold px-3 py-1.5 rounded transition-all w-full text-center ${
              isRepaired
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
            }">
              ${isRepaired ? 'Re-open Hazard' : 'Mark as Repaired'}
            </button>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 22, closeButton: true, maxWidth: '280px' }).setDOMContent(
          popupContent
        );

        // Attach event listener to status toggle inside popup
        popup.on('open', () => {
          const btn = document.getElementById(`toggle-status-btn-${hazard.hazard_id}`);
          if (btn && onUpdateHazardStatus) {
            btn.onclick = () => {
              const nextStatus = isRepaired ? 'ACTIVE' : 'REPAIRED';
              onUpdateHazardStatus(hazard.hazard_id, nextStatus);
              popup.remove();
            };
          }
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([hazard.centroid_lng, hazard.centroid_lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => {
          if (onSelectHazard) onSelectHazard(hazard);
        });

        hazardMarkersRef.current[hazard.hazard_id] = marker;
      });
    }, [hazards, isLoaded, showVerifiedHazards, selectedHazardId, onSelectHazard, onUpdateHazardStatus]);

    // 7. Render Staged Raw Telemetry Points (Tier 1)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      Object.values(stagedMarkersRef.current).forEach((m) => m.remove());
      stagedMarkersRef.current = {};

      if (!showStagedPoints) return;

      stagedAnomalies.forEach((staged) => {
        const el = document.createElement('div');
        el.className = 'w-3 h-3 rounded-full bg-cyan-400/80 border border-cyan-200 shadow-sm cursor-pointer hover:scale-150 transition-transform';
        el.title = `Staged: ${staged.class_label} | Az: ${staged.peak_az_m_s2}m/s² | ${staged.mounting_config}`;

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([staged.longitude_perturbed, staged.latitude_perturbed])
          .addTo(map);

        stagedMarkersRef.current[staged.uuid] = marker;
      });
    }, [stagedAnomalies, isLoaded, showStagedPoints]);

    // Save token from inline UI
    const handleSaveToken = () => {
      if (!tokenInput.trim()) return;
      const clean = tokenInput.trim();
      localStorage.setItem('mapbox_access_token', clean);
      setToken(clean);
      setShowTokenModal(false);
    };

    return (
      <div className="w-full h-full relative overflow-hidden bg-surface-container-lowest">
        {/* Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Top-Left Style Indicator */}
        {token && (
          <div className="absolute left-6 top-6 z-20 flex items-center gap-2">
            <div className="glass-panel rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-sm">map</span>
              <span>
                Style: <strong className="text-on-surface">{MAP_STYLES[currentStyleIndex].label}</strong>
              </span>
            </div>
            <button
              onClick={() => setShowTokenModal(true)}
              title="Configure Mapbox Token"
              className="glass-panel hover:bg-surface-bright/40 p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-xs flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">key</span>
            </button>
          </div>
        )}

        {/* Token Modal */}
        {(!token || showTokenModal) && (
          <div className="absolute inset-0 z-50 bg-surface/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel border border-primary/30 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">map</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Mapbox Integration</h3>
                  <p className="text-xs text-on-surface-variant">Enter your Mapbox Public Access Token to load vector tiles</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Public Access Token</label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="pk.eyJ1Ijo..."
                  className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-sm rounded-xl px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
                />
                <p className="text-[11px] text-on-surface-variant">
                  Get a free public token at{' '}
                  <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    mapbox.com
                  </a>{' '}
                  or set <code className="text-primary bg-white/5 px-1 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in <code className="text-primary bg-white/5 px-1 py-0.5 rounded">.env.local</code>.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveToken}
                  disabled={!tokenInput.trim()}
                  className="flex-1 bg-primary hover:brightness-110 disabled:opacity-50 text-on-primary font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg glow-cyan"
                >
                  Save &amp; Load Map
                </button>
                {token && (
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="px-4 py-2.5 border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

MapboxMap.displayName = 'MapboxMap';
