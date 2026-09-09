import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';
import { HazardStatus } from '@/types/road-anomaly';

/**
 * Tier 2 Query & Update Endpoint
 * GET /api/v1/hazards/verified
 * PATCH /api/v1/hazards/verified
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as HazardStatus | null;
    const hazardClass = searchParams.get('class');

    let hazards = postgisEngine.getVerifiedHazards();

    if (status) {
      hazards = hazards.filter((h) => h.status === status);
    }
    if (hazardClass && (hazardClass === 'pothole' || hazardClass === 'speed_bump')) {
      hazards = hazards.filter((h) => h.primary_class === hazardClass);
    }

    return NextResponse.json({
      total_count: hazards.length,
      tier: 'verified_hazards',
      clustering_engine: 'Diameter-Bounded DBSCAN (D_max <= 5m, MinPts = 3)',
      hazards,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { hazard_id, status } = body;

    if (!hazard_id || !status) {
      return NextResponse.json({ status: 'ERROR', message: 'hazard_id and status are required' }, { status: 400 });
    }

    const updated = postgisEngine.updateHazardStatus(Number(hazard_id), status as HazardStatus);
    if (!updated) {
      return NextResponse.json({ status: 'ERROR', message: `Hazard with ID ${hazard_id} not found` }, { status: 404 });
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: `Hazard ${hazard_id} status updated to ${status}`,
      hazard: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}
