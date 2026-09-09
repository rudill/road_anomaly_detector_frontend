import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';

/**
 * Municipal Analytics & Decision Support Endpoint
 * GET /api/v1/analytics
 */
export async function GET() {
  try {
    const summary = postgisEngine.getAnalyticsSummary();
    const segments = postgisEngine.getH3RoadSegments();
    const verifiedHazards = postgisEngine.getVerifiedHazards();

    // Asphalt allocation priority ranking: segments sorted by lowest PCI with active defects
    const asphaltAllocationQueue = segments
      .filter((s) => s.total_potholes > 0 || s.pavement_condition_index < 70)
      .sort((a, b) => a.pavement_condition_index - b.pavement_condition_index)
      .map((s, index) => ({
        priority_rank: index + 1,
        h3_index: s.h3_index,
        corridor: s.road_corridor,
        pci: s.pavement_condition_index,
        potholes: s.total_potholes,
        speed_bumps: s.total_speed_bumps,
        avg_peak_az: s.avg_impact_severity,
        allocated_action: s.rda_action,
        urgency: s.pavement_condition_index < 45 ? 'CRITICAL' : s.pavement_condition_index < 65 ? 'HIGH' : 'MEDIUM',
      }));

    return NextResponse.json({
      summary,
      asphalt_allocation_queue: asphaltAllocationQueue,
      verified_hazards_count: verifiedHazards.length,
      active_hazards_count: verifiedHazards.filter((h) => h.status === 'ACTIVE').length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}
