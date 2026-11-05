import { useId } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HOUSE_AD_PLANS_PATH, HouseInterstitialDialog } from '@/components/HouseAdPlacement';
import './house-ad-designs.css';

export const houseAdDesigns = {
  A: {
    label: 'Performance', tier: 'OnlyFast Pro', headline: ['Race Smarter.', 'Finish Faster.'],
    description: 'Plan every race weekend with unlimited setups.', action: 'Explore Pro',
  },
  B: {
    label: 'Ad-free racing', tier: 'OnlyFast Pro', headline: ['Less Distraction.', 'More Racing.'],
    description: 'Go ad-free with Pro and keep your focus on the track.', action: 'Go Pro',
  },
  C: {
    label: 'Team upgrade', tier: 'OnlyFast Team', headline: ['Every Car.', 'One Team.'],
    description: 'Manage unlimited cars and racing classes with OnlyFast Team.', action: 'Explore Team',
  },
} as const;

export type HouseAdDesign = keyof typeof houseAdDesigns;

const vehicleArt = '/rookie-ads/interstitials';
const teamClasses = [
  { name: 'Winged Sprint', discipline: 'Dirt oval', asset: 'winged-sprint' },
  { name: 'Pavement Late Model', discipline: 'Pavement oval', asset: 'late-model' },
  { name: 'GT3', discipline: 'Road course', asset: 'gt3' },
] as const;

// The mesh bends the checker squares with the cloth, then fades the whole
// flag as a single piece. It scales independently of the text and vehicles.
const flagPoint = (u: number, v: number) => {
  const x = 34 + u * 766 + (v - .5) * (58 - 112 * u);
  const y = 133 + v * (205 + 52 * u) - 116 * u
    + 63 * Math.sin(u * Math.PI * 2 + v * .72)
    + 13 * Math.sin(u * Math.PI * 4 - v * .8);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
};

const flagTiles = Array.from({ length: 48 }, (_, index) => {
  const col = index % 12;
  const row = Math.floor(index / 12);
  const left = col / 12;
  const right = (col + 1) / 12;
  const top = row / 4;
  const bottom = (row + 1) / 4;
  const edge = (x1: number, y1: number, x2: number, y2: number) =>
    Array.from({ length: 5 }, (_, step) =>
      flagPoint(x1 + (x2 - x1) * step / 4, y1 + (y2 - y1) * step / 4)).join(' ');
  const points = [
    edge(left, top, right, top), edge(right, top, right, bottom),
    edge(right, bottom, left, bottom), edge(left, bottom, left, top),
  ].join(' ');
  return { points, blue: (col + row) % 2 === 0 };
});

function CheckeredFlag() {
  const id = useId();
  return (
    <svg className="house-design__flag" viewBox="0 0 840 390" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0%" x2="100%" y1="73%" y2="22%">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset=".25" stopColor="white" stopOpacity=".45" />
          <stop offset=".6" stopColor="white" />
          <stop offset=".94" stopColor="white" stopOpacity=".73" />
          <stop offset="1" stopColor="white" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0%" x2="100%" y1="38%" y2="66%">
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset=".37" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".65" stopColor="#fff" stopOpacity="0" />
          <stop offset=".86" stopColor="#fff" stopOpacity=".62" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`} x="0" y="0" width="840" height="390" maskUnits="userSpaceOnUse">
          <rect width="840" height="390" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mask)`}>
        {flagTiles.map(({ points, blue }, index) => (
          <polygon key={index} points={points} fill={blue ? 'currentColor' : `url(#${id}-cloth)`} />
        ))}
      </g>
    </svg>
  );
}

export function HouseAdDesignDialog({ design, onClose }: { design: HouseAdDesign; onClose: () => void }) {
  const copy = houseAdDesigns[design];
  return (
    <HouseInterstitialDialog title={copy.headline.join(' ')} description={copy.description} onClose={onClose} fullScreen
      brand={<img src="/onlyfast-logo.png" alt="OnlyFast" className="house-design__logo" />}>
      <article className={`house-design house-design--${design.toLowerCase()}`}>
        <CheckeredFlag />
        <header className="house-design__lead">
          <p className="house-design__eyebrow">{copy.tier}</p>
          <h2>{copy.headline[0]} <span>{copy.headline[1]}</span></h2>
          <p className="house-design__description">{copy.description}</p>
        </header>
        {design === 'A' && (
          <div className="house-design__art house-design__art--sprint" aria-hidden="true">
            <img src={`${vehicleArt}/sprint-stylized-light.webp`} alt="" />
          </div>
        )}
        {design === 'C' && (
          <div className="house-design__art house-design__art--team">
            <div className="house-design__fleet">
              {teamClasses.map(car => <img key={car.asset} src={`${vehicleArt}/${car.asset}.webp`} alt={car.name} />)}
            </div>
            <p className="house-design__disciplines">{teamClasses.map(car => car.discipline).join(' · ')}</p>
          </div>
        )}
        <footer className="house-design__footer">
          <Link to={HOUSE_AD_PLANS_PATH} onClick={onClose} className="house-design__action">
            {copy.action} <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </footer>
      </article>
    </HouseInterstitialDialog>
  );
}
