import React, { useId } from 'react';
import { ROAD_TRACK_ZONES, cycleRoadHandling, readRoadHandling, roadHandlingColor, roadHandlingLabel } from '@/lib/roadTrackFeedback';

interface RoadCourseTrackProps {
  data: Record<string, string>;
  onChange: (key: string, value: string) => void;
}
// The S complex has three broad, alternating bends, with straight connectors
// on either side separating it from the two designated corners.
const sTurns = 'M535 120 L475 120 C445 120 420 130 395 150 C355 182 345 175 300 130 C270 100 245 80 205 80 L155 80';
const course = `M180 300 L625 300 C675 300 675 210 625 210 L595 210 C565 210 565 120 535 120 ${sTurns.slice('M535 120'.length)} C65 80 30 135 30 195 C30 265 95 300 180 300 Z`;
const segments = [
  'M625 300 C650 300 662.5 277.5 662.5 255', 'M662.5 255 C662.5 232.5 650 210 625 210',
  'M155 80 C65 80 30 135 30 195', 'M30 195 C30 265 95 300 180 300',
  sTurns, 'M180 300 L625 300',
];
const zoneLabels = [
  { x: 590, y: 252 }, { x: 590, y: 190 },
  { x: 145, y: 150 }, { x: 155, y: 245 },
  { x: 360, y: 205 }, { x: 395, y: 275 },
];
export default function RoadCourseTrack({ data, onChange }: RoadCourseTrackProps) {
  const headingId = useId();
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] py-6 shadow-sm" aria-labelledby={headingId}>
      <h3 id={headingId} className="px-6 text-lg font-bold text-[#1A1B23] mb-1">Road Course Handling Diagram</h3>
      <p className="px-6 text-sm text-[#6B7280] mb-4">Tap to input handling characteristics</p>
      <svg viewBox="0 -30 700 425" className="block w-full h-auto" role="group" aria-label="Interactive paved road course with low and high speed turns, one flowing left-right-left S-turn section and a straightaway">
        <path data-road-infield d={course} fill="#7CB668" pointerEvents="none" />
        <path d={course} fill="none" stroke="#9CA3AF" strokeWidth="38" strokeLinejoin="round" />
        <path d={course} fill="none" stroke="#374151" strokeWidth="32" strokeLinejoin="round" />
        <path d={course} fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="10 7" opacity="0.45" pointerEvents="none" />
        {ROAD_TRACK_ZONES.map((zone, i) => {
          const value = readRoadHandling(zone.key, data[zone.key]);
          const color = roadHandlingColor(value);
          const label = zoneLabels[i];
          const activate = () => onChange(zone.key, cycleRoadHandling(zone.key, value));
          return (
            <g key={zone.key} role="button" tabIndex={0} onClick={activate}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activate();
                }
              }}
              aria-label={`${zone.section.replace(/ Turn$/, ' Turns')} ${zone.label}: ${roadHandlingLabel(value)}. Activate to cycle.`}
              className="group cursor-pointer outline-none">
              <path data-road-zone={zone.key} d={segments[i]} fill="none" stroke="transparent" strokeWidth="48" pointerEvents="stroke" />
              <rect x={label.x - 79} y={label.y - 28} width="158" height="56" fill="transparent" />
              {/* Same box proportions, rounding, colors and typography as the
                  dirt oval's 70 × 24 SVG boxes, scaled to this diagram. */}
              <g transform={`translate(${label.x - 77} ${label.y - 26.4}) scale(2.2)`}>
                <rect data-road-input-box={zone.key} width="70" height="24" rx="6" fill={color} opacity="0.9"
                  stroke="transparent" strokeWidth="2" className="group-focus-visible:stroke-[#00A8E8]" />
                <text x="35" y="9" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold" pointerEvents="none">
                  {i < 4 ? zone.label.toUpperCase() : i === 4 ? 'S TURNS' : 'STRAIGHT'}
                </text>
                <text x="35" y="19" textAnchor="middle" fontSize="7" fill="white" opacity="0.9" pointerEvents="none">
                  {roadHandlingLabel(value)}
                </text>
              </g>
            </g>
          );
        })}
        <g data-road-section-labels fill="#00A8E8" fontSize="26" fontWeight="bold" textAnchor="middle" pointerEvents="none">
          <text x="600" y="350" aria-label="Low Speed Turns"><tspan x="600">Low Speed</tspan><tspan x="600" dy="30">Turns</tspan></text>
          <text x="115" y="5" aria-label="High Speed Turns"><tspan x="115">High Speed</tspan><tspan x="115" dy="30">Turns</tspan></text>
          <text x="360" y="80" aria-label="High Speed S Turns"><tspan x="360">High Speed</tspan><tspan x="360" dy="30">S Turns</tspan></text>
          <text x="345" y="355">Straightaway</text>
        </g>
      </svg>
    </section>
  );
}
