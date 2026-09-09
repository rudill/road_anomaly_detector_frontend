import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 selection:bg-[#4cd7f6]/30">
      <main className="max-w-3xl w-full bg-[#131b2e] border border-[#3d494c]/50 rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl space-y-6">
        {/* Platform Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#06b6d4]/15 border border-[#4cd7f6]/30 text-[#4cd7f6] text-xs font-mono font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse"></span>
          RDA Sri Lanka • Edge AI Platform v1.0
        </div>

        <div className="w-20 h-20 rounded-2xl bg-[#06b6d4]/20 text-[#4cd7f6] flex items-center justify-center shadow-lg border border-[#4cd7f6]/30">
          <span className="material-symbols-outlined text-5xl">satellite_alt</span>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Municipal Pavement Surveillance &amp; Decision Support
          </h1>
          <p className="text-[#bcc9cd] text-sm sm:text-base mt-2 max-w-xl mx-auto leading-relaxed">
            Offline-First Edge AI Road Anomaly Classification Platform built for low-resilience environments. Real-time PostGIS 3-Tier analytics, Uber H3 Resolution 9 hexagonal spatial binning, and automated DBSCAN hazard clustering.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-3 w-full text-left font-mono text-xs">
          <div className="bg-[#060e20]/60 p-3.5 rounded-xl border border-white/5">
            <div className="text-[#4cd7f6] font-bold text-sm mb-1">PostGIS 3-Tier</div>
            <p className="text-gray-400 text-[11px]">staged_anomalies, verified_hazards &amp; h3_road_segments</p>
          </div>
          <div className="bg-[#060e20]/60 p-3.5 rounded-xl border border-white/5">
            <div className="text-[#ffb95f] font-bold text-sm mb-1">DBSCAN Engine</div>
            <p className="text-gray-400 text-[11px]">D_max ≤ 5.0m, MinPts = 3 confidence-weighted centroids</p>
          </div>
          <div className="bg-[#060e20]/60 p-3.5 rounded-xl border border-white/5">
            <div className="text-[#4edea3] font-bold text-sm mb-1">Privacy Shield</div>
            <p className="text-gray-400 text-[11px]">Laplacian DP (ε=1.0) &amp; Sri Lanka PDPA No. 9 compliant</p>
          </div>
        </div>

        {/* Navigation CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-3 bg-[#4cd7f6] text-[#003640] font-bold px-6 py-4 rounded-xl hover:brightness-110 transition-all shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined font-bold">dashboard</span>
            Launch RDA Command Center (/dashboard)
          </Link>

          <a
            href="/api/v1/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 border border-[#4cd7f6]/40 text-[#4cd7f6] font-bold px-6 py-4 rounded-xl hover:bg-[#4cd7f6]/10 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">api</span>
            Inspect API Engine (/api/v1/analytics)
          </a>
        </div>
      </main>
    </div>
  );
}
