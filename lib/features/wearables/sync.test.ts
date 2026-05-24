import { describe, it, expect, vi } from 'vitest';
import { fetchGoogleFitMetrics } from './sync-service';

describe('Google Fit Sync Service Metrics Parser', () => {
  it('should parse aggregate steps and calories correctly', async () => {
    // Mock response matching Google Fit aggregate schema
    const mockApiResponse = {
      bucket: [
        {
          dataset: [
            {
              dataTypeName: 'com.google.step_count.delta',
              point: [
                {
                  dataTypeName: 'com.google.step_count.delta',
                  value: [{ intVal: 6200 }]
                },
                {
                  dataTypeName: 'com.google.step_count.delta',
                  value: [{ intVal: 1800 }]
                }
              ]
            },
            {
              dataTypeName: 'com.google.calories.expended',
              point: [
                {
                  dataTypeName: 'com.google.calories.expended',
                  value: [{ fpVal: 320.5 }]
                },
                {
                  dataTypeName: 'com.google.calories.expended',
                  value: [{ fpVal: 80.2 }]
                }
              ]
            }
          ]
        }
      ]
    };

    // Mock global fetch
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchGoogleFitMetrics('mock-access-token', new Date());

    expect(result.steps).toBe(8000); // 6200 + 1800
    expect(result.caloriesBurned).toBe(401); // 320.5 + 80.2 = 400.7 -> rounded to 401
    
    vi.restoreAllMocks();
  });
});
