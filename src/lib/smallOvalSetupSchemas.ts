import type { ClassConfig, ClassSection, FieldDef } from './classConfigs.ts';

// Stable IDs are shared by onboarding, race_class, snapshots and the migration.
export const SMALL_OVAL_CLASS_IDS = ['micro_sprint', 'quarter_midget', 'junior_sprint', 'mini_dwarf'] as const;
export const SMALL_OVAL_RELEASE_STATUS: Record<typeof SMALL_OVAL_CLASS_IDS[number], NonNullable<ClassConfig['releaseStatus']>> = {
  micro_sprint: 'production', quarter_midget: 'test', junior_sprint: 'test', mini_dwarf: 'test',
};
const number = (key: string, label: string, unit?: string): FieldDef => ({
  key, label: unit ? `${label} (${unit})` : label, unit, type: 'number', step: 'any',
});
const text = (key: string, label: string, unit?: string): FieldDef => ({ ...number(key, label, unit), type: 'text', step: undefined });
const select = (key: string, label: string, options: [string, string][], required = false): FieldDef => ({
  key, label, type: 'select', required, options: [{ value: '', label: `Select ${label.toLowerCase()}` }, ...options.map(([value, label]) => ({ value, label }))],
});
const section = (id: string, title: string, fields: FieldDef[]): ClassSection => ({ id, title, fields, icon: 'car' });
const at = (corners: string[], fields: FieldDef[]) => corners.flatMap(c => fields.map(f => ({
  ...f, key: `${c}_${f.key}`, label: `${c.toUpperCase()} ${f.label}`,
})));
const allCorners = (fields: FieldDef[]) => at(['lf', 'rf', 'lr', 'rr'], fields);
const front = (fields: FieldDef[]) => at(['lf', 'rf'], fields);
const rear = (fields: FieldDef[]) => at(['lr', 'rr'], fields);
const fourCorners = (id: string, fields: FieldDef[]): ClassSection => ({ ...section(id, 'Four Corners', fields), layout: 'four-corners' });

// Shared groups within these sheets use the established library field IDs and
// units. Mature Dwarf/Lightning and pavement groups are intentionally untouched.
const session = [text('session_track', 'Track'), text('track_condition', 'Track condition / surface'),
  text('session_name', 'Event / session'), text('session_date', 'Date'), text('driver_name', 'Driver')];
const weightPercentages = [number('total_weight', 'Total weight with driver', 'lb'), number('left_side_pct', 'Left weight', '%'),
  number('rear_weight_pct', 'Rear weight', '%'), number('cross_weight', 'Cross weight', '%')];
const stagger = [number('front_stagger', 'Front stagger', 'in'), number('rear_stagger', 'Rear stagger', 'in')];
const fourCornerPressures = [number('cold_pressure', 'Tire pressure — cold', 'psi'), number('hot_pressure', 'Tire pressure — hot', 'psi')];
const fourCornerTemperatures = [number('temperature_inner', 'Tire temperature — inside', '°F'),
  number('temperature_middle', 'Tire temperature — middle', '°F'), number('temperature_outer', 'Tire temperature — outside', '°F')];
const tireSize = [text('tire_size', 'Tire size / brand'), text('tire_compound', 'Tire compound / tread'), number('tire_circumference', 'Tire circumference / rollout', 'in')];
const cornerWeights = [number('corner_weight', 'Corner weight', 'lb')];
const rideHeights = [number('ride_height', 'Frame rail ride height', 'in')];
const shockSettings = [text('shock_setting', 'Shock brand / valving'), text('compression', 'Shock bump', 'clicks / setting'), text('rebound', 'Shock rebound', 'clicks / setting')];
const alignment = [number('camber', 'Camber', 'deg'), number('caster', 'Caster', 'deg')];
const springRate = number('spring_rate', 'Spring rate (if coil-over / equipped)', 'lb/in');
const chainDrive = [number('front_sprocket', 'Engine / clutch drive sprocket', 'teeth'), number('rear_sprocket', 'Rear axle sprocket', 'teeth'), number('final_drive', 'Final drive ratio')];
const toe = text('toe_out', 'Toe-out', 'in / fraction');
const measuredWeights = [number('left_weight', 'Left weight', 'lb'), number('rear_weight', 'Rear weight', 'lb')];

