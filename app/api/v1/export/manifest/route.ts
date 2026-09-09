import { NextResponse } from 'next/server';
import { postgisEngine } from '@/lib/postgis-engine';

/**
 * Maintenance Manifest Export Endpoint
 * GET /api/v1/export/manifest?format=geojson|csv|json
 * Section 7.2 Specification: Exportable Maintenance Manifests for RDA field crews
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'geojson';
    const hazards = postgisEngine.getVerifiedHazards().filter((h) => h.status !== 'REPAIRED');

    if (format === 'csv') {
      const header = 'hazard_id,primary_class,detection_count,avg_confidence,max_peak_az_ms2,centroid_lat,centroid_lng,h3_index,road_name,status,first_detected,last_detected\n';
      const rows = hazards
        .map(
          (h) =>
            `${h.hazard_id},${h.primary_class},${h.detection_count},${h.avg_confidence},${h.max_peak_az},${h.centroid_lat},${h.centroid_lng},"${h.h3_index}","${h.road_name}",${h.status},${h.first_detected_at},${h.last_detected_at}`
        )
        .join('\n');

      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="RDA_Maintenance_Manifest_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Default: GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      name: 'RDA_Verified_Hazard_Manifest',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features: hazards.map((h) => ({
        type: 'Feature',
        id: h.hazard_id,
        geometry: {
          type: 'Point',
          coordinates: [h.centroid_lng, h.centroid_lat],
        },
        properties: {
          hazard_id: h.hazard_id,
          primary_class: h.primary_class,
          detection_count: h.detection_count,
          avg_confidence: h.avg_confidence,
          max_peak_az: h.max_peak_az,
          h3_index: h.h3_index,
          road_name: h.road_name,
          status: h.status,
          first_detected_at: h.first_detected_at,
          last_detected_at: h.last_detected_at,
          priority: h.primary_class === 'pothole' && h.max_peak_az > 15 ? 'CRITICAL' : 'STANDARD',
        },
      })),
    };

    return new NextResponse(JSON.stringify(geojson, null, 2), {
      headers: {
        'Content-Type': 'application/geo+json',
        'Content-Disposition': `attachment; filename="RDA_Maintenance_Manifest_${new Date().toISOString().slice(0, 10)}.geojson"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ status: 'ERROR', message }, { status: 500 });
  }
}
