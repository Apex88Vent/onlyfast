// database Edge Function: get-weather
//
// Deploy to YOUR database project (thpyjvwtfvfxiufchrxn) by either:
//   A) Pasting this file into the database Dashboard:
//        Dashboard -> Edge Functions -> Create a new function
//        Name: get-weather   |   Verify JWT: OFF
//        Paste the contents below, click Deploy.
//   B) Or via CLI:
//        mkdir -p database/functions/get-weather
//        cp docs/edge-functions/get-weather.ts database/functions/get-weather/index.ts
//        database link --project-ref thpyjvwtfvfxiufchrxn
//        database functions deploy get-weather --no-verify-jwt
//
// Accepts: { latitude: number, longitude: number }
// Returns: { temperature, humidity, wind_speed, wind_direction, weather, weather_code }
// Source:  Open-Meteo (https://open-meteo.com) — free, no API key required.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WIND_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

// Minimal WMO weather-code -> human label map (Open-Meteo uses WMO codes).
function describeWeather(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Current conditions';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required and must be numbers' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph`;

    const response = await fetch(url, { headers: { 'User-Agent': 'DirtSetup/1.0' } });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Open-Meteo request failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const current = data?.current;
    if (!current) {
      throw new Error('Open-Meteo returned no current conditions');
    }

    const code = Number(current.weather_code) || 0;
    const dirDeg = Number(current.wind_direction_10m) || 0;
    const dirIndex = Math.round(dirDeg / 22.5) % 16;

    const result = {
      temperature: Math.round(Number(current.temperature_2m) || 0),
      humidity: Math.round(Number(current.relative_humidity_2m) || 0),
      wind_speed: Math.round(Number(current.wind_speed_10m) || 0),
      wind_direction: WIND_DIRECTIONS[dirIndex] || 'N',
      weather: describeWeather(code),
      weather_code: code,
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Weather fetch failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
