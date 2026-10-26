// Shared class artwork registry. Class IDs, availability and layout live elsewhere.
export type ClassIconVariant = 'blue' | 'white';

const iconVariants = (path: string): Record<ClassIconVariant, string> => ({
  blue: `/onlyfast-class-icons/${path}-blue.png`,
  white: `/onlyfast-class-icons/${path}-white.png`,
});
const pavementLegends = iconVariants('pavement-oval/legends/legends');
const gt3 = iconVariants('road-course/gt3/gt3');
const gt4 = iconVariants('road-course/gt4/gt4');
const prototypes = iconVariants('road-course/prototypes/prototypes');
const wingedFormula = iconVariants('road-course/winged-open-wheel-formula/winged-open-wheel-formula');
const nonWingedFormula = iconVariants('road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula');
const karts = iconVariants('road-course/go-karts/go-karts');
const touringCar = iconVariants('road-course/touring-car-tcr/touring-car-tcr');

// The pre-existing Dirt Track paths below are preserved verbatim.
export const CLASS_ICONS: Record<string, { blue: string; white: string }> = {
  'Dwarf Cars': {
    blue: '/onlyfast-class-icons/dwarf/dwarf-blue.png',
    white: '/onlyfast-class-icons/dwarf/dwarf-white.png',
  },
  'Late Model': {
    blue: '/onlyfast-class-icons/dirt-late-model/dirt-late-model-blue.png',
    white: '/onlyfast-class-icons/dirt-late-model/dirt-late-model-white.png',
  },
  'Lightning Sprints': {
    blue: '/onlyfast-class-icons/lightning-sprint/lightning-sprint-blue.png',
    white: '/onlyfast-class-icons/lightning-sprint/lightning-sprint-white.png',
  },
  'Midgets': {
    blue: '/onlyfast-class-icons/midget/midget-blue.png',
    white: '/onlyfast-class-icons/midget/midget-white.png',
  },
  'Modified': {
    blue: '/onlyfast-class-icons/modified/modified-blue.png',
    white: '/onlyfast-class-icons/modified/modified-white.png',
  },
  'Non-Wing Sprint Cars': {
    blue: '/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-blue.png',
    white: '/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-white.png',
  },
  'Pro Stock': {
    blue: '/onlyfast-class-icons/pure-stock/pure-stock-blue.png',
    white: '/onlyfast-class-icons/pure-stock/pure-stock-white.png',
  },
  'Pure Stock': {
    blue: '/onlyfast-class-icons/pure-stock/pure-stock-blue.png',
    white: '/onlyfast-class-icons/pure-stock/pure-stock-white.png',
  },
  'Sport Compact': {
    blue: '/onlyfast-class-icons/sport-compact/sport-compact-blue.png',
    white: '/onlyfast-class-icons/sport-compact/sport-compact-white.png',
  },
  'Sport Mod': {
    blue: '/onlyfast-class-icons/modified/modified-blue.png',
    white: '/onlyfast-class-icons/modified/modified-white.png',
  },
  'Winged Sprint Cars': {
    blue: '/onlyfast-class-icons/winged-sprint/winged-sprint-blue.png',
    white: '/onlyfast-class-icons/winged-sprint/winged-sprint-white.png',
  },
  'Legends': pavementLegends,
  'Pavement Late Model': iconVariants('pavement-oval/pavement-late-model/pavement-late-model'),
  'Pavement Modified': iconVariants('pavement-oval/pavement-modified/pavement-modified'),
  'Stock Car / ARCA': iconVariants('pavement-oval/stock-car-arca/stock-car-arca'),
  'Street Stock / Sportsman': iconVariants('pavement-oval/street-stock-sportsman/street-stock-sportsman'),
  'Mini Stock / Compact': iconVariants('pavement-oval/mini-stock-compact/mini-stock-compact'),
  road_spec_miata: iconVariants('road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata'),
  road_gt3: gt3,
  road_gt4: gt4,
  road_prototypes: prototypes,
  road_formula_winged: wingedFormula,
  road_formula_non_winged: nonWingedFormula,
  road_karts: karts,
  road_legends: pavementLegends,
  road_tcr: touringCar,
  road_ta2: iconVariants('road-course/trans-am-ta2/trans-am-ta2'),
  // Existing saved/class-change keys retain their identity and share the matching art.
  'GT3': gt3,
  'GT4': gt4,
  'Prototype': prototypes,
  'Touring Car': touringCar,
  'Formula Ford 1600 / FF1600': nonWingedFormula,
  'Formula Ford 2000 / FF2000': wingedFormula,
  'Formula Continental': wingedFormula,
  'F2000': wingedFormula,
  'Formula Mazda': wingedFormula,
  'Formula Vee': nonWingedFormula,
  'Formula Atlantic': wingedFormula,
  'Formula 4': wingedFormula,
  'Junior Formula': nonWingedFormula,
  'Shifter Kart': karts,
  'Clutch Kart': karts,
};

export function getClassIcon(className: string, variant: ClassIconVariant): string | undefined {
  return CLASS_ICONS[className]?.[variant];
}
