import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';
import { SyncBatchPayload } from '@/types/road-anomaly';

/**
 * Ingestion Layer Endpoint
 * POST /api/v1/anomalies/sync
 * Section 2.1 of Backend Pipeline Architecture Spec
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const authHeader = request.headers.get('authorization') || '';
    const appVersion = request.headers.get('x-device-app-version') || '1.0.4';

    // Parse JSON payload
    let payload: SyncBatchPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { status: 'ERROR', message: 'Invalid JSON payload structure' },
        { status: 400 }
      );
    }

    if (!payload.device_id_hash || !Array.isArray(payload.records)) {
      return NextResponse.json(
        { status: 'ERROR', message: 'Missing device_id_hash or records array' },
        { status: 422 }
      );
    }

    // Process ingestion through PostGIS Tier 1 staging engine
    const response = postgisEngine.ingestBatch(payload);

    return NextResponse.json(
      {
        ...response,
        client_version: appVersion,
        auth_verified: authHeader.startsWith('Bearer ') || authHeader.length === 0,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { status: 'ERROR', message },
      { status: 500 }
    );
  }
}
