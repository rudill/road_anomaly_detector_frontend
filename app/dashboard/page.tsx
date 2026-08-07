'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { MapboxMapRef, Incident } from '@/components/MapboxMap';

const MapboxMap = dynamic(
  () => import('@/components/MapboxMap').then((mod) => mod.MapboxMap),
  { ssr: false }
);

const initialIncidents: Incident[] = [
  {
    id: '1',
    street: 'Galle Rd - Crossing 4',
    severity: 'HIGH',
    type: 'Cluster of 3 potholes detected via mobile sensor-104.',
    time: '14:02:44',
    color: 'error',
    lng: 79.8510,
    lat: 6.8912,
  },
  {
    id: '2',
    street: 'Marine Drive - Sector B',
    severity: 'MED',
    type: 'Minor vertical displacement detected. Baseline shift noted.',
    time: '13:58:12',
    color: 'secondary',
    lng: 79.8530,
    lat: 6.8985,
  },
  {
    id: '3',
    street: 'Kollupitiya Junction',
    severity: 'LOW',
    type: 'Surface friction anomaly detected. Likely debris.',
    time: '13:45:00',
    color: 'tertiary',
    lng: 79.8518,
    lat: 6.9050,
  },
];

const samplePool = [
  { street: 'Duplication Rd', severity: 'HIGH' as const, type: 'Severe Depression detected via smart-cam probe.', color: 'error' as const, lng: 79.8560, lat: 6.8990 },
  { street: 'Havelock Rd', severity: 'LOW' as const, type: 'Surface Crack identified.', color: 'tertiary' as const, lng: 79.8630, lat: 6.8850 },
  { street: 'Baseline Rd - Sector C', severity: 'MED' as const, type: 'Edge break & pothole risk detected.', color: 'secondary' as const, lng: 79.8760, lat: 6.9120 },
  { street: 'High Level Rd', severity: 'HIGH' as const, type: 'Deep rutting detected by fleet collector #08.', color: 'error' as const, lng: 79.8780, lat: 6.8820 },
];