export const SMALL_OVAL_FIELD_GROUPS: Record<string, ClassSection> = {
  microGeneral: section('micro-general', 'General Chassis', [
    select('micro_configuration', 'Configuration', [['winged', 'Winged'], ['non_winged', 'Non-Winged']], true),
    ...session, ...weightPercentages, ...stagger,
  ]),
  microCorners: fourCorners('micro-corners', allCorners([
    text('spring_bar_rate', 'Spring / bar rate', 'lb/in / diameter (specify)'), number('block_height', 'Block height', 'in'),
    ...rideHeights, ...cornerWeights, text('shock_setting', 'Shock'), number('wheel_offset', 'Wheel offset', 'in'),
    ...fourCornerPressures, text('tire_compound', 'Tire compound'), number('tire_circumference', 'Tire circumference / rollout', 'in'),
  ])),
  microFront: section('micro-front', 'Front / Steering', [number('front_panhard_height', 'Front panhard bar height', 'in'),
    ...front([number('king_pin_angle', 'King pin angle', 'deg'), text('toe', 'Toe (+ out / − in)', 'in / fraction')])]),
  microRear: section('micro-rear', 'Rear', [number('rear_panhard_height', 'Rear panhard bar height', 'in'), number('jacobs_ladder_height', "Jacob’s ladder height", 'in')]),
  microEngine: section('micro-engine', 'Engine / Drivetrain', [text('engine_configuration', 'Engine'), text('gearing', 'Gearing'),
    text('exhaust_configuration', 'Exhaust'), text('injection', 'Injection'), number('fuel_pressure', 'Fuel pressure', 'psi'), text('fuel_map', 'Fuel map')]),
  microWing: { ...section('micro-wing', 'Wing', [number('wing_angle', 'Wing angle', 'deg')]), icon: 'wing',
    activeWhen: { key: 'micro_configuration', value: 'winged' } },
  quarterGeneral: section('quarter-general', 'General Chassis', [
    select('surface', 'Surface', [['dirt', 'Dirt'], ['pavement', 'Pavement']]), ...session,
    text('engine_configuration', 'Class / engine'), number('ballast_weight', 'Ballast added', 'lb'),
    ...weightPercentages, ...measuredWeights, ...stagger, toe,
  ]),
  quarterCorners: fourCorners('quarter-corners', [
    ...allCorners([text('torsion_bar', 'Shock / torsion bar diameter / rate'), ...shockSettings, springRate, ...rideHeights,
      ...cornerWeights, ...tireSize, ...fourCornerPressures, ...fourCornerTemperatures, number('wheel_offset', 'Spindle / wheel spacer / offset', 'in'),
      text('radius_rod_chassis_hole', 'Radius rod chassis mounting hole'), text('radius_rod_axle_hole', 'Radius rod axle mounting hole')]),
    ...front(alignment), number('lr_axle_lead_lag', 'LR axle lead / lag relative to RF', 'in'), text('rr_axle_position', 'RR axle position / block alignment'),
  ]),
  quarterDrive: section('quarter-drive', 'Engine / Drive', [text('clutch_type', 'Clutch type / brand'), number('clutch_engagement_rpm', 'Clutch engagement', 'rpm'),
    ...chainDrive, text('chain_slack', 'Chain tension / slack', 'in / fraction'), text('fuel_type', 'Fuel type')]),
  juniorGeneral: section('junior-general', 'General Chassis', [...session, number('ambient_temperature', 'Ambient temperature', '°F'), number('humidity', 'Humidity', '%'),
    ...weightPercentages, ...measuredWeights, number('front_ride_height', 'Front ride height', 'in'), number('rear_ride_height', 'Rear ride height', 'in'), ...stagger]),
  juniorCorners: fourCorners('junior-corners', [
    ...allCorners([...shockSettings, springRate, ...cornerWeights, ...fourCornerPressures,
      number('tire_circumference', 'Tire circumference / rollout', 'in'), ...fourCornerTemperatures]),
    ...front([...alignment, number('radius_rod_top_angle', 'Top radius rod angle', 'deg'), number('radius_rod_bottom_angle', 'Bottom radius rod angle', 'deg')]),
    ...rear([text('torsion_stop', 'Torsion bar stop setting', 'turns'), number('axle_spacer', 'Axle spacer thickness', 'in'),
      text('birdcage_upper_hole', 'Upper birdcage mounting hole'), text('birdcage_lower_hole', 'Lower birdcage mounting hole')]),
  ]),
  juniorWing: section('junior-wing', 'Wing', [number('top_wing_angle', 'Top wing angle', 'deg'), number('top_wing_position', 'Top wing position from rear post', 'in'),
    number('nose_wing_angle', 'Nose wing angle', 'deg'), text('nose_wing_notch', 'Nose wing mounting notch')]),
  juniorGeometry: section('junior-geometry', 'Suspension Geometry / Panhard', [number('front_axle_width', 'Front axle width', 'in'), number('front_axle_offset', 'Front axle offset', 'in'),
    ...['front', 'rear'].flatMap(end => ['chassis', 'axle'].map(mount => number(`${end}_panhard_${mount}_height`, `${end === 'front' ? 'Front' : 'Rear'} panhard ${mount} height`, 'in'))),
    text('ackermann', 'Steering rack center / Ackermann setting')]),
  juniorDrive: section('junior-drive', 'Drivetrain / Engine', [text('engine_configuration', 'Engine type'), text('clutch_type', 'Clutch / torque converter type'),
    text('clutch_setting', 'Clutch springs / weights'), ...chainDrive, text('chain_size', 'Chain size'), number('rear_brake_bias', 'Rear brake bias', '%')]),
  miniGeneral: section('mini-general', 'General Chassis', [...session, ...weightPercentages, ...measuredWeights,
    number('minimum_class_weight', 'Minimum class weight limit', 'lb'), number('front_weight', 'Front weight', 'lb'), number('front_weight_pct', 'Front weight', '%'),
    number('right_weight', 'Right weight', 'lb'), number('right_weight_pct', 'Right weight', '%'),
    number('nose_height', 'Frame nose height', 'in'), number('tail_height', 'Frame tail height', 'in'), ...stagger, toe]),
  miniCorners: fourCorners('mini-corners', allCorners([text('shock_setting', 'Shock (if equipped)'), springRate, ...cornerWeights,
    ...tireSize, ...fourCornerPressures, ...fourCornerTemperatures])),
  miniFront: section('mini-front', 'Front Suspension / Steering', [...front(alignment), number('front_track_width', 'Front track width', 'in'),
    text('steering_arm_hole', 'Steering arm attachment hole / Ackermann')]),
  miniRear: section('mini-rear', 'Rear Suspension / Axle', [text('rear_axle_diameter', 'Rear axle diameter', 'in / fraction'), number('rear_track_width', 'Rear track width', 'in'),
    text('rear_axle_squareness', 'Rear axle squareness to frame', 'in / reference'), text('cassette_position', 'Cassette bearing lock / frame hole position')]),
  miniDrive: section('mini-drive', '212cc Engine / Clutch Drive', [text('engine_configuration', 'Engine model'), text('governor_status', 'Governor status'),
    text('main_jet', 'Main jet size'), text('pilot_jet', 'Pilot jet size'), text('air_filter', 'Air filter / velocity stack'),
    text('exhaust_configuration', 'Exhaust pipe'), text('clutch_type', 'Centrifugal clutch brand'), ...chainDrive,
    text('clutch_setting', 'Clutch engagement springs / color / lockup RPM')]),
};

