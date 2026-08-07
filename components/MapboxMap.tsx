'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';

export interface Incident {
  id: string;
  street: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  type: string;
  time: string;
  color: 'error' | 'secondary' | 'tertiary';
  lng?: number;
  lat?: number;
}

export interface MapboxMapRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetLocation: () => void;
  toggleStyle: () => void;
  flyToIncident: (incident: Incident) => void;
  getStyleName: () => string;
}

interface MapboxMapProps {
  incidents: Incident[];
  selectedIncidentId?: string | null;
  onSelectIncident?: (incident: Incident) => void;
}

// Map styles available
const MAP_STYLES = [
  { id: 'mapbox://styles/mapbox/dark-v11', label: 'Dark Canvas' },
  { id: 'mapbox://styles/mapbox/navigation-night-v1', label: 'Night Nav' },
  { id: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite' },
  { id: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
];

const COLOMBO_DEFAULT_CENTER: [number, number] = [79.855, 6.902];

export const MapboxMap = forwardRef<MapboxMapRef, MapboxMapProps>(
  ({ incidents, selectedIncidentId, onSelectIncident }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});
    
    const [token, setToken] = useState<string>('');
    const [tokenInput, setTokenInput] = useState<string>('');
    const [currentStyleIndex, setCurrentStyleIndex] = useState<number>(0);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

    // 1. Resolve Token on Mount
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

    // 2. Initialize Mapbox Map when token is available
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
          bearing: -15,
          antialias: true,
        });

        // Add navigation & scale controls
        map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right');
        map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        map.on('load', () => {
          setIsLoaded(true);
          map.resize();
        });

        mapRef.current = map;

        return () => {
          map.remove();
          mapRef.current = null;
        };
      } catch (err) {
        console.error('Failed to initialize Mapbox map:', err);
      }
    }, [token]);

    // 3. Handle Style Switcher
    const handleStyleChange = (index: number) => {
      setCurrentStyleIndex(index);
      if (mapRef.current) {
        mapRef.current.setStyle(MAP_STYLES[index].id);
      }
    };

    // 4. Expose map imperative controls via ref
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
            bearing: -15,
            duration: 1500,
          });
        }
      },
      toggleStyle: () => {
        const nextIndex = (currentStyleIndex + 1) % MAP_STYLES.length;
        handleStyleChange(nextIndex);
      },
      flyToIncident: (incident: Incident) => {
        if (mapRef.current && incident.lng && incident.lat) {
          mapRef.current.flyTo({
            center: [incident.lng, incident.lat],
            zoom: 16.5,
            pitch: 55,
            bearing: 0,
            duration: 1800,
            essential: true,
          });

          // Trigger popup open if marker exists
          const marker = markersRef.current[incident.id];
          if (marker) {
            const popup = marker.getPopup();
            if (popup) popup.addTo(mapRef.current);
          }
        }
      },
      getStyleName: () => MAP_STYLES[currentStyleIndex].label,
    }));

    // 5. Update Markers when incidents change
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Clear existing markers
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};

      // Add new markers for incidents
      incidents.forEach((incident) => {
        if (!incident.lng || !incident.lat) return;

        // Custom HTML Marker Element
        const el = document.createElement('div');
        el.className = 'custom-mapbox-marker group relative';

        const colorBg =
          incident.color === 'error'
            ? 'bg-error text-surface glow-red'
            : incident.color === 'secondary'
            ? 'bg-secondary text-surface'
            : 'bg-tertiary text-surface';

        const pulseRing =
          incident.color === 'error'
            ? 'pulse-red bg-error/40'
            : incident.color === 'secondary'
            ? 'bg-secondary/40'
            : 'bg-tertiary/40';

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-2 rounded-full ${pulseRing} blur-xs"></div>
            <div class="w-8 h-8 rounded-full ${colorBg} border-2 border-white/80 shadow-xl flex items-center justify-center font-bold text-xs">
              <span class="material-symbols-outlined text-sm font-bold">
                ${incident.color === 'error' ? 'warning' : incident.color === 'secondary' ? 'error' : 'minor_crash'}
              </span>
            </div>
            <div class="absolute bottom-full mb-1 hidden group-hover:block bg-surface-container-high text-on-surface text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap font-medium border border-white/10">
              ${incident.street}
            </div>
          </div>
        `;

        // Popup Content HTML
        const popupContent = document.createElement('div');
        popupContent.className = 'p-1';
        popupContent.innerHTML = `
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
              incident.color === 'error'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : incident.color === 'secondary'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }">
              ${incident.severity} SEVERITY
            </span>
            <span class="text-[10px] text-gray-400 font-mono">${incident.time}</span>
          </div>
          <h4 class="font-bold text-sm text-cyan-300 mb-1">${incident.street}</h4>
          <p class="text-xs text-gray-300 mb-2 leading-relaxed">${incident.type}</p>
          <div class="flex items-center gap-2 pt-1 border-t border-gray-700">
            <button class="text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold px-2.5 py-1 rounded transition-colors w-full text-center">
              Dispatch Maintenance Crew
            </button>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: true }).setDOMContent(popupContent);

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([incident.lng, incident.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => {
          if (onSelectIncident) onSelectIncident(incident);
        });

        markersRef.current[incident.id] = marker;
      });
    }, [incidents, isLoaded]);

    // Save token from inline UI prompt
    const handleSaveToken = () => {
      if (!tokenInput.trim()) return;
      const cleanToken = tokenInput.trim();
      localStorage.setItem('mapbox_access_token', cleanToken);
      setToken(cleanToken);
      setShowTokenModal(false);
    };

    return (
      <div className="w-full h-full relative overflow-hidden bg-surface-container-lowest">
        {/* Mapbox Canvas Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Top-Left Style Indicator & Selector */}
        {token && (
          <div className="absolute left-6 top-6 z-20 flex items-center gap-2">
            <div className="glass-panel rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-sm">map</span>
              <span>Style: <strong className="text-on-surface">{MAP_STYLES[currentStyleIndex].label}</strong></span>
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

        {/* Token Configuration Modal / Overlay */}
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
                  Get a free public key at{' '}
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