export default function DashboardPage() {
  const mapRef = useRef<MapboxMapRef>(null);
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        const randomItem = samplePool[Math.floor(Math.random() * samplePool.length)];
        // Slightly randomize coordinate offset to simulate real-time GPS detection
        const offsetLng = (Math.random() - 0.5) * 0.004;
        const offsetLat = (Math.random() - 0.5) * 0.004;

        const newIncident: Incident = {
          id: Date.now().toString(),
          street: randomItem.street,
          severity: randomItem.severity,
          type: randomItem.type,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          color: randomItem.color,
          lng: randomItem.lng + offsetLng,
          lat: randomItem.lat + offsetLat,
        };

        setIncidents((prev) => [newIncident, ...prev.slice(0, 7)]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleFlyTo = (incident: Incident) => {
    setSelectedIncident(incident);
    mapRef.current?.flyToIncident(incident);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans selection:bg-primary/30">
      {/* SIDE NAVIGATION SHELL */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low/65 backdrop-blur-xl border-r border-outline-variant flex flex-col z-50">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary tracking-tight">Command Center</h1>
          <p className="text-on-surface-variant text-xs opacity-70">Road Maintenance Ops</p>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {/* Active Tab: Map View */}
          <div className="text-primary border-l-4 border-primary bg-primary-container/10 px-4 py-3 flex items-center gap-3 transition-all duration-200 active:scale-95 cursor-pointer">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              map
            </span>
            <span className="text-sm font-medium">Map View</span>
          </div>
          <div className="text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/20 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer active:scale-95">
            <span className="material-symbols-outlined">database</span>
            <span className="text-sm font-medium">Asset Inventory</span>
          </div>
          <div className="text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/20 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer active:scale-95">
            <span className="material-symbols-outlined">build</span>
            <span className="text-sm font-medium">Maintenance Logs</span>
          </div>
          <div className="text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/20 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer active:scale-95">
            <span className="material-symbols-outlined">local_shipping</span>
            <span className="text-sm font-medium">Fleet Tracking</span>
          </div>
          <div className="text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/20 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer active:scale-95">
            <span className="material-symbols-outlined">analytics</span>
            <span className="text-sm font-medium">Spatial Analytics</span>
          </div>
          <div className="text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/20 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer active:scale-95">
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm font-medium">System Config</span>
          </div>
        </nav>

        <div className="p-4 mt-auto border-t border-outline-variant/30">
          <button className="w-full bg-error-container text-white py-3 rounded flex items-center justify-center gap-2 font-bold transition-transform active:scale-95">
            <span className="material-symbols-outlined text-sm">warning</span>
            Critical Alert
          </button>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors">
              <span className="material-symbols-outlined text-lg">help</span> Help
            </div>
            <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors">
              <span className="material-symbols-outlined text-lg">logout</span> Logout
            </div>
          </div>
        </div>
      </aside>

      {/* TOP NAVIGATION SHELL */}
      <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-surface/80 backdrop-blur-lg border-b border-outline-variant flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <input
              className="bg-surface-container-lowest border-outline border text-on-surface text-sm rounded-full px-10 py-1.5 w-64 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
              placeholder="Search infrastructure assets..."
              type="text"
            />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
              search
            </span>
          </div>
          <nav className="hidden lg:flex items-center gap-6">
            <a className="text-primary font-bold border-b-2 border-primary pb-1 text-sm" href="#">
              Network Health
            </a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">
              Incident Reports
            </a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">
              Scheduled Tasks
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-primary text-on-primary px-4 py-1.5 rounded-full font-bold text-sm hover:brightness-110 active:opacity-80 transition-all">
            Emergency Dispatch
          </button>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined cursor-pointer hover:text-primary active:opacity-80 transition-colors">
              notifications
            </span>
            <span className="material-symbols-outlined cursor-pointer hover:text-primary active:opacity-80 transition-colors">
              share_location
            </span>
            <span className="material-symbols-outlined cursor-pointer hover:text-primary active:opacity-80 transition-colors">
              account_circle
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className="ml-64 pt-16 h-screen relative overflow-hidden flex flex-col">
        {/* KPI TOP BAR */}
        <section className="grid grid-cols-4 gap-4 p-4 z-10 bg-gradient-to-b from-surface to-transparent">
          {/* Potholes */}
          <div className="glass-panel p-4 rounded-xl flex items-center gap-4 group hover:border-error transition-all">
            <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-2xl font-bold">report_problem</span>
            </div>
            <div>
              <div className="text-error font-mono text-2xl font-bold">142</div>
              <div className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold">Critical Potholes</div>
            </div>
            <div className="ml-auto w-1 h-8 bg-error rounded-full opacity-40"></div>
          </div>

          {/* Bumps */}
          <div className="glass-panel p-4 rounded-xl flex items-center gap-4 group hover:border-secondary transition-all">
            <div className="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-2xl">error</span>
            </div>
            <div>
              <div className="text-secondary font-mono text-2xl font-bold">45</div>
              <div className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold">Major Bumps</div>
            </div>
            <div className="ml-auto w-1 h-8 bg-secondary rounded-full opacity-40"></div>
          </div>

          {/* Health Index */}
          <div className="glass-panel p-4 rounded-xl flex items-center gap-4 group hover:border-tertiary transition-all">
            <div className="w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-2xl">health_and_safety</span>
            </div>
            <div>
              <div className="text-tertiary font-mono text-2xl font-bold">82%</div>
              <div className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold">Road Health Index</div>
            </div>
            <div className="ml-auto w-1 h-8 bg-tertiary rounded-full opacity-40"></div>
          </div>

          {/* Active Collectors */}
          <div className="glass-panel p-4 rounded-xl flex items-center gap-4 group hover:border-primary transition-all">
            <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">wifi_tethering</span>
            </div>
            <div>
              <div className="text-primary font-mono text-2xl font-bold">14</div>
              <div className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold">Active Collectors</div>
            </div>
            <div className="ml-auto w-1 h-8 bg-primary rounded-full opacity-40"></div>
          </div>
        </section>

        {/* MAP CONTAINER */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-surface-container-lowest">
            <MapboxMap
              ref={mapRef}
              incidents={incidents}
              selectedIncidentId={selectedIncident?.id}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
            />
          </div>

          {/* LEFT SIDEBAR: LIVE FEED */}
          <div className="absolute left-4 top-4 bottom-4 w-80 glass-panel rounded-2xl flex flex-col z-20 shadow-2xl overflow-hidden border border-white/5">
            <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">sensors</span>
                Real-time Feed
              </h3>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse">
                Live
              </span>
            </div>

            <div className="flex-1 overflow-y-auto scroll-hide p-3 space-y-3" id="anomaly-feed">
              {incidents.map((incident) => {
                const borderClass =
                  incident.color === 'error'
                    ? 'border-error'
                    : incident.color === 'secondary'
                      ? 'border-secondary'
                      : 'border-tertiary';

                const badgeBg =
                  incident.color === 'error'
                    ? 'bg-error-container/20 text-error'
                    : incident.color === 'secondary'
                      ? 'bg-secondary-container/20 text-secondary'
                      : 'bg-tertiary-container/20 text-tertiary';

                return (
                  <div
                    key={incident.id}
                    className={`p-3 bg-white/5 rounded-lg border-l-4 ${borderClass} hover:bg-white/10 transition-all duration-300 transform translate-y-0 opacity-100 ${selectedIncident?.id === incident.id ? 'ring-1 ring-primary bg-primary/10' : ''
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`${badgeBg} text-[10px] px-1.5 py-0.5 rounded font-bold uppercase`}>
                        {incident.severity} Severity
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono">{incident.time}</span>
                    </div>
                    <div className="text-sm font-bold text-on-surface mb-1">{incident.street}</div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{incident.type}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => handleFlyTo(incident)}
                        className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        View on Map
                      </button>
                      <span className="text-[10px] text-outline">•</span>
                      <button className="text-[10px] text-primary hover:underline">Assign Crew</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-surface-container-high/50 border-t border-outline-variant/30 text-center">
              <button className="text-xs text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1 w-full py-1">
                View All History <span className="material-symbols-outlined text-sm">keyboard_arrow_right</span>
              </button>
            </div>
          </div>

          {/* BOTTOM RIGHT: GEMINI AI PANEL */}
          {/* <div className="absolute right-6 bottom-6 w-96 glass-panel rounded-2xl shadow-2xl z-20 border-l-2 border-primary overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shadow-lg glow-cyan">
                <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <div>
                <h4 className="font-bold text-primary text-sm flex items-center gap-2">Gemini AI Insight</h4>
                <p className="text-[10px] text-on-surface-variant">Real-time Predictive Analytics</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-surface/50 rounded-lg p-3 border border-outline-variant/20">
                <div className="text-xs font-bold text-on-surface mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                  Optimization Insight
                </div>
                <p className="text-[13px] text-on-surface-variant leading-relaxed italic">
                  &quot;Based on the 142 detected anomalies on Galle Rd, repair costs can be reduced by 18% if consolidated into a single maintenance window tonight (22:00 - 04:00).&quot;
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button className="w-full bg-primary-container text-on-primary-container font-bold py-2.5 rounded flex items-center justify-center gap-2 text-sm hover:brightness-105 transition-all shadow-lg glow-cyan active:scale-[0.98]">
                  <span className="material-symbols-outlined text-sm">edit_document</span>
                  Generate RDA Repair Mandate
                </button>
                <button className="w-full border border-primary/40 text-primary font-bold py-2.5 rounded flex items-center justify-center gap-2 text-sm hover:bg-primary/5 transition-all active:scale-[0.98]">
                  <span className="material-symbols-outlined text-sm">shield</span>
                  Fleet Risk Summary
                </button>
              </div>
            </div>
          </div> */}

          {/* MAP CONTROLS */}
          <div className="absolute right-6 top-6 flex flex-col gap-2 z-20">
            <div className="glass-panel p-2 rounded-lg flex flex-col gap-3">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                title="Zoom In"
                className="text-on-surface-variant hover:text-primary transition-colors active:scale-90"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
              <div className="w-full h-px bg-outline-variant/30"></div>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                title="Zoom Out"
                className="text-on-surface-variant hover:text-primary transition-colors active:scale-90"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
            </div>
            <div className="glass-panel p-2 rounded-lg">
              <button
                onClick={() => mapRef.current?.resetLocation()}
                title="Reset View"
                className="text-on-surface-variant hover:text-primary transition-colors active:scale-90"
              >
                <span className="material-symbols-outlined">my_location</span>
              </button>
            </div>
            <div className="glass-panel p-2 rounded-lg">
              <button
                onClick={() => mapRef.current?.toggleStyle()}
                title="Switch Map Style"
                className="text-on-surface-variant hover:text-primary transition-colors active:scale-90"
              >
                <span className="material-symbols-outlined">layers</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
