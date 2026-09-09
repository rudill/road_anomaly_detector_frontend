import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';

/**
 * Tier 1 Query Endpoint
 * GET /api/v1/anomalies/staged
 */
export async function GET() {
  try {
    const staged = postgisEngine.getStagedAnomalies();
    return NextResponse.json({
      total_count: staged.length,
      tier: 'staged_anomalies',
      privacy_level: 'Laplacian Differential Privacy (epsilon=1.0)',
      records: staged,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}
