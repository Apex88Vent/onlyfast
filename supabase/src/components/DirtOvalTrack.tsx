import React, { useCallback } from 'react';

interface DirtOvalTrackProps {
  entryHandling: string;
  midHandling: string;
  exitHandling: string;
  onEntryChange: (val: string) => void;
  onMidChange: (val: string) => void;
  onExitChange: (val: string) => void;
}

const getColor = (handling: string) => {
  switch (handling) {
    case 'loose': return '#EF4444';
    case 'tight': return '#3B82F6';
    case 'perfect': return '#22C55E';
    default: return '#9CA3AF';
  }
};

const getLabel = (handling: string) => {
  switch (handling) {
    case 'loose': return 'Loose';
    case 'tight': return 'Tight';
    case 'perfect': return 'Perfect';
    default: return 'Tap to Set';
  }
};

// Non-color-only icon indicators
const getIcon = (handling: string): string => {
  switch (handling) {
    case 'loose': return '~'; // wavy = loose
    case 'tight': return '|'; // rigid = tight
    case 'perfect': return '+'; // plus = perfect
    default: return '?';
  }
};

const DirtOvalTrack: React.FC<DirtOvalTrackProps> = ({
  entryHandling, midHandling, exitHandling,
  onEntryChange, onMidChange, onExitChange
}) => {
  const cycleHandling = useCallback((current: string) => {
    const states = ['', 'loose', 'tight', 'perfect'];
    const idx = states.indexOf(current);
    return states[(idx + 1) % states.length];
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  }, []);

  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="track-diagram-heading">
      <h3 id="track-diagram-heading" className="text-lg font-bold text-[#1A1B23] mb-1">Corner Handling Diagram</h3>
      <p className="text-sm text-[#6B7280] mb-2">Click or press Enter on each zone to cycle: Loose / Tight / Perfect</p>
      <p className="text-xs text-[#9CA3AF] mb-4">
        <span aria-hidden="true">~</span> = Loose (red), <span aria-hidden="true">|</span> = Tight (blue), <span aria-hidden="true">+</span> = Perfect (green)
      </p>

      <div className="flex flex-col items-center gap-4">
        {/* SVG Half-Track - Landscape oriented */}
        <div className="w-full" role="img" aria-label="Half-track diagram showing turns 1 and 2 with three clickable zones: Entry, Mid, and Exit">
          <svg viewBox="0 0 600 280" className="w-full" aria-hidden="true">
            <defs>
              <linearGradient id="dirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C4A882" />
                <stop offset="100%" stopColor="#B89B72" />
              </linearGradient>
              <linearGradient id="infieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7CB668" />
                <stop offset="100%" stopColor="#6AA856" />
              </linearGradient>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#1A1B23" opacity="0.4" />
              </marker>
            </defs>

            {/* Background */}
            <rect x="0" y="0" width="600" height="280" fill="#F9FAFB" rx="12" />

            {/* Outer track boundary */}
            <path d="M 580 40 L 200 40 A 100 100 0 0 0 200 240 L 580 240" fill="url(#dirtGrad)" stroke="#A08560" strokeWidth="2" />

            {/* Inner track boundary */}
            <path d="M 580 80 L 240 80 A 60 60 0 0 0 240 200 L 580 200" fill="url(#infieldGrad)" stroke="#5A9A48" strokeWidth="2" />

            {/* Racing line */}
            <path d="M 580 60 L 220 60 A 80 80 0 0 0 220 220 L 580 220" fill="none" stroke="#1A1B23" strokeWidth="1.5" strokeDasharray="10 5" opacity="0.12" />

            {/* Direction arrows */}
            <line x1="480" y1="55" x2="400" y2="55" stroke="#1A1B23" strokeWidth="2" markerEnd="url(#arrowhead)" opacity="0.3" />
            <text x="440" y="35" textAnchor="middle" fontSize="10" fill="#6B7280" fontWeight="500">Front Stretch</text>

            <line x1="400" y1="225" x2="480" y2="225" stroke="#1A1B23" strokeWidth="2" markerEnd="url(#arrowhead)" opacity="0.3" />
            <text x="440" y="252" textAnchor="middle" fontSize="10" fill="#6B7280" fontWeight="500">Back Stretch</text>

            {/* S/F Line */}
            <line x1="540" y1="40" x2="540" y2="80" stroke="#1A1B23" strokeWidth="3" opacity="0.5" />
            <text x="540" y="30" textAnchor="middle" fontSize="9" fill="#6B7280" fontWeight="bold">S/F</text>

            {/* Zone dividers */}
            <path d="M 200 40 A 100 100 0 0 0 130 90" fill="none" stroke="#1A1B23" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
            <path d="M 240 80 A 60 60 0 0 0 195 110" fill="none" stroke="#1A1B23" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
            <path d="M 130 190 A 100 100 0 0 0 200 240" fill="none" stroke="#1A1B23" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
            <path d="M 195 170 A 60 60 0 0 0 240 200" fill="none" stroke="#1A1B23" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />

            {/* ENTRY ZONE */}
            <g
              onClick={() => onEntryChange(cycleHandling(entryHandling))}
              onKeyDown={(e) => handleKeyDown(e, () => onEntryChange(cycleHandling(entryHandling)))}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Entry zone: ${entryHandling || 'not set'}. Press Enter to cycle handling.`}
            >
              <path d="M 350 40 L 200 40 A 100 100 0 0 0 140 80 L 210 100 A 60 60 0 0 1 240 80 L 350 80 Z" fill={getColor(entryHandling)} opacity="0.25" stroke={getColor(entryHandling)} strokeWidth="2" />
              {/* Non-color indicator pattern for entry */}
              {entryHandling && (
                <text x="330" y="63" textAnchor="middle" fontSize="12" fill={getColor(entryHandling)} fontWeight="bold" opacity="0.6">{getIcon(entryHandling)}</text>
              )}
              <rect x="270" y="48" width="70" height="24" rx="6" fill={getColor(entryHandling)} opacity="0.9" />
              <text x="305" y="57" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">ENTRY</text>
              <text x="305" y="67" textAnchor="middle" fontSize="7" fill="white" opacity="0.9">{getLabel(entryHandling)}</text>
            </g>

            {/* MID ZONE */}
            <g
              onClick={() => onMidChange(cycleHandling(midHandling))}
              onKeyDown={(e) => handleKeyDown(e, () => onMidChange(cycleHandling(midHandling)))}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Mid zone: ${midHandling || 'not set'}. Press Enter to cycle handling.`}
            >
              <path d="M 140 80 A 100 100 0 0 0 140 200 L 195 170 A 60 60 0 0 1 195 110 Z" fill={getColor(midHandling)} opacity="0.25" stroke={getColor(midHandling)} strokeWidth="2" />
              {midHandling && (
                <text x="155" y="145" textAnchor="middle" fontSize="12" fill={getColor(midHandling)} fontWeight="bold" opacity="0.6">{getIcon(midHandling)}</text>
              )}
              <rect x="110" y="128" width="60" height="24" rx="6" fill={getColor(midHandling)} opacity="0.9" />
              <text x="140" y="137" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">MID</text>
              <text x="140" y="147" textAnchor="middle" fontSize="7" fill="white" opacity="0.9">{getLabel(midHandling)}</text>
            </g>

            {/* EXIT ZONE */}
            <g
              onClick={() => onExitChange(cycleHandling(exitHandling))}
              onKeyDown={(e) => handleKeyDown(e, () => onExitChange(cycleHandling(exitHandling)))}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Exit zone: ${exitHandling || 'not set'}. Press Enter to cycle handling.`}
            >
              <path d="M 140 200 A 100 100 0 0 0 200 240 L 350 240 L 350 200 L 240 200 A 60 60 0 0 1 195 170 Z" fill={getColor(exitHandling)} opacity="0.25" stroke={getColor(exitHandling)} strokeWidth="2" />
              {exitHandling && (
                <text x="330" y="223" textAnchor="middle" fontSize="12" fill={getColor(exitHandling)} fontWeight="bold" opacity="0.6">{getIcon(exitHandling)}</text>
              )}
              <rect x="270" y="208" width="70" height="24" rx="6" fill={getColor(exitHandling)} opacity="0.9" />
              <text x="305" y="217" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">EXIT</text>
              <text x="305" y="227" textAnchor="middle" fontSize="7" fill="white" opacity="0.9">{getLabel(exitHandling)}</text>
            </g>

            {/* Turn labels */}
            <text x="210" y="136" textAnchor="middle" fontSize="14" fill="#1A1B23" fontWeight="bold" opacity="0.15">TURNS</text>
            <text x="210" y="152" textAnchor="middle" fontSize="14" fill="#1A1B23" fontWeight="bold" opacity="0.15">1 &amp; 2</text>

            {/* Cutoff indicator */}
            <line x1="580" y1="40" x2="580" y2="240" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="6 3" opacity="0.4" />
            <text x="575" y="145" textAnchor="end" fontSize="8" fill="#9CA3AF" opacity="0.6" transform="rotate(-90, 575, 145)">Straightaway continues</text>
          </svg>
        </div>

        {/* Legend - uses both color AND text/shape for non-color-only cues */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2" role="list" aria-label="Handling legend">
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-4 h-4 rounded-full bg-[#EF4444] flex items-center justify-center text-white text-[8px] font-bold" aria-hidden="true">~</div>
            <span className="text-sm text-[#4B5563]">Loose (Red)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-4 h-4 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-[8px] font-bold" aria-hidden="true">|</div>
            <span className="text-sm text-[#4B5563]">Tight (Blue)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-4 h-4 rounded-full bg-[#22C55E] flex items-center justify-center text-white text-[8px] font-bold" aria-hidden="true">+</div>
            <span className="text-sm text-[#4B5563]">Perfect (Green)</span>
          </div>
          <div className="flex items-center gap-2" role="listitem">
            <div className="w-4 h-4 rounded-full bg-[#9CA3AF] flex items-center justify-center text-white text-[8px] font-bold" aria-hidden="true">?</div>
            <span className="text-sm text-[#4B5563]">Not Set (Gray)</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DirtOvalTrack;
