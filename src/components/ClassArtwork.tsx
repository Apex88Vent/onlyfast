import { getClassIcon, type ClassIconVariant } from '@/lib/classIcons';
import './class-artwork.css';

interface ClassArtworkProps {
  raceClass: string;
  variant: ClassIconVariant;
  className: string;
  fallbackClass?: string;
}

export default function ClassArtwork({ raceClass, variant, className, fallbackClass }: ClassArtworkProps) {
  const src = getClassIcon(raceClass, variant) || (fallbackClass && getClassIcon(fallbackClass, variant));
  if (!src) return null;

  return (
    <span className={`class-artwork ${className}`} aria-hidden="true">
      <img src={src} alt="" width={128} height={128} />
    </span>
  );
}
