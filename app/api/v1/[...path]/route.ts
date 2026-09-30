import { NextRequest, NextResponse } from 'next/server';

const rawBackendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://onyx-mountain-e6bff16a.tunnl.gg';
const BACKEND_URL = rawBackendUrl.trim().replace(/\/+$/, '');

/**
 * Universal Reverse Proxy Handler
 * Transparently forwards all /api/v1/* requests directly to the Python FastAPI backend
 */
async function proxyRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>
): Promise<Response> {
  const { path } = await paramsPromise;
  const pathString = path.join('/');
  const search = request.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/v1/${pathString}${search}`;

  // Forward incoming headers, skipping hop-by-hop headers
  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
      forwardHeaders.set(key, value);
    }
  });

  // Bypass tunnel warning/interstitial pages (tunnl.gg, ngrok, localtunnel, etc.)
  forwardHeaders.set('tunnl-skip-browser-warning', '1');
  forwardHeaders.set('ngrok-skip-browser-warning', '1');
  forwardHeaders.set('bypass-tunnel-reminder', '1');
  forwardHeaders.set('user-agent', 'RoadAnomalyFrontendProxy/1.0');

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: 'follow',
  };

  // Attach body for mutating requests
  if (!['GET', 'HEAD'].includes(request.method)) {
    try {
      const bodyBuffer = await request.arrayBuffer();
      if (bodyBuffer.byteLength > 0) {
        init.body = bodyBuffer;
      }
    } catch (e) {
      console.error('[Proxy] Failed to read request body:', e);
    }
  }

  try {
    const backendResponse = await fetch(targetUrl, init);

    // Build response headers to return to the client
    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['transfer-encoding', 'content-encoding'].includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await backendResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    console.error(`[Proxy Error] Unable to reach backend at ${targetUrl}:`, errorMessage);

    return NextResponse.json(
      {
        status: 'ERROR',
        error: 'BACKEND_UNAVAILABLE',
        message: `Failed to connect to Python backend at ${BACKEND_URL}: ${errorMessage}. Please ensure the backend server or tunnel is running and reachable.`,
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context.params);
}
