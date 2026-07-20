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

// --- Modified & Sport Modified shared sheet ----------------------------------
// These two dirt-oval classes share one OnlyFast setup sheet with exactly three
// major categories: General Chassis, Four Corners, Rear-End & Drivetrain.
//
// General Chassis uses SEPARATE Front Stagger and Rear Stagger fields (the
// generic sheet uses a single `stagger`). Existing keys (cross_weight, toe,
// ride heights, lr/rr_trailing_arm, third_link, panhard_bar, gear_ratio) are
// preserved so older saved setups keep loading their data. The old
// "Suspension & Drivetrain" data maps cleanly into "Rear-End & Drivetrain"
// because the underlying field keys are unchanged.
const modifiedGeneral: FieldDef[] = [
  { label: 'Cross Weight (%)', key: 'cross_weight', type: 'number', placeholder: '50.0' },
  { label: 'Toe', key: 'toe', type: 'select' },
  { label: 'Front Ride Height', key: 'front_ride_height', type: 'select' },
  { label: 'Rear Ride Height', key: 'rear_ride_height', type: 'select' },
  { label: 'Front Stagger', key: 'front_stagger', type: 'number', step: '0.25', placeholder: 'inches' },
  { label: 'Rear Stagger', key: 'rear_stagger', type: 'number', step: '0.25', placeholder: 'inches' },
];