const definitions = [
  ['micro_sprint', 'Micro Sprint', ['dirt_oval'], ['microGeneral', 'microCorners', 'microFront', 'microRear', 'microEngine', 'microWing']],
  ['quarter_midget', 'Quarter Midget', ['dirt_oval', 'pavement_oval'], ['quarterGeneral', 'quarterCorners', 'quarterDrive']],
  ['junior_sprint', 'Junior Sprint', ['dirt_oval'], ['juniorGeneral', 'juniorCorners', 'juniorWing', 'juniorGeometry', 'juniorDrive']],
  ['mini_dwarf', 'Mini Dwarf', ['dirt_oval'], ['miniGeneral', 'miniCorners', 'miniFront', 'miniRear', 'miniDrive']],
] as const;
export const SMALL_OVAL_CLASS_CONFIGS: Record<string, ClassConfig> = Object.fromEntries(definitions.map(([id, name, categories, groups]) => [id, {
  name, category: categories[0], categories: [...categories], schemaId: `${id}_v1`, family: 'small_oval',
  // Change an individual status only in a reviewed release, paired with SQL.
  releaseStatus: SMALL_OVAL_RELEASE_STATUS[id], developmentOnly: true, description: `${name} chassis and setup sheet`,
  fieldGroups: [...groups], showWingAero: id === 'micro_sprint' || id === 'junior_sprint', showWeightBalance: false, showDrivechain: false,
  generalFields: [], frontCornerFields: [], rearCornerFields: [], suspensionFields: [],
  extraSections: groups.map(group => ({ ...SMALL_OVAL_FIELD_GROUPS[group], fields: SMALL_OVAL_FIELD_GROUPS[group].fields.map(f => ({
    ...f, section: SMALL_OVAL_FIELD_GROUPS[group].id, applicableClass: id, applicableCategory: categories[0],
  })) })),
}]));

export function isSmallOvalClass(id: string): boolean { return SMALL_OVAL_CLASS_IDS.includes(id as typeof SMALL_OVAL_CLASS_IDS[number]); }
