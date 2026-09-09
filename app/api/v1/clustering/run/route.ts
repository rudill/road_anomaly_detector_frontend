import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';
import { DBSCANParams } from '@/types/road-anomaly';

/**
 * Background Spatial Clustering Endpoint
 * POST /api/v1/clustering/run
 * Executes Diameter-Bounded DBSCAN (D_max <= 5m, MinPts = 3)
 */
export async function POST(request: Request) {
  try {
    let params: DBSCANParams = {
      distance_metric: 'Haversine',
      d_max_meters: 5.0,
      min_pts: 3,
    };

    try {
      const body = await request.json();
      if (body) {
        if (body.d_max_meters) params.d_max_meters = Number(body.d_max_meters);
        if (body.min_pts) params.min_pts = Number(body.min_pts);
      }
    } catch {
      // Use defaults if empty body
    }

    const result = postgisEngine.runDBSCANClustering(params);

    return NextResponse.json({
      status: 'SUCCESS',
      message: `DBSCAN deduplication completed in ${result.duration_ms}ms`,
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}
