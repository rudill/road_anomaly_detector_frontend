import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#070d1d] text-[#dae2fd] font-sans selection:bg-[#4cd7f6]/30 flex flex-col justify-between">
      {/* BACKGROUND GLOW EFFECTS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[#06b6d4]/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[15%] w-[600px] h-[600px] rounded-full bg-[#1bbd85]/10 blur-[140px]" />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/20 border border-[#4cd7f6]/40 flex items-center justify-center text-[#4cd7f6] shadow-lg shadow-[#06b6d4]/10">
            <span className="material-symbols-outlined text-2xl">satellite_alt</span>
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <span>RoadPulse</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#06b6d4]/20 text-[#4cd7f6] border border-[#4cd7f6]/30 uppercase font-mono">
                Municipal AI
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Road Development Authority • Sri Lanka</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-[#4cd7f6] hover:bg-[#38c8ea] text-[#003640] text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            <span>Open Command Center</span>
            <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
          </Link>
        </div>
      </header>

      {/* MAIN HERO CONTENT */}
      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center text-center space-y-8 my-auto">
        {/* INITIATIVE BADGE */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#06b6d4]/10 border border-[#4cd7f6]/30 text-[#4cd7f6] text-xs font-mono font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse" />
          <span>Smart Public Infrastructure Initiative</span>
        </div>

        {/* HERO HEADLINE */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Fixing City Roads Faster with <br />
            <span className="bg-gradient-to-r from-[#4cd7f6] via-[#67e8f9] to-[#4edea3] bg-clip-text text-transparent">
              Everyday Citizen Smartphones
            </span>
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
            Instead of expensive inspection trucks, our platform uses smartphone sensors inside everyday vehicles to automatically detect potholes and map road damage in real time—protecting citizen privacy while helping city crews patch the worst roads first.
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center pt-2">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-black text-sm px-8 py-4 rounded-xl hover:brightness-110 transition-all shadow-xl shadow-[#06b6d4]/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span>Launch Road Command Center</span>
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-sm px-6 py-4 rounded-xl transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xl text-[#4cd7f6]">map</span>
            <span>Explore Live Hazard Map</span>
          </Link>
        </div>

        {/* 3 CORE PILLARS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-6 text-left">
          {/* PILLAR 1: CROWDSOURCED SENSING */}
          <div className="bg-[#10172b]/80 border border-white/10 p-5 rounded-2xl space-y-2.5 backdrop-blur-sm hover:border-[#4cd7f6]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/15 text-[#4cd7f6] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">directions_car</span>
            </div>
            <h2 className="text-sm font-bold text-white">1. Automatic Citizen Sensing</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Vehicles traversing the city automatically detect potholes and speed bumps using phone sensors. The AI runs 100% offline without draining battery or cellular data.
            </p>
          </div>

          {/* PILLAR 2: PRIVACY SHIELD */}
          <div className="bg-[#10172b]/80 border border-white/10 p-5 rounded-2xl space-y-2.5 backdrop-blur-sm hover:border-[#4edea3]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#1bbd85]/15 text-[#4edea3] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">shield_person</span>
            </div>
            <h2 className="text-sm font-bold text-white">2. Guaranteed Citizen Privacy</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Personal driving trips, addresses, and daily routines are never tracked. GPS points are mathematically scrambled before upload, complying with privacy laws.
            </p>
          </div>

          {/* PILLAR 3: TARGETED REPAIRS */}
          <div className="bg-[#10172b]/80 border border-white/10 p-5 rounded-2xl space-y-2.5 backdrop-blur-sm hover:border-[#ffb95f]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#ee9800]/15 text-[#ffb95f] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">construction</span>
            </div>
            <h2 className="text-sm font-bold text-white">3. Smart Repair Allocation</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Road authorities receive a prioritized repair list with estimated repair costs, directing scarce asphalt directly to the streets in greatest need.
            </p>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-3">
        <div>
          <span>© 2026 RoadPulse • Municipal Road Asset Surveillance</span>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <span>Colombo Urban Network (A2, B084, A4)</span>
          <span>•</span>
          <span className="text-[#4edea3]">Privacy Compliant (PDPA No. 9)</span>
        </div>
      </footer>
    </div>
  );
}
