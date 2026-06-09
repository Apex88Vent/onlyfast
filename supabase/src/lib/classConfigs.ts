// Class-specific setup configurations for dirt track racing
// Each class has unique chassis, suspension, aero, drivetrain, and weight fields

export interface FieldDef {
  label: string;
  key: string;
  type?: 'text' | 'number' | 'select';
  placeholder?: string;
  step?: string;
  options?: { value: string; label: string }[];
}

export interface ClassSection {
  id: string;
  title: string;
  icon: string; // SVG path or identifier
  fields: FieldDef[];
}

export interface ClassConfig {
  name: string;
  description: string;
  showWingAero: boolean;
  showWeightBalance: boolean;
  showDrivechain: boolean; // sprocket/chain vs gear ratio
  generalFields: FieldDef[];
  frontCornerFields: FieldDef[];
  rearCornerFields: FieldDef[];
  suspensionFields: FieldDef[];
  extraSections: ClassSection[];
}

const pressureField = (placeholder = 'psi'): FieldDef => ({ label: 'Pressure (psi)', key: 'pressure', type: 'number', placeholder });
const shockField: FieldDef = { label: 'Shock', key: 'shock', placeholder: 'Shock setting' };
const springField = (placeholder = 'lbs'): FieldDef => ({ label: 'Spring (lbs)', key: 'spring', type: 'number', placeholder });
const casterField: FieldDef = { label: 'Caster', key: 'caster', type: 'text', placeholder: 'degrees (+/-)' };
const camberField: FieldDef = { label: 'Camber', key: 'camber', type: 'text', placeholder: 'degrees (+/-)' };
const tireSizeField: FieldDef = { label: 'Tire Size', key: 'tire_size', placeholder: 'e.g. 10x8' };
const wheelOffsetField: FieldDef = { label: 'Wheel Offset', key: 'wheel_offset', placeholder: 'e.g. 2"' };

// Standard front corner fields (caster, camber, pressure, shock, spring, wheel offset)
const standardFrontCorner: FieldDef[] = [casterField, camberField, pressureField(), shockField, springField(), wheelOffsetField];

// Basic front corner (pressure, shock, spring, wheel offset)
const basicFrontCorner: FieldDef[] = [pressureField(), shockField, springField(), wheelOffsetField];

// Standard rear corner fields
const standardRearCorner: FieldDef[] = [tireSizeField, pressureField(), shockField, springField(), wheelOffsetField];

// Basic rear corner (pressure, shock, spring, wheel offset)
const basicRearCorner: FieldDef[] = [tireSizeField, pressureField(), shockField, springField(), wheelOffsetField];

// Generate ride height options in 8ths of an inch (0 to 8 inches)
const rideHeightOptions: { value: string; label: string }[] = [
  { value: '', label: 'Select' },
];
for (let whole = 0; whole <= 12; whole++) {
  for (let eighth = 0; eighth < 8; eighth++) {
    if (whole === 0 && eighth === 0) {
      rideHeightOptions.push({ value: '0', label: '0"' });
      continue;
    }
    const totalEighths = whole * 8 + eighth;
    const decimalValue = (totalEighths / 8).toString();
    
    if (eighth === 0) {
      rideHeightOptions.push({ value: decimalValue, label: `${whole}"` });
    } else {
      // Simplify fraction
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const g = gcd(eighth, 8);
      const num = eighth / g;
      const den = 8 / g;
      rideHeightOptions.push({ value: decimalValue, label: `${whole > 0 ? whole : ''}${whole > 0 ? ' ' : ''}${num}/${den}"` });
    }
  }
}

// Generate toe options (positive only, 0 to 1/2" in 32nds)
const toeOptions: { value: string; label: string }[] = [
  { value: '', label: 'Select Toe' },
  { value: '0', label: '0"' },
];
for (let i = 1; i <= 16; i++) {
  let num = i;
  let den = 32;
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const g = gcd(num, den);
  num = num / g;
  den = den / g;
  toeOptions.push({ value: `${i}/32`, label: `${num}/${den}"` });
}

