export interface WearablesDailyData {
  steps: number;
  caloriesBurned: number;
}

/**
 * Fetches steps and calories burned for a specific day from Google Fit REST API
 */
export async function fetchGoogleFitMetrics(accessToken: string, targetDate: Date): Promise<WearablesDailyData> {
  // Set start of day and end of day in timestamps
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startTimeMillis = startOfDay.getTime();
  const endTimeMillis = endOfDay.getTime();

  const aggregateUrl = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';

  const body = {
    aggregateBy: [
      {
        dataTypeName: 'com.google.step_count.delta',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
      },
      {
        dataTypeName: 'com.google.calories.expended',
        dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
      }
    ],
    bucketByTime: { durationMillis: 86400000 }, // 1 day bucket
    startTimeMillis,
    endTimeMillis,
  };

  const res = await fetch(aggregateUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Fit sync request failed: ${errText}`);
  }

  const data = await res.json();
  let steps = 0;
  let caloriesBurned = 0;

  // Google Fit returns buckets -> datasets -> points -> values
  if (data.bucket && data.bucket.length > 0) {
    const bucket = data.bucket[0];
    if (bucket.dataset && bucket.dataset.length > 0) {
      for (const dataset of bucket.dataset) {
        if (dataset.point && dataset.point.length > 0) {
          for (const point of dataset.point) {
            if (point.value && point.value.length > 0) {
              const valueObj = point.value[0];
              // step count value is integer, calories value is float
              if (point.dataTypeName === 'com.google.step_count.delta') {
                steps += valueObj.intVal || 0;
              } else if (point.dataTypeName === 'com.google.calories.expended') {
                caloriesBurned += valueObj.fpVal || 0;
              }
            }
          }
        }
      }
    }
  }

  return {
    steps: Math.round(steps),
    caloriesBurned: Math.round(caloriesBurned),
  };
}