// Rear-End & Drivetrain category for Modified / Sport Modified.
const modifiedRearEndDrivetrain: FieldDef[] = [
  { label: 'Left Trailing Arm Angle', key: 'lr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
  { label: 'Right Trailing Arm Angle', key: 'rr_trailing_arm', type: 'number', step: '0.25', placeholder: 'degrees' },
  { label: 'Third Link Angle', key: 'third_link', type: 'number', step: '0.25', placeholder: 'degrees' },
  { label: 'Panhard Bar Angle', key: 'panhard_bar', placeholder: 'degrees' },
  { label: 'Fuel', key: 'fuel', placeholder: 'e.g. gallons / type' },
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

// --- Pro Stock / Pure Stock shared stock-car sheet --------------------------
// Both classes use one OnlyFast stock-car sheet with exactly three major
// categories: General Chassis, Four Corners, Rear-End & Drivetrain.
// All fields are blank fillable text inputs (no sample/reference values
// prefilled or shown after the label).
const stockGeneralFields: FieldDef[] = [
  { label: 'Track', key: 'sc_track', type: 'text' },
  { label: 'Car', key: 'sc_car', type: 'text' },
  { label: 'Date', key: 'sc_date', type: 'text' },
  { label: 'Nose Height', key: 'nose_height', type: 'text' },
  { label: 'Front Weight (lbs / %)', key: 'front_weight', type: 'text' },
  { label: 'Cross Weight (%)', key: 'cross_weight', type: 'text' },
  { label: 'Left Weight (lbs / %)', key: 'left_weight', type: 'text' },
  { label: 'Rear Weight (lbs / %)', key: 'rear_weight', type: 'text' },
  { label: 'Total Weight', key: 'total_weight', type: 'text' },
  { label: 'Toe Out', key: 'toe_out', type: 'text' },
  { label: 'Ackerman', key: 'ackerman', type: 'text' },
  { label: 'Front Stagger', key: 'front_stagger', type: 'text' },
  { label: 'Rear Stagger', key: 'rear_stagger', type: 'text' },
];

const stockFrontCornerFields: FieldDef[] = [
  { label: 'Shock Brand', key: 'shock_brand', type: 'text' },
  { label: 'Compression', key: 'compression', type: 'text' },
  { label: 'Rebound', key: 'rebound', type: 'text' },
  { label: 'Piston', key: 'piston', type: 'text' },
  { label: 'Weight', key: 'weight', type: 'text' },
  { label: 'Spring Rate', key: 'spring_rate', type: 'text' },
  { label: 'Camber', key: 'camber', type: 'text' },
  { label: 'Caster', key: 'caster', type: 'text' },
  { label: 'Air Pressure', key: 'air_pressure', type: 'text' },
  { label: 'Tire Size', key: 'tire_size', type: 'text' },
  { label: 'Tire Temps', key: 'tire_temps', type: 'text' },
  { label: 'Ride Height', key: 'ride_height', type: 'text' },
  { label: 'A-Arm Length', key: 'a_arm_length', type: 'text' },
  { label: 'Bump', key: 'bump', type: 'text' },
  { label: 'Spindle', key: 'spindle', type: 'text' },
];

const stockRearCornerFields: FieldDef[] = [
  { label: 'Shock Brand', key: 'shock_brand', type: 'text' },
  { label: 'Compression', key: 'compression', type: 'text' },
  { label: 'Rebound', key: 'rebound', type: 'text' },
  { label: 'Piston', key: 'piston', type: 'text' },
  { label: 'Spring Rate', key: 'spring_rate', type: 'text' },
  { label: 'Trailing Arm Angle', key: 'trailing_arm_angle', type: 'text' },
  { label: 'Track Bar', key: 'track_bar', type: 'text' },
  { label: 'Rear Mount Hole', key: 'rear_mount_hole', type: 'text' },
  { label: 'Weight', key: 'weight', type: 'text' },
  { label: 'Air Pressure', key: 'air_pressure', type: 'text' },
  { label: 'Tire Size', key: 'tire_size', type: 'text' },
  { label: 'Tire Temps', key: 'tire_temps', type: 'text' },
  { label: 'Ride Height', key: 'ride_height', type: 'text' },
  { label: 'Lead', key: 'lead', type: 'text' },
  { label: 'Quarter Height', key: 'quarter_height', type: 'text' },
];

const stockRearEndDrivetrain: FieldDef[] = [
  { label: 'Top Link Front Height', key: 'top_link_front_height', type: 'text' },
  { label: 'Top Link Rear Height', key: 'top_link_rear_height', type: 'text' },
  { label: 'Top Link Angle', key: 'top_link_angle', type: 'text' },
  { label: 'Pinion Angle', key: 'pinion_angle', type: 'text' },
  { label: 'Gear Ratio', key: 'gear_ratio', type: 'text' },
  { label: 'Spoiler Angle', key: 'spoiler_angle', type: 'text' },
];

// --- Lightning Sprint sheet -------------------------------------------------
// OnlyFast structure plus one sprint-specific Wing section.
const lsGeneralFields: FieldDef[] = [
  { label: 'Wheelbase', key: 'wheelbase', type: 'text' },
  { label: 'Stagger', key: 'stagger', type: 'text' },
  { label: 'Front Panhard', key: 'front_panhard', type: 'text' },
];

const lsCornerFields: FieldDef[] = [
  { label: 'Torsion Bar / Coil Size', key: 'torsion_coil_size', type: 'text' },
  { label: 'Block Size', key: 'block_size', type: 'text' },
  { label: '# of Turns Off Block', key: 'turns_off_block', type: 'text' },
  { label: 'Ride Height', key: 'ride_height', type: 'text' },
  { label: 'Shock Setting', key: 'shock_setting', type: 'text' },
  { label: 'Shock Pressure', key: 'shock_pressure', type: 'text' },
  { label: 'Tire Pressure', key: 'tire_pressure', type: 'text' },
  { label: 'Tire Size', key: 'tire_size', type: 'text' },
  { label: 'Wheel', key: 'wheel', type: 'text' },
];

const lsRearEndDrivetrain: FieldDef[] = [
  { label: 'Jacobs Ladder', key: 'jacobs_ladder', type: 'text' },
  { label: 'Rear Bearing Carrier Timing', key: 'rear_bearing_carrier_timing', type: 'text' },
  { label: 'Right Rear Control Arm Location', key: 'rr_control_arm_location', type: 'text' },
  { label: 'Left Rear Control Arm Location', key: 'lr_control_arm_location', type: 'text' },
  { label: 'Center Line of Tire Offset', key: 'center_line_tire_offset', type: 'text' },
  { label: 'Left Front Offset Reference', key: 'lf_offset_ref', type: 'text' },
  { label: 'Left Rear Offset Reference', key: 'lr_offset_ref', type: 'text' },
  { label: 'Right Rear Offset Reference', key: 'rr_offset_ref', type: 'text' },
  { label: 'Front Sprocket', key: 'front_sprocket', type: 'text' },
  { label: 'Rear Sprocket', key: 'rear_sprocket', type: 'text' },
  { label: 'Notes', key: 'rear_notes', type: 'text' },
];

const lsWingSection: ClassSection = {
  id: 'ls-wing',
  title: 'Wing',
  icon: 'wing',
  fields: [
    { label: 'Front Wing Angle', key: 'front_wing_angle', type: 'text' },
    { label: 'Rear Wing Starting Angle', key: 'rear_wing_starting_angle', type: 'text' },
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

// Classes currently selectable in the app. The remaining CAR_CLASSES stay
// visible as Coming Soon in onboarding.
export const AVAILABLE_CAR_CLASSES = [
  'Dwarf Cars',
  'Modified',
  'Sport Mod',
  'Lightning Sprints',
  'Pro Stock',
  'Pure Stock',
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
    showWeightBalance: false,
    showDrivechain: true,
    // OnlyFast structure: General Chassis, Four Corners, Rear-End & Drivetrain,
    // plus a sprint-specific Wing section.
    generalFields: lsGeneralFields,
    frontCornerFields: lsCornerFields,
    rearCornerFields: lsCornerFields,
    suspensionFields: lsRearEndDrivetrain,
    extraSections: [lsWingSection],
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
    showWeightBalance: false,
    showDrivechain: false,
    // OnlyFast sheet: General Chassis, Four Corners, Rear-End & Drivetrain only.
    generalFields: modifiedGeneral,
    frontCornerFields: standardFrontCorner, // caster + camber FRONT only
    rearCornerFields: standardRearCorner,   // no caster/camber on rears
    suspensionFields: modifiedRearEndDrivetrain,
    extraSections: [],
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
    showWeightBalance: false,
    showDrivechain: false,
    // OnlyFast stock-car sheet: General Chassis, Four Corners, Rear-End & Drivetrain only.
    generalFields: stockGeneralFields,
    frontCornerFields: stockFrontCornerFields,
    rearCornerFields: stockRearCornerFields,
    suspensionFields: stockRearEndDrivetrain,
    extraSections: [],
  },

  'Pure Stock': {
    name: 'Pure Stock',
    description: 'Entry-level stock cars with minimal modifications allowed',
    showWingAero: false,
    showWeightBalance: false,
    showDrivechain: false,
    // Shares the same OnlyFast stock-car sheet as Pro Stock.
    generalFields: stockGeneralFields,
    frontCornerFields: stockFrontCornerFields,
    rearCornerFields: stockRearCornerFields,
    suspensionFields: stockRearEndDrivetrain,
    extraSections: [],
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
    showWeightBalance: false,
    showDrivechain: false,
    // Sport Modified shares the exact same OnlyFast sheet as Modified:
    // General Chassis, Four Corners, Rear-End & Drivetrain only.
    generalFields: modifiedGeneral,
    frontCornerFields: standardFrontCorner, // caster + camber FRONT only
    rearCornerFields: standardRearCorner,   // no caster/camber on rears
    suspensionFields: modifiedRearEndDrivetrain,
    extraSections: [],
  },

};

export const getClassConfig = (className: string): ClassConfig => {
  return CLASS_CONFIGS[className] || CLASS_CONFIGS['Dwarf Cars'];
};