// Cross weight turns options in 1/2 turn increments, from -5 to +5
const crossWeightTurnsOptions: { value: string; label: string }[] = [
  { value: '', label: 'No Change' },
];
for (let i = -10; i <= 10; i++) {
  const val = i / 2;
  const sign = val > 0 ? '+' : '';
  const suffix = Math.abs(val) === 1 ? 'turn' : 'turns';
  crossWeightTurnsOptions.push({ value: val.toString(), label: `${sign}${val} ${suffix}` });
}

export { rideHeightOptions, toeOptions, crossWeightTurnsOptions };

// Standard general chassis fields
const standardGeneral: FieldDef[] = [
  { label: 'Cross Weight (%)', key: 'cross_weight', type: 'number', placeholder: '50.0' },
  { label: 'Toe', key: 'toe', type: 'select' },
  { label: 'Front Ride Height', key: 'front_ride_height', type: 'select' },
  { label: 'Rear Ride Height', key: 'rear_ride_height', type: 'select' },
  { label: 'Stagger', key: 'stagger', type: 'number', step: '0.25', placeholder: 'inches' },
];

// Standard suspension fields
const standardSuspension: FieldDef[] = [
  { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
  { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
  { label: 'Third Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
  { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
  { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.86' },
];


const weightBalanceSection: ClassSection = {
  id: 'weight-balance',
  title: 'Weight & Balance',
  icon: 'weight',
  fields: [
    { label: 'Total Weight (lbs)', key: 'total_weight', type: 'number', placeholder: 'lbs' },
    { label: 'Left Side %', key: 'left_side_pct', type: 'number', step: '0.1', placeholder: '%' },
    { label: 'Rear Weight %', key: 'rear_weight_pct', type: 'number', step: '0.1', placeholder: '%' },
    { label: 'Lead Location', key: 'lead_location', placeholder: 'e.g. LR frame' },
    { label: 'Lead Weight (lbs)', key: 'lead_weight', type: 'number', placeholder: 'lbs' },
  ],
};

export const CAR_CLASSES: string[] = [
  'Dwarf Cars',
  'Late Model',
  'Lightning Sprints',
  'Midgets',
  'Modified',
  'Non-Wing Sprint Cars',
  'Pro Stock',
  'Pure Stock',
  'Sport Compact',
  'Sport Mod',
];

export const CLASS_CONFIGS: Record<string, ClassConfig> = {
  'Dwarf Cars': {
    name: 'Dwarf Cars',
    description: '5/8 scale vintage-bodied race cars with motorcycle engines',
    showWingAero: false,
    showWeightBalance: false,
    showDrivechain: false,
    generalFields: standardGeneral,
    frontCornerFields: standardFrontCorner,
    rearCornerFields: standardRearCorner,
    suspensionFields: standardSuspension,
    extraSections: [],
  },

  'Late Model': {
    name: 'Late Model',
    description: 'Full-bodied, high-horsepower dirt track race cars with advanced suspension',
    showWingAero: false,
    showWeightBalance: true,
    showDrivechain: false,
    generalFields: [
      ...standardGeneral,
      { label: 'Bite / LR Weight', key: 'bite', type: 'number', placeholder: 'lbs' },
    ],
    frontCornerFields: [
      casterField, camberField, pressureField(),
      { label: 'Shock Comp', key: 'shock_comp', placeholder: 'Compression' },
      { label: 'Shock Reb', key: 'shock_reb', placeholder: 'Rebound' },
      springField(), wheelOffsetField,
    ],
    rearCornerFields: [
      tireSizeField, pressureField(),
      { label: 'Shock Comp', key: 'shock_comp', placeholder: 'Compression' },
      { label: 'Shock Reb', key: 'shock_reb', placeholder: 'Rebound' },
      springField(), wheelOffsetField,
    ],
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Pull Bar / 3rd Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar Height', key: 'panhard_bar', placeholder: 'Height from ground' },
      { label: 'Panhard Bar Angle', key: 'panhard_angle', placeholder: 'degrees' },
    ],

    extraSections: [
      {
        id: 'late-model-extras',
        title: 'Late Model Specifics',
        icon: 'car',
        fields: [
          { label: 'Sway Bar Dia.', key: 'sway_bar', placeholder: 'inches' },
          { label: 'Weight Jacker', key: 'weight_jacker', placeholder: 'turns/setting' },
          { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.86' },
          { label: 'Spoiler Angle', key: 'spoiler_angle', type: 'number', placeholder: 'degrees' },
          { label: 'Spoiler Height', key: 'spoiler_height', placeholder: 'inches' },
        ],
      },
      weightBalanceSection,
    ],
  },

  'Lightning Sprints': {
    name: 'Lightning Sprints',
    description: 'Lightweight open-wheel sprint cars with motorcycle powerplants',
    showWingAero: true,
    showWeightBalance: true,
    showDrivechain: true,
    generalFields: standardGeneral,
    frontCornerFields: standardFrontCorner,
    rearCornerFields: standardRearCorner,
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Third Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
    ],

    extraSections: [
      {
        id: 'wing-aero',
        title: 'Wing & Aero',
        icon: 'wing',
        fields: [
          { label: 'Top Wing Angle', key: 'top_wing_angle', type: 'number', step: '0.5', placeholder: 'degrees' },
          { label: 'Top Wing Offset', key: 'top_wing_offset', placeholder: 'e.g. 2" left' },
          { label: 'Nose Wing Angle', key: 'nose_wing_angle', type: 'number', step: '0.5', placeholder: 'degrees' },
          { label: 'Side Boards', key: 'side_boards', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'full', label: 'Full' }, { value: 'half', label: 'Half' }, { value: 'none', label: 'None' },
          ]},
          { label: 'Nerf Bar Height', key: 'nerf_bar_height', placeholder: 'inches' },
        ],
      },
      {
        id: 'drivechain',
        title: 'Drivetrain',
        icon: 'gear',
        fields: [
          { label: 'Front Sprocket', key: 'front_sprocket', type: 'number', placeholder: 'teeth' },
          { label: 'Rear Sprocket', key: 'rear_sprocket', type: 'number', placeholder: 'teeth' },
          { label: 'Chain Tension', key: 'chain_tension', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'tight', label: 'Tight' }, { value: 'medium', label: 'Medium' }, { value: 'loose', label: 'Loose' },
          ]},
          { label: 'Front Axle', key: 'front_axle', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'straight', label: 'Straight' }, { value: '1-degree', label: '1 Degree' }, { value: '2-degree', label: '2 Degree' }, { value: '3-degree', label: '3 Degree' },
          ]},
          { label: 'Fuel Mixture', key: 'fuel_mixture', placeholder: 'e.g. 14.7:1' },
          { label: 'Bumper Height', key: 'bumper_height', placeholder: 'inches' },
        ],
      },
      weightBalanceSection,
    ],
  },

  'Midgets': {
    name: 'Midgets',
    description: 'Small open-wheel midget race cars, high power-to-weight ratio',
    showWingAero: false,
    showWeightBalance: true,
    showDrivechain: false,
    generalFields: standardGeneral,
    frontCornerFields: standardFrontCorner,
    rearCornerFields: standardRearCorner,
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Third Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
      { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.86' },
    ],

    extraSections: [
      {
        id: 'midget-extras',
        title: 'Midget Specifics',
        icon: 'car',
        fields: [
          { label: 'Front Axle', key: 'front_axle', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'straight', label: 'Straight' }, { value: '1-degree', label: '1 Degree' }, { value: '2-degree', label: '2 Degree' },
          ]},
          { label: 'Nerf Bar Height', key: 'nerf_bar_height', placeholder: 'inches' },
          { label: 'Bumper Height', key: 'bumper_height', placeholder: 'inches' },
        ],
      },
      weightBalanceSection,
    ],
  },

  'Modified': {
    name: 'Modified',
    description: 'Open-wheel, tube-chassis modified race cars (IMCA/UMP style)',
    showWingAero: false,
    showWeightBalance: true,
    showDrivechain: false,
    generalFields: standardGeneral,
    frontCornerFields: standardFrontCorner,
    rearCornerFields: standardRearCorner,
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Third Link / Pull Bar', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
      { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.86' },
    ],

    extraSections: [
      {
        id: 'modified-extras',
        title: 'Modified Specifics',
        icon: 'car',
        fields: [
          { label: 'LF Torsion Bar', key: 'lf_torsion_bar', placeholder: 'diameter/rate' },
          { label: 'RF Torsion Bar', key: 'rf_torsion_bar', placeholder: 'diameter/rate' },
          { label: 'Sway Bar Dia.', key: 'sway_bar', placeholder: 'inches' },
          { label: 'J-Bar / Panhard Height', key: 'j_bar_height', placeholder: 'inches from ground' },
          { label: 'Nose Piece', key: 'nose_piece', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'flat', label: 'Flat' }, { value: 'wedge', label: 'Wedge' }, { value: 'round', label: 'Round' },
          ]},
        ],
      },
      weightBalanceSection,
    ],
  },

  'Non-Wing Sprint Cars': {
    name: 'Non-Wing Sprint Cars',
    description: 'Open-wheel sprint cars without top wings, relying on mechanical grip',
    showWingAero: false,
    showWeightBalance: true,
    showDrivechain: false,
    generalFields: standardGeneral,
    frontCornerFields: [
      casterField, camberField, pressureField(),
      shockField,
      { label: 'Torsion Bar', key: 'torsion_bar', placeholder: 'diameter/rate' },
    ],
    rearCornerFields: standardRearCorner,
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Torque Arm / 3rd Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
    ],

    extraSections: [
      {
        id: 'sprint-extras',
        title: 'Sprint Car Specifics',
        icon: 'car',
        fields: [
          { label: 'Front Axle', key: 'front_axle', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'straight', label: 'Straight' }, { value: '1-degree', label: '1 Degree' }, { value: '2-degree', label: '2 Degree' }, { value: '3-degree', label: '3 Degree' },
          ]},
          { label: 'Top Gear', key: 'top_gear', type: 'number', placeholder: 'teeth' },
          { label: 'Bottom Gear', key: 'bottom_gear', type: 'number', placeholder: 'teeth' },
          { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.86' },
          { label: 'Nerf Bar Height', key: 'nerf_bar_height', placeholder: 'inches' },
          { label: 'Fuel Mixture', key: 'fuel_mixture', placeholder: 'e.g. 14.7:1' },
        ],
      },
      weightBalanceSection,
    ],
  },

  'Pro Stock': {
    name: 'Pro Stock',
    description: 'Stock-bodied cars with performance modifications, V8 powered',
    showWingAero: false,
    showWeightBalance: true,
    showDrivechain: false,
    generalFields: standardGeneral,
    frontCornerFields: [casterField, camberField, pressureField(), shockField, springField(), wheelOffsetField],
    rearCornerFields: standardRearCorner,
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Third Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
      { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.11' },
    ],

    extraSections: [
      {
        id: 'prostock-extras',
        title: 'Pro Stock Specifics',
        icon: 'car',
        fields: [
          { label: 'Sway Bar Dia.', key: 'sway_bar', placeholder: 'inches' },
          { label: 'Transmission', key: 'transmission', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'manual', label: 'Manual' }, { value: 'powerglide', label: 'Powerglide' }, { value: 'bert', label: 'Bert/Brinn' },
          ]},
          { label: 'Converter Stall', key: 'converter_stall', placeholder: 'RPM' },
        ],
      },
      weightBalanceSection,
    ],
  },

  'Pure Stock': {
    name: 'Pure Stock',
    description: 'Entry-level stock cars with minimal modifications allowed',
    showWingAero: false,
    showWeightBalance: false,
    showDrivechain: false,
    generalFields: [
      { label: 'Cross Weight (%)', key: 'cross_weight', type: 'number', placeholder: '50.0' },
      { label: 'Toe', key: 'toe', type: 'select' },
      { label: 'Front Ride Height', key: 'front_ride_height', type: 'select' },
      { label: 'Rear Ride Height', key: 'rear_ride_height', type: 'select' },
      { label: 'Stagger', key: 'stagger', type: 'number', step: '0.25', placeholder: 'inches' },
    ],
    frontCornerFields: [pressureField(), shockField, springField(), wheelOffsetField],
    rearCornerFields: [tireSizeField, pressureField(), shockField, springField(), wheelOffsetField],
    suspensionFields: [
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
      { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 3.73' },
    ],
    extraSections: [
      {
        id: 'purestock-extras',
        title: 'Pure Stock Specifics',
        icon: 'car',
        fields: [
          { label: 'Sway Bar', key: 'sway_bar', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'stock', label: 'Stock' }, { value: 'removed', label: 'Removed' },
          ]},
          { label: 'Tire Brand/Model', key: 'tire_brand', placeholder: 'e.g. Hoosier D55' },
        ],
      },
    ],
  },

  'Sport Compact': {
    name: 'Sport Compact',
    description: 'Small 4-cylinder economy cars, entry-level class',
    showWingAero: false,
    showWeightBalance: false,
    showDrivechain: false,
    generalFields: [
      { label: 'Cross Weight (%)', key: 'cross_weight', type: 'number', placeholder: '50.0' },
      { label: 'Toe', key: 'toe', type: 'select' },
      { label: 'Front Ride Height', key: 'front_ride_height', type: 'select' },
      { label: 'Rear Ride Height', key: 'rear_ride_height', type: 'select' },
      { label: 'Stagger', key: 'stagger', type: 'number', step: '0.25', placeholder: 'inches' },
    ],
    frontCornerFields: [pressureField(), shockField, springField()],
    rearCornerFields: [tireSizeField, pressureField(), shockField],
    suspensionFields: [
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
      { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.10' },
    ],
    extraSections: [
      {
        id: 'sportcompact-extras',
        title: 'Sport Compact Specifics',
        icon: 'car',
        fields: [
          { label: 'Drive Type', key: 'drive_type', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'fwd', label: 'FWD' }, { value: 'rwd', label: 'RWD' },
          ]},
          { label: 'Tire Brand/Model', key: 'tire_brand', placeholder: 'e.g. Hoosier D55' },
          { label: 'Sway Bar', key: 'sway_bar', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'stock', label: 'Stock' }, { value: 'aftermarket', label: 'Aftermarket' }, { value: 'removed', label: 'Removed' },
          ]},
        ],
      },
    ],
  },

  'Sport Mod': {
    name: 'Sport Mod',
    description: 'Modified-lite class, tube chassis with limited engine modifications',
    showWingAero: false,
    showWeightBalance: true,
    showDrivechain: false,
    generalFields: standardGeneral,
    frontCornerFields: standardFrontCorner,
    rearCornerFields: standardRearCorner,
    suspensionFields: [
      { label: 'LR Trailing Arm', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'RR Trailing Arm', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Third Link', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
      { label: 'Panhard Bar', key: 'panhard_bar', placeholder: 'Height/angle' },
      { label: 'Gear Ratio', key: 'gear_ratio', placeholder: 'e.g. 4.86' },
    ],

    extraSections: [
      {
        id: 'sportmod-extras',
        title: 'Sport Mod Specifics',
        icon: 'car',
        fields: [
          { label: 'Sway Bar Dia.', key: 'sway_bar', placeholder: 'inches' },
          { label: 'Nose Piece', key: 'nose_piece', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'flat', label: 'Flat' }, { value: 'wedge', label: 'Wedge' }, { value: 'round', label: 'Round' },
          ]},
          { label: 'Transmission', key: 'transmission', type: 'select', options: [
            { value: '', label: 'Select' }, { value: 'manual', label: 'Manual' }, { value: 'powerglide', label: 'Powerglide' }, { value: 'bert', label: 'Bert/Brinn' },
          ]},
        ],
      },
      weightBalanceSection,
    ],
  },
};

export const getClassConfig = (className: string): ClassConfig => {
  return CLASS_CONFIGS[className] || CLASS_CONFIGS['Dwarf Cars'];
};
