import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

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
        message: `Failed to connect to Python backend at ${BACKEND_URL}: ${errorMessage}. Please ensure the Python server (python run.py) is running on port 8000.`,
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
