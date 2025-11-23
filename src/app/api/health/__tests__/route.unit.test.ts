import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, HEAD } from '../route';
import { ConvexHttpClient } from 'convex/browser';
import * as envModule from '@/lib/env';

// Mock dependencies
vi.mock('convex/browser', () => {
  return {
    ConvexHttpClient: vi.fn(),
  };
});

vi.mock('@/lib/env', () => ({
  getEnvVar: vi.fn(),
}));

vi.mock('convex/_generated/api', () => ({
  api: {
    health: {
      systemCheck: 'systemCheck',
    },
  },
}));

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => {
        return {
            json: async () => body,
            status: init?.status || 200,
            headers: new Headers(init?.headers),
            body: null // For HEAD check simulation if needed, though HEAD uses new Response(null)
        };
    }
  }
}));


describe('Health Check Endpoint', () => {
  let mockQuery: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockQuery = vi.fn();
    (ConvexHttpClient as any).mockImplementation(() => ({
      query: mockQuery,
    }));
    (envModule.getEnvVar as any).mockReturnValue('https://mock-convex.url');
  });

  it('returns 200 OK when system is healthy', async () => {
    mockQuery.mockResolvedValue({ ok: true });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.dependencies.database).toBe('up');
    expect(body.version).toBeDefined();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('returns 503 when convex query fails', async () => {
    mockQuery.mockRejectedValue(new Error('Convex down'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.error).toBe('Convex down');
  });

  it('returns 503 when convex query times out', async () => {
    // Mock query to hang
    mockQuery.mockImplementation(() => new Promise(() => {}));

    // We need to use fake timers to trigger timeout
    vi.useFakeTimers();

    const responsePromise = GET();

    // Advance time by 5001ms
    vi.advanceTimersByTime(5001);

    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain('Timeout');

    vi.useRealTimers();
  });

  it('HEAD request returns status without body', async () => {
    mockQuery.mockResolvedValue({ ok: true });

    const response = await HEAD();

    expect(response.status).toBe(200);
    // HEAD returns a standard Response object in our code, not NextResponse.json
    // new Response(null, ...) -> body is null
    expect(response.body).toBe(null);
  });

  it('returns 500 if CONVEX_URL is missing', async () => {
    (envModule.getEnvVar as any).mockReturnValue('');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Configuration error');
  });
});
