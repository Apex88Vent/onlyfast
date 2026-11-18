import type { CSSProperties, ReactNode } from 'react';

// Simplified interface demonstrations; no live setup or telemetry calculations.
const oval = 'M180 265 C70 265 65 110 180 110 L420 110 C535 110 530 265 420 265 Z';
const circuit = 'M163 278 C65 260 83 172 138 163 L216 151 Q244 147 235 113 Q227 70 278 73 L464 91 Q518 96 494 146 L463 202 Q447 225 410 202 L350 174 Q327 166 315 194 L292 254 Q278 293 239 284 Z';
const graph = 'M0 58 L20 54 40 30 60 37 80 20 100 23 120 48 140 53 160 34 180 15 200 24 220 22 240 46 260 56 280 33 300 16 320 21 340 39 360 27 380 11 400 16';

function Label({ x, y, children, className = '' }: { x: number; y: number; children: ReactNode; className?: string }) {
  return <text x={x} y={y} className={`of-v-label ${className}`}>{children}</text>;
}
function Panel({ x, y, width, height, title, children, className = '' }: { x: number; y: number; width: number; height: number; title?: string; children?: ReactNode; className?: string }) {
  return <g className={className} transform={`translate(${x} ${y})`}><rect width={width} height={height} rx="16" className="of-v-panel" />
    {title && <><Label x={16} y={26}>{title}</Label><path d={`M0 40 H${width}`} className="of-v-rule" /></>}{children}</g>;
}
function Trace({ road = false, compare = false }: { road?: boolean; compare?: boolean }) {
  const path = road ? circuit : oval;
  return <g className="of-v-trace">
    <path d={path} className="of-v-track-bed" strokeWidth="32" />
    <path d={path} className="of-v-track-edge" />
    {compare && <path d={path} className="of-v-reference" transform="translate(0 -8)" />}
    <path d={path} pathLength="1" className="of-v-draw" />
    <circle r="6" className="of-v-car" style={{ offsetPath: `path('${path}')` } as CSSProperties} />
    <path d="M299 94 V126" className="of-v-start-finish" strokeWidth="4" strokeDasharray="4 4" transform={road ? 'translate(30 -24)' : undefined} />
  </g>;
}
function TelemetryGraph({ x = 0, y = 0, width = 400 }: { x?: number; y?: number; width?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${width / 400} 1)`}>
    {[16, 40, 64].map(n => <path key={n} d={`M0 ${n} H400`} className="of-v-rule" />)}
    <path d={graph} className="of-v-graph" pathLength="1" />
    <path d="M145 0 V72" className="of-v-scan" />
  </g>;
}
function Hook() {
  return <>
    <g className="of-v-track-tilt"><Trace /></g>
    <Panel x={30} y={24} width={185} height={78} title="YOUR BASELINE" className="of-v-enter of-v-delay-1"><Label x={16} y={64} className="of-v-value">Setup saved <tspan className="of-v-blue">✓</tspan></Label></Panel>
    <Panel x={405} y={250} width={205} height={105} title="EVERY LAP COUNTS" className="of-v-enter of-v-delay-2"><TelemetryGraph x={16} y={43} width={174} /></Panel>
    <g className="of-v-enter of-v-delay-3"><Label x={437} y={65}>GPS SPEED</Label><Label x={437} y={94} className="of-v-big">78.4 <tspan className="of-v-unit">mph</tspan></Label></g>
    <path d="M76 108 V145 H130 M420 235 V300 H399" className="of-v-connector" />
    <Label x={36} y={343}>SETUP + FEEDBACK + PERFORMANCE</Label>
  </>;
}
function Notebook() {
  const fields = [['LF / Pressure (psi)', '12.0', '12.5', ''], ['LF / Shock', '4', '5', 'setting'], ['Front Ride Height', '4.0', '4.25', 'in'], ['Cross Weight (%)', '50.0', '50.5', '']];
  return <Panel x={42} y={27} width={556} height={328} title="SETUP NOTEBOOK / DWARF CARS">
    <rect x="17" y="54" width="140" height="29" rx="5" className="of-v-tab" /><Label x={30} y={74}>Base Setup</Label>
    <path d="M172 69 H208 M200 63 L208 69 200 75" className="of-v-connector" />
    <rect x="222" y="54" width="156" height="29" rx="5" className="of-v-active-tab" /><Label x={235} y={74} className="of-v-ink">Main Event</Label>
    <Label x={22} y={109}>FOUR CORNERS + GENERAL CHASSIS</Label><Label x={372} y={109}>BASE → RACE DAY</Label>
    {fields.map(([label, base, updated, unit], i) => <g key={label} transform={`translate(20 ${124 + i * 37})`}>
      <rect width="516" height="32" rx="4" className={i % 2 ? 'of-v-row' : 'of-v-row-blue'} />
      <Label x={10} y={21} className="of-v-field">{label}</Label><Label x={300} y={21} className="of-v-muted">{base}</Label>
      <g className="of-v-field-edit" style={{ '--of-delay': `${i * .35}s` } as CSSProperties}><Label x={379} y={21} className="of-v-value">{updated}</Label><Label x={450} y={21}>{unit}</Label></g>
    </g>)}
    <g className="of-v-saved"><circle cx="32" cy="302" r="4" className="of-v-data-point" /><Label x={46} y={307} className="of-v-blue">Changes saved to Main Event</Label></g>
  </Panel>;
}
function Assist() {
  return <>
    <path d="M35 129 Q114 8 264 65" className="of-v-track-edge" strokeWidth="24" />
    <path d="M35 129 Q100 19 262 75" pathLength="1" className="of-v-draw" />
    <g className="of-v-handling-car" transform="translate(175 45) rotate(12)"><rect x="-21" y="-11" width="42" height="22" rx="5" className="of-v-accent" /><path d="M-10 -8 V8 M9 -8 V8" stroke="white" strokeWidth="3" /></g>
    <Panel x={300} y={28} width={310} height={79} title="CORNER HANDLING DIAGRAM"><Label x={16} y={65} className="of-v-ink">Entry: Balanced · Exit: Loose</Label></Panel>
    <path d="M455 111 V142" className="of-v-data-flow" />
    <Panel x={70} y={146} width={510} height={192} title="SETUP ASSIST / ASK ONLYFAST" className="of-v-enter of-v-delay-1">
      <rect x="18" y="52" width="474" height="36" rx="6" className="of-v-row-blue" /><Label x={30} y={76} className="of-v-ink">“Loose on corner exit.”</Label>
      <g className="of-v-analyze"><Label x={20} y={112} className="of-v-blue">Setup + handling feedback + session data</Label><path d="M20 122 H480" pathLength="1" className="of-v-analysis-line" /></g>
      <g className="of-v-answer"><Label x={20} y={146} className="of-v-ink">Review rear tire pressures against your baseline.</Label><Label x={20} y={168} className="of-v-field">Make one change, then reassess the handling.</Label></g>
    </Panel>
    <Label x={85} y={364}>ILLUSTRATIVE RESPONSE · VERIFY FOR YOUR CAR</Label>
  </>;
}
function Workflow() {
  return <>
    <path d="M125 160 H517 M517 160 V288 H125 V218" className="of-v-loop" />
    {[
      { x: 26, title: '01 / SETUP', value: 'Main Event', note: 'Adjustment saved', symbol: '≡' },
      { x: 235, title: '02 / TRACK', value: 'Lap 04', note: '15.482 seconds', symbol: '⌁' },
      { x: 444, title: '03 / FEEDBACK', value: 'Corner exit', note: 'Driver notes', symbol: '+' },
    ].map((item, i) => <Panel key={item.title} x={item.x} y={75} width={170} height={164} title={item.title} className={`of-v-enter of-v-delay-${i + 1}`}>
      <Label x={18} y={82} className="of-v-symbol">{item.symbol}</Label><Label x={18} y={116} className="of-v-value">{item.value}</Label><Label x={18} y={143}>{item.note}</Label>
    </Panel>)}
    <path d="M198 157 H231 M221 151 L231 157 221 163 M406 157 H440 M430 151 L440 157 430 163" className="of-v-data-flow" />
    <Label x={198} y={323} className="of-v-ink">A SMARTER NEXT ADJUSTMENT</Label>
  </>;
}
function TrackTrace() {
  return <Panel x={20} y={20} width={600} height={340} title="ONLYFAST TRACK TRACE / SAVED SESSION">
    <Label x={518} y={26} className="of-v-blue">BETA</Label>
    <g transform="translate(-32 23) scale(.8)"><Trace road /></g>
    <g className="of-v-enter of-v-delay-1"><Label x={419} y={77}>GPS SPEED · MAX</Label><Label x={419} y={110} className="of-v-big">78.4 <tspan className="of-v-unit">mph</tspan></Label>
      <path d="M418 128 H577" className="of-v-rule" /><Label x={419} y={152}>COMPLETED LAPS</Label><Label x={419} y={185} className="of-v-big">06</Label><Label x={419} y={219}>BEST LAP</Label><Label x={419} y={247} className="of-v-value">15.482 s</Label></g>
    <TelemetryGraph x={22} y={257} width={350} /><Label x={419} y={304}>RECORDED GPS</Label><Label x={419} y={323}>Speed + position</Label>
  </Panel>;
}
function FindTime() {
  return <Panel x={28} y={26} width={584} height={330} title="TRACK TRACE / LAP & SECTOR RESULTS">
    <g transform="translate(-28 -2) scale(.56)"><Trace road compare /></g>
    <Label x={330} y={78}>LAP 03</Label><Label x={330} y={110} className="of-v-big">15.802 <tspan className="of-v-unit">s</tspan></Label>
    <Label x={330} y={142} className="of-v-blue">LAP 04</Label><Label x={330} y={174} className="of-v-big of-v-blue">15.482 <tspan className="of-v-unit">s</tspan></Label>
    <path d="M20 196 H564" className="of-v-rule" />
    {['SECTOR 1', 'SECTOR 2', 'SECTOR 3'].map((label, i) => <g key={label} transform={`translate(${22 + i * 188} 218)`}>
      <Label x={0} y={0}>{label}</Label><rect y="15" width="150" height="5" rx="2" className="of-v-reference-bar" />
      <rect y="29" width={[149, 145, 147][i]} height="5" rx="2" className="of-v-sector" style={{ '--of-delay': `${i * .25}s` } as CSSProperties} />
      <Label x={0} y={57} className="of-v-ink">{['5.191', '4.752', '5.539'][i]} s</Label>
    </g>)}
    <Label x={22} y={310}>LAP 04 VS LAP 03</Label><Label x={380} y={310} className="of-v-blue">0.320 s quicker</Label>
  </Panel>;
}
function Weekend() {
  return <Panel x={35} y={27} width={570} height={327} title="YOUR RACE WEEKEND">
    <Panel x={16} y={56} width={249} height={244} title="RACE SCHEDULE" className="of-v-assemble of-v-delay-1">
      <Label x={16} y={69} className="of-v-value">Saturday / Race day</Label>
      {['Hot Laps', 'Heat Race', 'Main Event'].map((label, i) => <g key={label} transform={`translate(16 ${91 + i * 45})`}><rect width="4" height="29" rx="2" className="of-v-accent" /><Label x={16} y={12} className="of-v-ink">{label}</Label><Label x={16} y={30}>{['Find the balance', 'Build on the baseline', 'Put it all together'][i]}</Label></g>)}
    </Panel>
    <Panel x={280} y={56} width={274} height={111} title="SESSION NOTES" className="of-v-assemble of-v-delay-2"><Label x={16} y={68} className="of-v-ink">Track slicking off.</Label><Label x={16} y={91}>Check exit balance next session.</Label></Panel>
    <Panel x={280} y={182} width={274} height={118} title="TIMING RESULTS" className="of-v-assemble of-v-delay-3"><Label x={16} y={70}>FASTEST LAP</Label><Label x={150} y={70} className="of-v-value">15.482 s</Label><Label x={16} y={98}>FINISH</Label><Label x={150} y={98} className="of-v-value">P3</Label></Panel>
  </Panel>;
}
function Close() {
  return <>
    <g className="of-v-converge of-v-converge-left"><Panel x={28} y={51} width={167} height={79} title="SETUP NOTEBOOK"><path d="M16 56 H145 M16 66 H100" className="of-v-connector" /></Panel></g>
    <g className="of-v-converge of-v-converge-right"><Panel x={445} y={51} width={167} height={79} title="SETUP ASSIST"><path d="M16 56 H145 M16 66 H100" className="of-v-connector" /></Panel></g>
    <g className="of-v-converge of-v-converge-bottom"><Panel x={227} y={274} width={186} height={77} title="TRACK TRACE"><TelemetryGraph x={16} y={43} width={152} /></Panel></g>
    <path d="M194 95 L285 177 M446 95 L355 177 M320 275 V218" className="of-v-data-flow" />
    <g className="of-v-logo-focus"><rect x="135" y="139" width="370" height="105" rx="12" className="of-v-logo-card" /><image href="/onlyfast-logo.png" x="152" y="149" width="336" height="85" preserveAspectRatio="xMidYMid meet" /></g>
  </>;
}

const scenes = [Hook, Notebook, Assist, Workflow, TrackTrace, FindTime, Weekend, Close];
// Phone compositions keep key fields readable instead of shrinking a desktop panel.
function MobileCircuit({ ovalTrack = false }: { ovalTrack?: boolean }) {
  const path = ovalTrack ? 'M92 181 C18 181 18 80 92 80 L267 80 C342 80 342 181 267 181 Z'
    : 'M76 177 C18 165 31 107 71 102 L122 94 Q142 92 137 70 Q133 46 166 49 L285 61 Q317 65 302 94 L282 130 Q273 145 248 130 L208 112 Q191 107 183 126 L169 164 Q159 188 136 182 Z';
  return <g><path d={path} className="of-v-track-bed" strokeWidth="24" /><path d={path} className="of-v-track-edge" /><path d={path} pathLength="1" className="of-v-draw" /><circle r="5" className="of-v-car" style={{ offsetPath: `path('${path}')` } as CSSProperties} /></g>;
}
function MobileHook() {
  return <><MobileCircuit ovalTrack /><Label x={21} y={34} className="of-v-blue">YOUR NEXT LAP. BETTER INFORMED.</Label>
    <Panel x={10} y={215} width={164} height={57}><Label x={12} y={21}>YOUR BASELINE</Label><Label x={12} y={44} className="of-v-value">Setup saved ✓</Label></Panel>
    <Panel x={186} y={215} width={164} height={57}><Label x={12} y={21}>GPS SPEED</Label><Label x={12} y={44} className="of-v-value">78.4 mph</Label></Panel>
    <path d="M90 184 V211 M266 184 V211" className="of-v-data-flow" />
  </>;
}
function MobileNotebook() {
  return <Panel x={5} y={8} width={350} height={262} title="SETUP NOTEBOOK / DWARF CARS">
    <Label x={14} y={64} className="of-v-blue">BASE SETUP → MAIN EVENT</Label>
    {[
      ['LF / Pressure (psi)', '12.5'], ['LF / Shock', '5'], ['Front Ride Height', '4.25 in'], ['Cross Weight (%)', '50.5'],
    ].map(([name, value], i) => <g key={name} transform={`translate(14 ${82 + i * 36})`}><rect width="322" height="31" rx="4" className="of-v-row-blue" /><Label x={10} y={21} className="of-v-field">{name}</Label><g className="of-v-field-edit" style={{ '--of-delay': `${i * .35}s` } as CSSProperties}><Label x={240} y={21} className="of-v-value">{value}</Label></g></g>)}
    <g className="of-v-saved"><Label x={16} y={247} className="of-v-blue">✓ Changes saved to Main Event</Label></g>
  </Panel>;
}
function MobileAssist() {
  return <>
    <Panel x={6} y={6} width={348} height={68}><Label x={16} y={24}>CORNER HANDLING / EXIT</Label><Label x={16} y={51} className="of-v-value">“Loose on corner exit.”</Label></Panel>
    <path d="M180 77 V105" className="of-v-data-flow" />
    <Panel x={6} y={108} width={348} height={164} title="SETUP ASSIST / ASK ONLYFAST">
      <Label x={16} y={65} className="of-v-blue">Setup + handling + session data</Label><path d="M16 80 H330" pathLength="1" className="of-v-analysis-line" />
      <g className="of-v-answer"><Label x={16} y={108} className="of-v-field">Review rear tire pressures</Label><Label x={16} y={129} className="of-v-field">against your baseline.</Label><Label x={16} y={151}>One change. Then reassess.</Label></g>
    </Panel>
  </>;
}
function MobileWorkflow() {
  return <>
    {[['01 / SETUP', 'Main Event · Adjustment saved'], ['02 / TRACK', 'Lap 04 · 15.482 seconds'], ['03 / FEEDBACK', 'Corner exit · Driver notes']].map(([name, value], i) => <Panel key={name} x={10} y={8 + i * 90} width={340} height={71} className={`of-v-enter of-v-delay-${i + 1}`}><Label x={16} y={25} className="of-v-blue">{name}</Label><Label x={16} y={51} className="of-v-field">{value}</Label></Panel>)}
    <path d="M180 81 V94 M180 171 V184" className="of-v-data-flow" />
    <Label x={20} y={278}>A SMARTER NEXT ADJUSTMENT</Label>
  </>;
}
function MobileTrace() {
  return <><Label x={12} y={22}>TRACK TRACE / SAVED SESSION</Label><Label x={306} y={22} className="of-v-blue">BETA</Label><MobileCircuit />
    <Panel x={8} y={205} width={166} height={67}><Label x={12} y={22}>GPS SPEED · MAX</Label><Label x={12} y={51} className="of-v-big">78.4 <tspan className="of-v-unit">mph</tspan></Label></Panel>
    <Panel x={186} y={205} width={166} height={67}><Label x={12} y={22}>BEST OF 6 LAPS</Label><Label x={12} y={51} className="of-v-big">15.482 <tspan className="of-v-unit">s</tspan></Label></Panel>
  </>;
}
function MobileTime() {
  return <Panel x={6} y={8} width={348} height={262} title="TRACK TRACE / LAP RESULTS">
    <Label x={16} y={79}>LAP 03</Label><Label x={175} y={79} className="of-v-big">15.802 <tspan className="of-v-unit">s</tspan></Label>
    <Label x={16} y={125} className="of-v-blue">LAP 04</Label><Label x={175} y={125} className="of-v-big of-v-blue">15.482 <tspan className="of-v-unit">s</tspan></Label>
    <path d="M16 146 H331" className="of-v-rule" />
    {['S1 / 5.191', 'S2 / 4.752', 'S3 / 5.539'].map((label, i) => <g key={label} transform={`translate(${16 + i * 110} 171)`}><Label x={0} y={0}>{label}</Label><rect y="12" width="93" height="4" className="of-v-reference-bar" /><rect y="23" width={[92, 90, 91][i]} height="4" className="of-v-sector" /></g>)}
    <Label x={16} y={239} className="of-v-blue">LAP 04 / 0.320 s quicker</Label>
  </Panel>;
}
function MobileWeekend() {
  return <>{[
    ['RACE SCHEDULE', 'Hot Laps → Heat Race → Main Event'], ['SESSION NOTES', 'Track slicking off. Check exit balance.'], ['TIMING RESULTS', 'Fastest 15.482 s / Finish P3'],
  ].map(([name, value], i) => <Panel key={name} x={6} y={8 + i * 90} width={348} height={79} title={name} className={`of-v-assemble of-v-delay-${i + 1}`}><Label x={16} y={65} className="of-v-field">{value}</Label></Panel>)}</>;
}
function MobileClose() {
  return <>
    <g className="of-v-converge of-v-converge-left"><Panel x={8} y={14} width={164} height={56}><Label x={15} y={33}>SETUP NOTEBOOK</Label></Panel></g>
    <g className="of-v-converge of-v-converge-right"><Panel x={188} y={14} width={164} height={56}><Label x={25} y={33}>SETUP ASSIST</Label></Panel></g>
    <path d="M90 73 L145 112 M270 73 L215 112 M180 192 V224" className="of-v-data-flow" />
    <g className="of-v-logo-focus"><rect x="28" y="114" width="304" height="79" rx="8" className="of-v-logo-card" /><image href="/onlyfast-logo.png" x="40" y="122" width="280" height="63" preserveAspectRatio="xMidYMid meet" /></g>
    <g className="of-v-converge of-v-converge-bottom"><Panel x={96} y={226} width={168} height={48}><Label x={25} y={29}>TRACK TRACE</Label></Panel></g>
  </>;
}
const mobileScenes = [MobileHook, MobileNotebook, MobileAssist, MobileWorkflow, MobileTrace, MobileTime, MobileWeekend, MobileClose];
const descriptions = [
  'A racing line draws around an oval as saved setup and GPS speed data appear.',
  'A Dwarf Cars base setup becomes a Main Event setup. Left Front pressure and shock settings, front ride height and cross weight are recorded and saved.',
  'Loose corner-exit feedback and setup data enter Setup Assist and produce an illustrative recommendation to review rear tire pressures and reassess one change at a time.',
  'A saved setup connects to recorded track results and driver feedback for the next adjustment.',
  'A GPS position marker follows a circuit trace with recorded speed, completed laps and best lap time.',
  'Two illustrative recorded laps show 15.802 and 15.482 seconds, a 0.320-second difference, with sector results.',
  'Race schedule, session notes and timing results assemble into a race weekend overview.',
  'Setup Notebook, Setup Assist and Track Trace converge on the official OnlyFast logo.',
];
export default function OnboardingVisual({ slide }: { slide: number }) {
  const Scene = scenes[slide];
  const MobileScene = mobileScenes[slide];
  return <figure className="of-intro-demo" aria-label={descriptions[slide]}>
    <svg className="of-v-wide" viewBox="0 0 640 380" fill="none" aria-hidden="true" focusable="false"><Scene /></svg>
    <svg className="of-v-mobile" viewBox="0 0 360 280" fill="none" aria-hidden="true" focusable="false"><MobileScene /></svg>
    <figcaption>ILLUSTRATIVE DATA{slide === 4 || slide === 5 ? ' · TRACK TRACE BETA' : ' · ONLYFAST 2027'}</figcaption>
  </figure>;
}
