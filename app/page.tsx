import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b1326] text-[#dae2fd] p-8">
      <main className="max-w-2xl w-full bg-[#131b2e] border border-[#3d494c] rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#06b6d4]/20 text-[#4cd7f6] flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-4xl">map</span>
        </div>
        <h1 className="text-3xl font-bold text-[#4cd7f6] mb-2">GIS Infrastructure Monitor</h1>
        <p className="text-[#bcc9cd] text-sm mb-8">
          Road Maintenance Ops &amp; Real-time Predictive Analytics
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-3 bg-[#06b6d4] text-[#00424f] font-bold px-6 py-4 rounded-xl hover:brightness-110 transition-all shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined">dashboard</span>
            React Dashboard (/dashboard)
          </Link>

          <a
            href="/dashboard.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 border border-[#4cd7f6]/40 text-[#4cd7f6] font-bold px-6 py-4 rounded-xl hover:bg-[#4cd7f6]/10 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">html</span>
            Static HTML (/dashboard.html)
          </a>
        </div>
      </main>
    </div>
  );
}
