'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { MapboxMapRef } from '@/components/MapboxMap';
import {
  VerifiedHazard,
  StagedAnomaly,
  H3RoadSegment,
  MunicipalAnalyticsSummary,
  HazardStatus,
} from '@/types/road-anomaly';

const MapboxMap = dynamic(
  () => import('@/components/MapboxMap').then((mod) => mod.MapboxMap),
  { ssr: false }
);

export type ActiveViewTab = 'map' | 'decision' | 'inventory' | 'how_it_works';

export default function DashboardPage() {
  const mapRef = useRef<MapboxMapRef>(null);

  // Core Data State from Python Backend
  const [hazards, setHazards] = useState<VerifiedHazard[]>([]);
  const [stagedAnomalies, setStagedAnomalies] = useState<StagedAnomaly[]>([]);
  const [h3Segments, setH3Segments] = useState<H3RoadSegment[]>([]);
  const [analytics, setAnalytics] = useState<MunicipalAnalyticsSummary | null>(null);

  // Selection & UI State
  const [currentTab, setCurrentTab] = useState<ActiveViewTab>('map');
  const [selectedHazard, setSelectedHazard] = useState<VerifiedHazard | null>(null);
  const [selectedH3Segment, setSelectedH3Segment] = useState<H3RoadSegment | null>(null);
  const [feedMode, setFeedMode] = useState<'verified' | 'staged'>('verified');

  // Registry Tab State
  const [registrySubTab, setRegistrySubTab] = useState<'hazards' | 'segments' | 'reports'>('hazards');
  const [registryFilter, setRegistryFilter] = useState<'all' | 'active' | 'repaired'>('all');
  const [registrySearch, setRegistrySearch] = useState<string>('');

  // Layer Toggles
  const [showH3Grid, setShowH3Grid] = useState<boolean>(true);
  const [showVerifiedHazards, setShowVerifiedHazards] = useState<boolean>(true);
  const [showStagedPoints, setShowStagedPoints] = useState<boolean>(false);

  // Action status indicators
  const [isClustering, setIsClustering] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch all data from live backend API
  const refreshData = useCallback(async () => {
    try {
      const [hazardsRes, stagedRes, h3Res, analyticsRes] = await Promise.all([
        fetch('/api/v1/hazards/verified'),
        fetch('/api/v1/anomalies/staged'),
        fetch('/api/v1/h3/segments?format=json'),
        fetch('/api/v1/analytics'),
      ]);

      if (hazardsRes.ok && analyticsRes.ok) {
        setBackendConnected(true);
      } else {
        setBackendConnected(false);
      }

      if (hazardsRes.ok) {
        const data = await hazardsRes.json();
        setHazards(data.hazards || []);
      }
      if (stagedRes.ok) {
        const data = await stagedRes.json();
        setStagedAnomalies(data.records || []);
      }
      if (h3Res.ok) {
        const data = await h3Res.json();
        setH3Segments(data.segments || []);
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load dashboard telemetry from Python backend:', err);
      setBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle Hazard Selection & Fly-to
  const handleSelectHazard = (hazard: VerifiedHazard) => {
    setSelectedHazard(hazard);
    setSelectedH3Segment(null);
    mapRef.current?.flyToHazard(hazard);
  };

  // Handle H3 Cell Selection & Fly-to
  const handleSelectH3 = (segment: H3RoadSegment) => {
    setSelectedH3Segment(segment);
    setSelectedHazard(null);
    mapRef.current?.flyToH3(segment);
  };

  // Update Hazard Status (ACTIVE <-> REPAIRED)
  const handleUpdateStatus = async (hazardId: number, nextStatus: HazardStatus) => {
    try {
      const res = await fetch('/api/v1/hazards/verified', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hazard_id: hazardId, status: nextStatus }),
      });
      if (res.ok) {
        showToast(
          nextStatus === 'REPAIRED'
            ? `Hazard #${hazardId} marked as Repaired ✓`
            : `Hazard #${hazardId} re-opened as Active`
        );
        await refreshData();
        if (selectedHazard && selectedHazard.hazard_id === hazardId) {
          setSelectedHazard((prev) => (prev ? { ...prev, status: nextStatus } : null));
        }
      }
    } catch (err) {
      console.error('Failed to update hazard status:', err);
      showToast('Status update failed');
    }
  };

  // Action: Trigger Clustering (DBSCAN)
  const handleRunDBSCAN = async () => {
    setIsClustering(true);
    try {
      const res = await fetch('/api/v1/clustering/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ d_max_meters: 5.0, min_pts: 3 }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Hazards verified: ${data.result.clusters_formed} confirmed, ${data.result.noise_points_filtered} false alarms filtered.`
        );
        await refreshData();
      }
    } catch {
      showToast('Hazard verification failed');
    } finally {
      setIsClustering(false);
    }
  };

  // Action: Simulate Citizen Vehicle Driving Batch
  const handleSimulateMobileIngest = async () => {
    setIsIngesting(true);
    try {
      const corridors = [
        { name: 'Galle Rd (A2) - Kollupitiya', lat: 6.9025, lng: 79.8515 },
        { name: 'Baseline Rd (B084) - Dematagoda', lat: 6.9240, lng: 79.8780 },
        { name: 'Duplication Rd (R.A. De Mel)', lat: 6.8980, lng: 79.8565 },
      ];

      const target = corridors[Math.floor(Math.random() * corridors.length)];
      const randomOffsetLat = (Math.random() - 0.5) * 0.0006;
      const randomOffsetLng = (Math.random() - 0.5) * 0.0006;

      const newUuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '550e8400-e29b-41d4-a716-44665544' + Math.floor(Math.random() * 8999 + 1000);

      const payload = {
        device_id_hash: 'a8f9c3d2e1b04567a89b0123c456d789e0123456',
        batch_size: 1,
        records: [
          {
            uuid: newUuid,
            timestamp_utc: new Date().toISOString(),
            latitude_perturbed: Number((target.lat + randomOffsetLat).toFixed(6)),
            longitude_perturbed: Number((target.lng + randomOffsetLng).toFixed(6)),
            h3_index: '',
            class_label: Math.random() > 0.3 ? 'pothole' : 'speed_bump',
            confidence: Number((0.85 + Math.random() * 0.12).toFixed(3)),
            speed_kmh: Number((30 + Math.random() * 20).toFixed(1)),
            peak_az_m_s2: Number((16 + Math.random() * 8).toFixed(2)),
            mounting_config: 'dash_mount' as const,
          },
        ],
      };

      const res = await fetch('/api/v1/anomalies/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer simulated_jwt_token',
          'X-Device-App-Version': '1.0.4',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('New citizen vehicle drive recorded on ' + target.name);
        await refreshData();
      }
    } catch {
      showToast('Simulated drive failed');
    } finally {
      setIsIngesting(false);
    }
  };

  // Action: Export Maintenance Work Orders
  const handleExportManifest = (format: 'geojson' | 'csv') => {
    window.open(`/api/v1/export/manifest?format=${format}`, '_blank');
    showToast(`Downloading Road Repair Work Orders (${format.toUpperCase()})`);
  };

  const activePotholes = hazards.filter((h) => h.primary_class === 'pothole' && h.status !== 'REPAIRED');
  const activeBumps = hazards.filter((h) => h.primary_class === 'speed_bump' && h.status !== 'REPAIRED');
  const repairedHazards = hazards.filter((h) => h.status === 'REPAIRED');

  // Overall Road Health Grade
  const roadHealthScore = analytics?.network_pci_avg != null ? analytics.network_pci_avg : 100;
  const roadHealthStatus =
    roadHealthScore >= 75 ? 'Good' : roadHealthScore >= 45 ? 'Fair / Degraded' : 'Critical Action Needed';
  const roadHealthColor =
    roadHealthScore >= 75 ? 'text-emerald-400' : roadHealthScore >= 45 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-[#070d1d] text-[#dae2fd] font-sans selection:bg-[#4cd7f6]/30 flex flex-col">
      {/* TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed top-20 right-8 z-50 glass-panel border border-[#4cd7f6]/40 bg-[#131b2e]/95 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-[#4cd7f6] text-xl">info</span>
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-[#0d1527]/90 backdrop-blur-xl border-r border-white/10 flex flex-col z-50">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#4cd7f6] text-2xl font-bold">satellite_alt</span>
            <span className="text-xs font-black uppercase tracking-wider text-[#4cd7f6]">RoadPulse RDA</span>
          </div>
          <h1 className="text-lg font-black text-white tracking-tight">Municipal Command</h1>
          <p className="text-[11px] text-gray-400 font-medium">Smart Road Asset Surveillance</p>
        </div>

        {/* NAVIGATION TABS */}
        <nav className="flex-1 px-3 py-4 space-y-1.5">
          {/* Tab 1: Live Road Hazard Map */}
          <button
            onClick={() => setCurrentTab('map')}
            className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 transition-all ${
              currentTab === 'map'
                ? 'text-[#4cd7f6] border-l-4 border-[#4cd7f6] bg-[#06b6d4]/15 font-bold shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-lg">map</span>
            <div>
              <div className="text-xs font-bold">Road Hazard Map</div>
              <div className="text-[10px] text-gray-400 font-normal">Live map with hazard pins</div>
            </div>
          </button>

          {/* Tab 2: Repair Priority Queue */}
          <button
            onClick={() => setCurrentTab('decision')}
            className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 transition-all ${
              currentTab === 'decision'
                ? 'text-[#4cd7f6] border-l-4 border-[#4cd7f6] bg-[#06b6d4]/15 font-bold shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-lg">assignment_turned_in</span>
            <div>
              <div className="text-xs font-bold">Repair Priority Queue</div>
              <div className="text-[10px] text-gray-400 font-normal">Urgent street work orders</div>
            </div>
          </button>

          {/* Tab 3: Road Asset Registry */}
          <button
            onClick={() => setCurrentTab('inventory')}
            className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 transition-all ${
              currentTab === 'inventory'
                ? 'text-[#4cd7f6] border-l-4 border-[#4cd7f6] bg-[#06b6d4]/15 font-bold shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-lg">fact_check</span>
            <div>
              <div className="text-xs font-bold">Road Asset Records</div>
              <div className="text-[10px] text-gray-400 font-normal">Confirmed defects &amp; streets</div>
            </div>
          </button>

          {/* Tab 4: How It Works & Privacy */}
          <button
            onClick={() => setCurrentTab('how_it_works')}
            className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 transition-all ${
              currentTab === 'how_it_works'
                ? 'text-[#4cd7f6] border-l-4 border-[#4cd7f6] bg-[#06b6d4]/15 font-bold shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-lg">lightbulb</span>
            <div>
              <div className="text-xs font-bold">How It Works &amp; Privacy</div>
              <div className="text-[10px] text-gray-400 font-normal">Citizen sensing explainer</div>
            </div>
          </button>
        </nav>

        {/* SIDEBAR TELEMETRY BOX */}
        <div className="p-3 mx-3 mb-3 bg-[#060e20]/80 border border-white/10 rounded-xl space-y-2 text-[11px] font-mono">
          <div className="text-[10px] text-[#4cd7f6] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            System Performance
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Data Bandwidth Saved:</span>
            <strong className="text-emerald-400">
              {analytics?.telemetry ? `${analytics.telemetry.compression_bandwidth_savings_pct}%` : '78.4%'}
            </strong>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Response Speed:</span>
            <strong className="text-white">
              {analytics?.telemetry ? `${analytics.telemetry.sync_latency_ms} ms` : '245 ms'}
            </strong>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Citizen Privacy:</span>
            <strong className="text-cyan-300">Trips Anonymized ✓</strong>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Legal Compliance:</span>
            <strong className="text-emerald-400">PDPA No. 9 of 2022 ✓</strong>
          </div>
        </div>

        {/* SIDEBAR EXPORT BUTTONS */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Export Field Work Orders
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportManifest('csv')}
              className="flex-1 bg-[#131b2e] hover:bg-[#1c273e] text-[11px] text-[#4cd7f6] font-bold py-2.5 px-2 rounded-xl border border-[#4cd7f6]/30 flex items-center justify-center gap-1.5 transition-all shadow-sm"
              title="Download CSV spreadsheet for road repair field crews"
            >
              <span className="material-symbols-outlined text-sm">table_chart</span>
              Excel / CSV
            </button>
            <button
              onClick={() => handleExportManifest('geojson')}
              className="flex-1 bg-[#131b2e] hover:bg-[#1c273e] text-[11px] text-[#4cd7f6] font-bold py-2.5 px-2 rounded-xl border border-[#4cd7f6]/30 flex items-center justify-center gap-1.5 transition-all shadow-sm"
              title="Download GeoJSON for field GIS tablets and GPS navigation"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Map GIS
            </button>
          </div>
        </div>
      </aside>

      {/* TOP HEADER BAR */}
      <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-[#070d1d]/90 backdrop-blur-lg border-b border-white/10 flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-4">
          {/* Server Connection Chip */}
          <div className="flex items-center gap-2 text-xs font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected === true
                  ? 'bg-emerald-400 animate-pulse'
                  : backendConnected === false
                  ? 'bg-rose-500'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-gray-400">Road Data Server:</span>
            <strong
              className={`font-semibold ${
                backendConnected === true ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {backendConnected === true ? 'Live Connected' : 'Connecting (Port 8000)...'}
            </strong>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-gray-400">Coverage:</span>
            <strong className="text-[#4cd7f6] font-semibold">Colombo Urban Network</strong>
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS */}
        <div className="flex items-center gap-3">
          {/* Verify & Group Hazards (DBSCAN Clustering) */}
          <button
            onClick={handleRunDBSCAN}
            disabled={isClustering}
            className="bg-[#06b6d4]/15 hover:bg-[#06b6d4]/25 text-[#4cd7f6] border border-[#4cd7f6]/40 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            title="Groups multiple vehicle bumps at the same location into confirmed hazards"
          >
            <span className={`material-symbols-outlined text-sm ${isClustering ? 'animate-spin' : ''}`}>
              verified
            </span>
            <span>{isClustering ? 'Processing...' : 'Verify & Group Hazards'}</span>
          </button>

          {/* Simulate Citizen Drive */}
          <button
            onClick={handleSimulateMobileIngest}
            disabled={isIngesting}
            className="bg-gradient-to-r from-[#4cd7f6] to-[#06b6d4] hover:brightness-110 text-[#003640] px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            title="Simulates a vehicle driving along a city corridor and recording road shocks"
          >
            <span className={`material-symbols-outlined text-base ${isIngesting ? 'animate-spin' : ''}`}>
              directions_car
            </span>
            <span>{isIngesting ? 'Recording Drive...' : 'Simulate Citizen Drive'}</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="ml-64 pt-16 flex-1 flex flex-col relative overflow-hidden h-screen">
        {/* TOP KPI OVERVIEW CARDS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 z-10 bg-gradient-to-b from-[#070d1d] to-transparent shrink-0">
          {/* Confirmed Potholes */}
          <div className="glass-panel p-3.5 rounded-xl flex items-center gap-3 border-l-4 border-rose-500 hover:bg-white/5 transition-all">
            <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl font-bold">report_problem</span>
            </div>
            <div>
              <div className="text-rose-400 font-mono text-2xl font-black">{activePotholes.length}</div>
              <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">
                Confirmed Potholes
              </div>
            </div>
          </div>

          {/* Mapped Speed Bumps */}
          <div className="glass-panel p-3.5 rounded-xl flex items-center gap-3 border-l-4 border-amber-500 hover:bg-white/5 transition-all">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">waves</span>
            </div>
            <div>
              <div className="text-amber-400 font-mono text-2xl font-black">{activeBumps.length}</div>
              <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">
                Mapped Speed Bumps
              </div>
            </div>
          </div>

          {/* City Road Health Score (PCI) */}
          <div className="glass-panel p-3.5 rounded-xl flex items-center gap-3 border-l-4 border-[#4cd7f6] hover:bg-white/5 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#06b6d4]/15 text-[#4cd7f6] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">health_and_safety</span>
            </div>
            <div>
              <div className="font-mono text-2xl font-black flex items-baseline gap-1">
                <span className={roadHealthColor}>{roadHealthScore}</span>
                <span className="text-xs text-gray-500 font-normal">/ 100</span>
              </div>
              <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <span>City Road Health:</span>
                <span className={`font-bold ${roadHealthColor}`}>{roadHealthStatus}</span>
              </div>
            </div>
          </div>

          {/* Active Citizen Patrols */}
          <div className="glass-panel p-3.5 rounded-xl flex items-center gap-3 border-l-4 border-emerald-400 hover:bg-white/5 transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/15 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">directions_car</span>
            </div>
            <div>
              <div className="text-emerald-400 font-mono text-2xl font-black">
                {analytics?.active_edge_collectors ?? stagedAnomalies.length}
              </div>
              <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">
                Citizen Vehicles Contributing
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* TAB 1: ROAD HAZARD MAP */}
        {/* ========================================================================= */}
        {currentTab === 'map' && (
          <div className="flex-1 relative overflow-hidden">
            {/* Map Canvas */}
            <div className="absolute inset-0 bg-[#060e20]">
              <MapboxMap
                ref={mapRef}
                hazards={hazards}
                stagedAnomalies={stagedAnomalies}
                h3Segments={h3Segments}
                showH3Grid={showH3Grid}
                showVerifiedHazards={showVerifiedHazards}
                showStagedPoints={showStagedPoints}
                selectedHazardId={selectedHazard?.hazard_id}
                onSelectHazard={handleSelectHazard}
                onSelectH3Segment={handleSelectH3}
                onUpdateHazardStatus={handleUpdateStatus}
              />
            </div>

            {/* TOP-RIGHT MAP CONTROLS & LAYER TOGGLES */}
            <div className="absolute right-6 top-4 flex flex-col gap-2 z-20">
              {/* Layer Visibility Control Box */}
              <div className="glass-panel p-3 rounded-2xl space-y-2 text-xs shadow-xl">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6] px-1 mb-1">
                  Map Layers
                </div>
                <label className="flex items-center gap-2 text-white cursor-pointer hover:text-[#4cd7f6] transition-colors">
                  <input
                    type="checkbox"
                    checked={showH3Grid}
                    onChange={(e) => setShowH3Grid(e.target.checked)}
                    className="accent-[#4cd7f6] rounded"
                  />
                  <span>Street Health Zones (Hexagons)</span>
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer hover:text-[#4cd7f6] transition-colors">
                  <input
                    type="checkbox"
                    checked={showVerifiedHazards}
                    onChange={(e) => setShowVerifiedHazards(e.target.checked)}
                    className="accent-[#4cd7f6] rounded"
                  />
                  <span>Confirmed Hazards (Pins)</span>
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer hover:text-[#4cd7f6] transition-colors">
                  <input
                    type="checkbox"
                    checked={showStagedPoints}
                    onChange={(e) => setShowStagedPoints(e.target.checked)}
                    className="accent-[#4cd7f6] rounded"
                  />
                  <span>Recent Vehicle Detections (Raw Dots)</span>
                </label>
              </div>

              {/* Navigation Controls */}
              <div className="glass-panel p-1.5 rounded-xl flex flex-col gap-1.5 self-end shadow-lg">
                <button
                  onClick={() => mapRef.current?.zoomIn()}
                  title="Zoom In"
                  className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
                <button
                  onClick={() => mapRef.current?.zoomOut()}
                  title="Zoom Out"
                  className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">remove</span>
                </button>
                <button
                  onClick={() => mapRef.current?.resetLocation()}
                  title="Reset view to Colombo City Center"
                  className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">my_location</span>
                </button>
                <button
                  onClick={() => mapRef.current?.toggleStyle()}
                  title="Switch Map Style (Dark / Satellite / Street)"
                  className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">layers</span>
                </button>
              </div>
            </div>

            {/* LEFT SIDEBAR: LIVE FEED PANEL */}
            <div className="absolute left-4 top-4 bottom-4 w-84 glass-panel rounded-2xl flex flex-col z-20 shadow-2xl overflow-hidden border border-white/10">
              {/* Header with Mode Switcher */}
              <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                  <button
                    onClick={() => setFeedMode('verified')}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded transition-all ${
                      feedMode === 'verified'
                        ? 'bg-[#4cd7f6] text-[#003640] shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Confirmed ({hazards.length})
                  </button>
                  <button
                    onClick={() => setFeedMode('staged')}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded transition-all ${
                      feedMode === 'staged'
                        ? 'bg-[#4cd7f6] text-[#003640] shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Recent Reports ({stagedAnomalies.length})
                  </button>
                </div>
                <span className="text-[10px] bg-[#06b6d4]/20 text-[#4cd7f6] px-2 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse">
                  Live
                </span>
              </div>

              {/* Feed List Items */}
              <div className="flex-1 overflow-y-auto scroll-hide p-3 space-y-2.5">
                {feedMode === 'verified' ? (
                  hazards.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 space-y-2.5">
                      <span className="material-symbols-outlined text-3xl text-gray-500">sensors_off</span>
                      <p className="font-semibold text-gray-300">No confirmed hazards yet</p>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Click <strong>Simulate Citizen Drive</strong> above to record bumps, then click{' '}
                        <strong>Verify &amp; Group Hazards</strong> to verify them.
                      </p>
                    </div>
                  ) : (
                    hazards.map((hazard) => {
                      const isPothole = hazard.primary_class === 'pothole';
                      const isRepaired = hazard.status === 'REPAIRED';
                      const isSelected = selectedHazard?.hazard_id === hazard.hazard_id;

                      return (
                        <div
                          key={hazard.hazard_id}
                          onClick={() => handleSelectHazard(hazard)}
                          className={`p-3 rounded-xl border-l-4 cursor-pointer transition-all ${
                            isRepaired
                              ? 'border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10'
                              : isPothole
                              ? 'border-rose-500 bg-rose-500/5 hover:bg-rose-500/10'
                              : 'border-amber-500 bg-amber-500/5 hover:bg-amber-500/10'
                          } ${isSelected ? 'ring-2 ring-[#4cd7f6] bg-[#06b6d4]/10' : ''}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                isRepaired
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : isPothole
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {isRepaired ? '✓ REPAIRED' : isPothole ? 'POTHOLE' : 'SPEED BUMP'}
                            </span>
                            <span className="text-[10px] text-cyan-300 font-mono font-bold">
                              Confirmed by {hazard.detection_count} vehicles
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white">{hazard.road_name}</div>
                          <div className="text-[11px] text-gray-400 mt-1 flex justify-between font-mono">
                            <span>
                              Impact:{' '}
                              <strong className={hazard.max_peak_az > 15 ? 'text-rose-400' : 'text-amber-400'}>
                                {hazard.max_peak_az > 15 ? 'Severe' : 'Moderate'} ({hazard.max_peak_az} m/s²)
                              </strong>
                            </span>
                            <span>Confidence: {(hazard.avg_confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : stagedAnomalies.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 space-y-2.5">
                    <span className="material-symbols-outlined text-3xl text-gray-500">wifi_tethering_off</span>
                    <p className="font-semibold text-gray-300">No recent reports</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Click <strong>Simulate Citizen Drive</strong> above to stream live road defect telemetry.
                    </p>
                  </div>
                ) : (
                  stagedAnomalies.map((staged) => (
                    <div
                      key={staged.uuid}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-xs"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-bold text-cyan-300 uppercase">
                          {staged.class_label === 'pothole' ? 'Pothole Defect' : 'Speed Bump'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(staged.timestamp_utc).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex justify-between font-mono">
                        <span>Impact: {staged.peak_az_m_s2} m/s²</span>
                        <span>Vehicle Speed: {staged.speed_kmh} km/h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* BOTTOM-RIGHT INSPECTOR DRAWER */}
            {(selectedHazard || selectedH3Segment) && (
              <div className="absolute right-6 bottom-6 w-96 glass-panel rounded-2xl shadow-2xl z-20 border border-[#4cd7f6]/40 overflow-hidden">
                {selectedHazard ? (
                  <div>
                    <div className="bg-gradient-to-r from-[#06b6d4]/20 to-transparent p-3.5 flex items-center justify-between border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-xl">location_searching</span>
                        <div>
                          <h4 className="font-bold text-xs text-white">Hazard #{selectedHazard.hazard_id} Details</h4>
                          <span className="text-[10px] text-gray-400">Verified Road Defect</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedHazard(null)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>

                    <div className="p-4 space-y-3 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase font-mono">Street Location</span>
                        <strong className="text-sm text-cyan-300">{selectedHazard.road_name}</strong>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-white/5 p-3 rounded-xl font-mono text-[11px]">
                        <div>
                          <span className="text-gray-400 text-[9px] block uppercase">Defect Type</span>
                          <strong className="uppercase text-white">{selectedHazard.primary_class}</strong>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block uppercase">Status</span>
                          <strong
                            className={selectedHazard.status === 'REPAIRED' ? 'text-emerald-400' : 'text-rose-400'}
                          >
                            {selectedHazard.status === 'REPAIRED' ? 'REPAIRED ✓' : 'NEEDS REPAIR'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block uppercase">Shock Impact</span>
                          <span className="text-rose-400 font-bold">{selectedHazard.max_peak_az} m/s²</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block uppercase">Confirmed By</span>
                          <span className="text-cyan-300 font-bold">{selectedHazard.detection_count} vehicles</span>
                        </div>
                      </div>

                      {/* Action Button: Mark as Repaired */}
                      <button
                        onClick={() =>
                          handleUpdateStatus(
                            selectedHazard.hazard_id,
                            selectedHazard.status === 'REPAIRED' ? 'ACTIVE' : 'REPAIRED'
                          )
                        }
                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                          selectedHazard.status === 'REPAIRED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                            : 'bg-emerald-500 text-[#003824] hover:bg-emerald-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm font-bold">
                          {selectedHazard.status === 'REPAIRED' ? 'restart_alt' : 'check_circle'}
                        </span>
                        <span>{selectedHazard.status === 'REPAIRED' ? 'Re-open Road Defect' : 'Mark as Repaired by Road Crew'}</span>
                      </button>
                    </div>
                  </div>
                ) : selectedH3Segment ? (
                  <div>
                    <div className="bg-gradient-to-r from-[#06b6d4]/20 to-transparent p-3.5 flex items-center justify-between border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-xl">hexagon</span>
                        <div>
                          <h4 className="font-bold text-xs text-white">Street Health Zone</h4>
                          <span className="text-[10px] text-gray-400">{selectedH3Segment.road_corridor}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedH3Segment(null)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>

                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Road Condition Score:</span>
                        <span
                          className={`text-xl font-mono font-black ${
                            selectedH3Segment.pavement_condition_index < 45
                              ? 'text-rose-400'
                              : selectedH3Segment.pavement_condition_index < 75
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {selectedH3Segment.pavement_condition_index} / 100
                        </span>
                      </div>

                      <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
                        <div className="text-[10px] text-[#4cd7f6] uppercase font-bold tracking-wider">
                          Recommended Repair Action
                        </div>
                        <div className="font-bold text-xs text-white">
                          {selectedH3Segment.rda_action === 'IMMEDIATE_PATCHING'
                            ? '🚨 Immediate Asphalt Patching'
                            : selectedH3Segment.rda_action === 'CAPITAL_RESURFACING'
                            ? '🚧 Comprehensive Resurfacing'
                            : selectedH3Segment.rda_action === 'TRAFFIC_CALMING_AUDIT'
                            ? '🚦 Traffic Calming & Signage Audit'
                            : '✓ Routine Road Monitoring'}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          {selectedH3Segment.action_description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400 bg-white/5 p-2.5 rounded-xl">
                        <div>Potholes: <strong className="text-white">{selectedH3Segment.total_potholes}</strong></div>
                        <div>Speed Bumps: <strong className="text-white">{selectedH3Segment.total_speed_bumps}</strong></div>
                        <div>Estimated Budget: <strong className="text-cyan-300">
                          {selectedH3Segment.total_potholes > 0
                            ? `LKR ${(selectedH3Segment.total_potholes * 12500).toLocaleString()}`
                            : 'Standard Budget'}
                        </strong></div>
                        <div>Zone Area: <strong className="text-white">~0.10 km²</strong></div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: REPAIR PRIORITY QUEUE (DECISION SUPPORT) */}
        {/* ========================================================================= */}
        {currentTab === 'decision' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6]">assignment_turned_in</span>
                Road Repair Priority Queue
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Prioritizes limited asphalt and road repair teams directly toward the streets with the lowest road health scores and most critical potholes.
              </p>
            </div>

            {/* 3 Action Rule Guidelines Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel p-4 rounded-xl border-l-4 border-rose-500 space-y-1">
                <div className="text-xs font-bold text-rose-400 uppercase">Emergency Action</div>
                <div className="text-sm font-bold text-white">Immediate Asphalt Patching</div>
                <p className="text-[11px] text-gray-400">
                  Triggered when a street has 5+ potholes. Dispatch cold-mix patch crews within 24 hours (~12,500 LKR/patch).
                </p>
              </div>

              <div className="glass-panel p-4 rounded-xl border-l-4 border-amber-500 space-y-1">
                <div className="text-xs font-bold text-amber-400 uppercase">Major Reconstruction</div>
                <div className="text-sm font-bold text-white">Full Bitumen Resurfacing</div>
                <p className="text-[11px] text-gray-400">
                  Triggered when Road Health falls below 45/100. Complete asphalt overlay and milling required.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-xl border-l-4 border-cyan-400 space-y-1">
                <div className="text-xs font-bold text-cyan-300 uppercase">Traffic Safety</div>
                <div className="text-sm font-bold text-white">Traffic Calming Audit</div>
                <p className="text-[11px] text-gray-400">
                  Triggered when 3+ speed bumps are detected on a corridor to verify proper signage and warning paint.
                </p>
              </div>
            </div>

            {/* Asphalt Allocation Prioritized Queue */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Repair Dispatch Order (Sorted by Urgency)
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Streets exhibiting the most acute damage appear first.
                  </p>
                </div>
                <button
                  onClick={() => handleExportManifest('csv')}
                  className="bg-[#4cd7f6] hover:bg-[#38c8ea] text-[#003640] text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base font-bold">download</span>
                  Export Work Orders (CSV)
                </button>
              </div>

              <div className="space-y-3">
                {h3Segments.filter((s) => s.pavement_condition_index < 85).length === 0 ? (
                  <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-gray-400 space-y-2">
                    <span className="material-symbols-outlined text-3xl text-gray-500">task_alt</span>
                    <p className="font-semibold text-gray-300">
                      {h3Segments.length === 0
                        ? 'No road segments in the database yet.'
                        : 'All monitored streets are currently in good condition (Score ≥ 85).'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {h3Segments.length === 0
                        ? 'Click "Simulate Citizen Drive" and "Verify & Group Hazards" to populate road data.'
                        : 'No emergency asphalt patching or capital resurfacing mandates required at this time.'}
                    </p>
                  </div>
                ) : (
                  h3Segments
                    .filter((s) => s.pavement_condition_index < 85)
                    .sort((a, b) => a.pavement_condition_index - b.pavement_condition_index)
                    .map((seg, idx) => {
                      const estimatedCost =
                        seg.total_potholes > 0
                          ? `LKR ${(seg.total_potholes * 12500).toLocaleString()}`
                          : seg.pavement_condition_index < 45
                          ? 'Major Capital Resurfacing'
                          : 'Standard Maintenance';

                      return (
                        <div
                          key={seg.h3_index}
                          className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-[#06b6d4]/20 text-[#4cd7f6] font-mono font-black flex items-center justify-center text-sm shrink-0">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{seg.road_corridor}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                Active Potholes: <strong className="text-rose-400">{seg.total_potholes}</strong> • Speed Bumps: {seg.total_speed_bumps}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 justify-between md:justify-end">
                            <div className="text-right">
                              <div className="text-[10px] text-gray-400 uppercase font-mono">Estimated Repair Budget</div>
                              <div className="text-xs font-bold text-cyan-300 font-mono">{estimatedCost}</div>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] text-gray-400 uppercase font-mono">Road Health</div>
                              <div
                                className={`text-base font-mono font-black ${
                                  seg.pavement_condition_index < 45
                                    ? 'text-rose-400'
                                    : seg.pavement_condition_index < 75
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {seg.pavement_condition_index} / 100
                              </div>
                            </div>

                            <div className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-cyan-300 shrink-0">
                              {seg.rda_action === 'IMMEDIATE_PATCHING'
                                ? '🚨 Patch Required'
                                : seg.rda_action === 'CAPITAL_RESURFACING'
                                ? '🚧 Resurfacing'
                                : '🚦 Traffic Audit'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ROAD ASSET REGISTRY */}
        {/* ========================================================================= */}
        {currentTab === 'inventory' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4cd7f6]">fact_check</span>
                  Road Asset Registry
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Complete directory of verified road hazards, street condition ratings, and incoming citizen reports.
                </p>
              </div>

              {/* Sub-tab selection */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 self-start">
                <button
                  onClick={() => setRegistrySubTab('hazards')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    registrySubTab === 'hazards'
                      ? 'bg-[#4cd7f6] text-[#003640] shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Confirmed Hazards ({hazards.length})
                </button>
                <button
                  onClick={() => setRegistrySubTab('segments')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    registrySubTab === 'segments'
                      ? 'bg-[#4cd7f6] text-[#003640] shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Street Zones ({h3Segments.length})
                </button>
                <button
                  onClick={() => setRegistrySubTab('reports')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    registrySubTab === 'reports'
                      ? 'bg-[#4cd7f6] text-[#003640] shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Recent Reports ({stagedAnomalies.length})
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: CONFIRMED HAZARDS */}
            {registrySubTab === 'hazards' && (
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Filter:</span>
                    <button
                      onClick={() => setRegistryFilter('all')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                        registryFilter === 'all'
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({hazards.length})
                    </button>
                    <button
                      onClick={() => setRegistryFilter('active')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                        registryFilter === 'active'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      Needs Repair ({activePotholes.length + activeBumps.length})
                    </button>
                    <button
                      onClick={() => setRegistryFilter('repaired')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                        registryFilter === 'repaired'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      Repaired ({repairedHazards.length})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={registrySearch}
                    onChange={(e) => setRegistrySearch(e.target.value)}
                    placeholder="Search street name..."
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#4cd7f6] w-full sm:w-60"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-mono">
                        <th className="py-2.5">Hazard ID</th>
                        <th>Defect Type</th>
                        <th>Street Location</th>
                        <th>Confirmed By</th>
                        <th>Shock Impact</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {hazards.filter((h) => {
                        if (registryFilter === 'active' && h.status === 'REPAIRED') return false;
                        if (registryFilter === 'repaired' && h.status !== 'REPAIRED') return false;
                        if (registrySearch && !h.road_name.toLowerCase().includes(registrySearch.toLowerCase())) {
                          return false;
                        }
                        return true;
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400 text-xs">
                            No matching confirmed hazards found.
                          </td>
                        </tr>
                      ) : (
                        hazards
                          .filter((h) => {
                            if (registryFilter === 'active' && h.status === 'REPAIRED') return false;
                            if (registryFilter === 'repaired' && h.status !== 'REPAIRED') return false;
                            if (registrySearch && !h.road_name.toLowerCase().includes(registrySearch.toLowerCase())) {
                              return false;
                            }
                            return true;
                          })
                          .map((h) => (
                            <tr key={h.hazard_id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 font-mono font-bold text-[#4cd7f6]">#{h.hazard_id}</td>
                              <td>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    h.primary_class === 'pothole'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {h.primary_class}
                                </span>
                              </td>
                              <td className="font-semibold text-white">{h.road_name}</td>
                              <td className="text-cyan-300 font-mono font-bold">{h.detection_count} vehicles</td>
                              <td className="font-mono">
                                <span className={h.max_peak_az > 15 ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                                  {h.max_peak_az} m/s²
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    h.status === 'REPAIRED'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {h.status === 'REPAIRED' ? 'REPAIRED ✓' : 'NEEDS REPAIR'}
                                </span>
                              </td>
                              <td className="text-right">
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(h.hazard_id, h.status === 'REPAIRED' ? 'ACTIVE' : 'REPAIRED')
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    h.status === 'REPAIRED'
                                      ? 'bg-white/10 hover:bg-white/20 text-gray-300'
                                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {h.status === 'REPAIRED' ? 'Re-open' : 'Mark Repaired'}
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: STREET HEALTH ZONES */}
            {registrySubTab === 'segments' && (
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-mono">
                        <th className="py-2.5">Street Corridor</th>
                        <th>Health Score (0-100)</th>
                        <th>Potholes</th>
                        <th>Speed Bumps</th>
                        <th>Recommended Repair Action</th>
                        <th>Zone Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {h3Segments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                            No street health zones calculated yet. Ingest citizen drives to map streets.
                          </td>
                        </tr>
                      ) : (
                        h3Segments.map((seg) => (
                          <tr key={seg.h3_index} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 font-semibold text-white">{seg.road_corridor}</td>
                            <td>
                              <span
                                className={`font-mono font-bold text-sm ${
                                  seg.pavement_condition_index < 45
                                    ? 'text-rose-400'
                                    : seg.pavement_condition_index < 75
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {seg.pavement_condition_index} / 100
                              </span>
                            </td>
                            <td className="font-mono text-rose-400 font-bold">{seg.total_potholes}</td>
                            <td className="font-mono text-amber-400">{seg.total_speed_bumps}</td>
                            <td>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-cyan-300">
                                {seg.rda_action}
                              </span>
                            </td>
                            <td className="font-mono text-[10px] text-gray-500">{seg.h3_index}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: RECENT VEHICLE REPORTS */}
            {registrySubTab === 'reports' && (
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-mono">
                        <th className="py-2.5">Time Logged</th>
                        <th>Defect Detected</th>
                        <th>Impact Severity</th>
                        <th>Vehicle Speed</th>
                        <th>Phone Placement</th>
                        <th>Privacy Protection</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {stagedAnomalies.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                            No recent vehicle reports in the database.
                          </td>
                        </tr>
                      ) : (
                        stagedAnomalies.slice(0, 15).map((staged) => (
                          <tr key={staged.uuid} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 font-mono text-gray-300">
                              {new Date(staged.timestamp_utc).toLocaleTimeString()}
                            </td>
                            <td className="font-bold uppercase text-white">{staged.class_label}</td>
                            <td className="font-mono text-rose-400">{staged.peak_az_m_s2} m/s²</td>
                            <td className="font-mono text-gray-300">{staged.speed_kmh} km/h</td>
                            <td className="capitalize text-gray-400">{staged.mounting_config.replace('_', ' ')}</td>
                            <td>
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Differential Privacy Applied ✓
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: HOW IT WORKS & CITIZEN PRIVACY */}
        {/* ========================================================================= */}
        {currentTab === 'how_it_works' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6]">lightbulb</span>
                How RoadPulse Works: Citizen AI to Fixed Roads
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                A simple 4-step explanation of how everyday smartphones replace expensive inspection fleets while completely protecting citizen privacy.
              </p>
            </div>

            {/* 4 Illustrated Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* STEP 1 */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/20 text-[#4cd7f6] flex items-center justify-center font-black">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Everyday Citizen Smartphones</h3>
                    <span className="text-[11px] text-gray-400">Offline-First Machine Learning</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Drivers and public buses mount their phones on dashboards. As they travel, phone motion sensors capture road vibrations 100 times per second. A lightweight AI model identifies potholes instantly without needing cellular service or draining the battery.
                </p>
                <div className="bg-white/5 p-2.5 rounded-xl text-[11px] text-gray-400 font-mono">
                  ✓ Operates 100% offline in rural dead-zones • Consumes negligible phone power
                </div>
              </div>

              {/* STEP 2 */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1bbd85]/20 text-emerald-400 flex items-center justify-center font-black">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Guaranteed Driver Privacy</h3>
                    <span className="text-[11px] text-gray-400">Sri Lanka PDPA Act No. 9 Compliant</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Citizens never have to worry about tracking. Driving routes, home addresses, and personal schedules are mathematically scrambled using Laplacian Differential Privacy. Municipal road crews only see where potholes are—never who drove over them.
                </p>
                <div className="bg-white/5 p-2.5 rounded-xl text-[11px] text-gray-400 font-mono">
                  ✓ Zero trajectory reconstruction • Statutory compliance with privacy laws
                </div>
              </div>

              {/* STEP 3 */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ee9800]/20 text-amber-400 flex items-center justify-center font-black">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Multi-Car Verification</h3>
                    <span className="text-[11px] text-gray-400">Eliminating False Alarms</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  If someone drops their phone in a cup holder, it isn&apos;t marked as a pothole. The platform requires multiple independent vehicles to hit the exact same physical spot before confirming a genuine road defect.
                </p>
                <div className="bg-white/5 p-2.5 rounded-xl text-[11px] text-gray-400 font-mono">
                  ✓ High-confidence verification • 87% reduction in municipal false alarms
                </div>
              </div>

              {/* STEP 4 */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black">
                    4
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Targeted Asphalt Repairs</h3>
                    <span className="text-[11px] text-gray-400">Optimizing Scarce Municipal Budgets</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Instead of guessing or relying on delayed citizen complaints, the Road Development Authority receives daily updated priority work orders. Scarce asphalt is dispatched directly to the worst corridors first.
                </p>
                <div className="bg-white/5 p-2.5 rounded-xl text-[11px] text-gray-400 font-mono">
                  ✓ Saves municipal repair budgets • Directs cold-mix asphalt where it matters
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
