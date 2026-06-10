import React, { useState, useId } from 'react';

interface TrackInfoProps {
  trackName: string;
  raceDate: string;
  raceClass: string;
  trackCondition: string;
  temperature: string;
  humidity: string;
  windSpeed: string;
  windDirection: string;
  trackShape?: string;
  trackLength?: string;
  onChange: (field: string, value: string) => void;
}

const degreesToCompass = (deg: number): string => {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
};

const TRACK_SHAPES = ['Traditional', 'D-Shaped', 'Tri-Oval', 'Paperclip', 'Triangular', 'Quad-Oval', 'Rectangular'];
const TRACK_LENGTHS = ['1/8 mile', '1/4 mile', '3/8 mile', '1/2 mile'];

const TrackInfoSection: React.FC<TrackInfoProps> = ({
  trackName, raceDate, trackCondition,
  temperature, humidity, windSpeed, windDirection,
  trackShape = '', trackLength = '',
  onChange
}) => {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const prefix = useId();

  const handleGPS = async () => {
    setGpsLoading(true);
    setGpsStatus('Getting location...');

    if (!('geolocation' in navigator)) {
      setGpsStatus('This browser does not support geolocation.');
      setGpsLoading(false);
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 15000,
          enableHighAccuracy: false,
          maximumAge: 60000,
        });
      });
      const { latitude, longitude } = pos.coords;
      onChange('latitude', latitude.toString());
      onChange('longitude', longitude.toString());
      setGpsStatus('Location found. Looking up track + weather...');

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data = await res.json();
        if (data.display_name) {
          const parts = data.display_name.split(',');
          const name = parts.slice(0, 2).join(',').trim();
          onChange('trackName', name);
        }
      } catch (geoErr) {
        // eslint-disable-next-line no-console
        console.warn('[TrackInfo] reverse-geocode failed (non-fatal):', geoErr);
      }

      setWeatherLoading(true);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m` +
          `&temperature_unit=fahrenheit&wind_speed_unit=mph`;
        const res = await fetch(url);
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Open-Meteo HTTP ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ''}`);
        }
        const json = await res.json();
        const cur = json?.current;
        if (!cur) {
          throw new Error('Open-Meteo returned no current weather');
        }
        if (cur.temperature_2m != null) {
          onChange('temperature', String(Math.round(cur.temperature_2m)));
        }
        if (cur.relative_humidity_2m != null) {
          onChange('humidity', String(Math.round(cur.relative_humidity_2m)));
        }
        if (cur.wind_speed_10m != null) {
          onChange('windSpeed', String(Math.round(cur.wind_speed_10m)));
        }
        if (cur.wind_direction_10m != null) {
          onChange('windDirection', degreesToCompass(Number(cur.wind_direction_10m)));
        }
        setGpsStatus('Location and weather filled in!');
        setTimeout(() => setGpsStatus(''), 3000);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[weather] Open-Meteo direct fetch failed:', e);
        setGpsStatus(`Weather lookup failed: ${e?.message || 'network error'}. Coordinates were saved — enter weather manually.`);
      }
      setWeatherLoading(false);
    } catch (err: any) {
      const code = err?.code;
      const msg =
        code === 1 ? 'Location permission denied. Allow location access in your browser to use GPS autofill.'
        : code === 2 ? 'Location unavailable on this device right now.'
        : code === 3 ? 'Location request timed out. Try again with a clear view of the sky.'
        : (err?.message || 'Location unavailable');
      // eslint-disable-next-line no-console
      console.error('[TrackInfo] geolocation failed:', err);
      setGpsStatus(msg);
    } finally {
      setGpsLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] text-sm placeholder-[#9CA3AF]";
  const labelClass = "block text-xs font-semibold text-[#4B5563] uppercase tracking-wider mb-1";

  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="track-info-heading">
      <div className="flex items-center justify-between mb-4">
        <h3 id="track-info-heading" className="text-lg font-bold text-[#1A1B23]">Track & Conditions</h3>
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          className="flex items-center gap-2 bg-[#00A8E8]/10 hover:bg-[#00A8E8]/20 text-[#00A8E8] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
          aria-busy={gpsLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
          </svg>
          {gpsLoading ? 'Locating...' : 'GPS Autofill'}
        </button>
      </div>

      {gpsStatus && (
        <div role="status" aria-live="polite" className="mb-3 text-sm text-[#00A8E8] bg-[#00A8E8]/5 px-3 py-2 rounded-lg border border-[#00A8E8]/10">
          {gpsStatus}
        </div>
      )}

      <fieldset>
        <legend className="sr-only">Track information</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor={`${prefix}-trackName`} className={labelClass}>Track Name</label>
            <input id={`${prefix}-trackName`} type="text" value={trackName} onChange={(e) => onChange('trackName', e.target.value)} className={inputClass} placeholder="Enter track name" autoComplete="off" />
          </div>
          <div>
            <label htmlFor={`${prefix}-raceDate`} className={labelClass}>Date</label>
            <input id={`${prefix}-raceDate`} type="date" value={raceDate} onChange={(e) => onChange('raceDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${prefix}-trackShape`} className={labelClass}>Track Shape</label>
            <select id={`${prefix}-trackShape`} value={trackShape} onChange={(e) => onChange('trackShape', e.target.value)} className={inputClass}>
              <option value="">Select shape</option>
              {TRACK_SHAPES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${prefix}-trackLength`} className={labelClass}>Length</label>
            <select id={`${prefix}-trackLength`} value={trackLength} onChange={(e) => onChange('trackLength', e.target.value)} className={inputClass}>
              <option value="">Select length</option>
              {TRACK_LENGTHS.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${prefix}-trackCondition`} className={labelClass}>Track Condition</label>
            <select id={`${prefix}-trackCondition`} value={trackCondition} onChange={(e) => onChange('trackCondition', e.target.value)} className={inputClass}>
              <option value="">Select condition</option>
              <option value="heavy">Heavy / Wet</option>
              <option value="tacky">Tacky</option>
              <option value="rubbered-in">Rubbered In</option>
              <option value="dry-slick">Dry Slick</option>
              <option value="dusty">Dusty</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Weather Row */}
      <fieldset className="mt-4 pt-4 border-t border-[#E5E7EB]">
        <legend className="text-sm font-semibold text-[#4B5563] uppercase tracking-wider mb-3 flex items-center gap-2">
          Weather
          {weatherLoading && <span className="text-xs text-[#00A8E8] font-normal" role="status" aria-live="polite">Fetching...</span>}
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor={`${prefix}-temp`} className={labelClass}>Temp (&deg;F)</label>
            <input id={`${prefix}-temp`} type="number" value={temperature} onChange={(e) => onChange('temperature', e.target.value)} className={inputClass} placeholder="--" />
          </div>
          <div>
            <label htmlFor={`${prefix}-humidity`} className={labelClass}>Humidity (%)</label>
            <input id={`${prefix}-humidity`} type="number" value={humidity} onChange={(e) => onChange('humidity', e.target.value)} className={inputClass} placeholder="--" />
          </div>
          <div>
            <label htmlFor={`${prefix}-wind`} className={labelClass}>Wind (mph)</label>
            <input id={`${prefix}-wind`} type="number" value={windSpeed} onChange={(e) => onChange('windSpeed', e.target.value)} className={inputClass} placeholder="--" />
          </div>
          <div>
            <label htmlFor={`${prefix}-windDir`} className={labelClass}>Wind Dir</label>
            <input id={`${prefix}-windDir`} type="text" value={windDirection} onChange={(e) => onChange('windDirection', e.target.value)} className={inputClass} placeholder="N/S/E/W" />
          </div>
        </div>
      </fieldset>
    </section>
  );
};

export default TrackInfoSection;
