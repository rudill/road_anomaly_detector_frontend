import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';

/**
 * Tier 3 Query Endpoint
 * GET /api/v1/h3/segments
 * Returns GeoJSON FeatureCollection of Uber H3 Res 9 cells with PCI & defect counts
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'geojson';

    const segments = postgisEngine.getH3RoadSegments();

    if (format === 'json') {
      return NextResponse.json({
        total_cells: segments.length,
        resolution: 9,
        edge_length_m: 105.7,
        cell_area_km2: 0.1,
        segments,
      });
    }

    // Return standard GeoJSON FeatureCollection for direct consumption by Mapbox
    const featureCollection = {
      type: 'FeatureCollection',
      features: segments.map((seg) => ({
        type: 'Feature',
        id: seg.h3_index,
        geometry: {
          type: 'Polygon',
          coordinates: [seg.polygon],
        },
        properties: {
          h3_index: seg.h3_index,
          road_corridor: seg.road_corridor,
          total_potholes: seg.total_potholes,
          total_speed_bumps: seg.total_speed_bumps,
          avg_impact_severity: seg.avg_impact_severity,
          pavement_condition_index: seg.pavement_condition_index,
          pci: seg.pavement_condition_index,
          rda_action: seg.rda_action,
          action_description: seg.action_description,
          // Color code for quick styling
          color:
            seg.pavement_condition_index < 45.0
              ? '#ef4444' // Red / Critical
              : seg.pavement_condition_index < 75.0
              ? '#f59e0b' // Amber / Degraded
              : '#10b981', // Green / Good
        },
      })),
    };

    return NextResponse.json(featureCollection, {
      headers: {
        'Content-Type': 'application/geo+json',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}
