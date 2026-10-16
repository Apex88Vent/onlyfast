import { ROAD_RACING_CLASS_CONFIGS } from './roadRacingSetupSchemas.ts';
import type { ClassConfig, ClassSection, FieldDef } from './classConfigs.ts';
import { PAVEMENT_FIELD_GROUPS, pavementLegendsSchema, pavementLateModelSchema, pavementModifiedSchema, pavementCompactSchema } from './pavementSetupSchemas.ts';

export type SetupCategory = 'dirt_oval' | 'pavement_oval' | 'road_course' | 'motorcycle' | 'rc';
export const SETUP_CATEGORY_LABELS: Record<SetupCategory, string> = {
  dirt_oval: 'Dirt Track Oval', pavement_oval: 'Pavement Oval', road_course: 'Road Racing', motorcycle: 'Motorcycle', rc: 'RC',
};

// Units follow existing explicit-unit fields (psi, inches, lb and °F). There
// is no application-wide unit selector. RC/motorcycle dimensions use mm;
// road suspension uses mm/N/mm. No implicit conversions or new preferences.
const field = (key: string, label: string, unit?: string, type: FieldDef['type'] = 'number'): FieldDef => ({
  key, label: unit ? `${label} (${unit})` : label, type, unit: unit || undefined,
  step: type === 'number' ? 'any' : undefined,
});
const text = (key: string, label: string, unit?: string) => field(key, label, unit, 'text');
const section = (id: string, title: string, fields: FieldDef[]): ClassSection => ({ id, title, fields, icon: 'car' });
const corners = ['lf', 'rf', 'lr', 'rr'] as const;
const atCorners = (fields: FieldDef[], frontOnly = false): FieldDef[] => (frontOnly ? corners.slice(0, 2) : corners)
  .flatMap(corner => fields.map(f => ({ ...f, key: `${corner}_${f.key}`, label: `${corner.toUpperCase()} ${f.label}` })));
const ends = (fields: FieldDef[]) => ['front', 'rear'].flatMap(end => fields.map(f => ({ ...f, key: `${end}_${f.key}`, label: `${end === 'front' ? 'Front' : 'Rear'} ${f.label}` })));

export const SETUP_FIELD_GROUPS: Record<string, ClassSection> = {
  ...PAVEMENT_FIELD_GROUPS,
  session: section('session', 'Session & Conditions', [text('session_track', 'Track'), text('session_name', 'Session'), text('session_weather', 'Weather'), field('ambient_temperature', 'Ambient temperature', '°F'), field('track_temperature', 'Track temperature', '°F'), field('fuel_load', 'Fuel load', 'gal'), field('driver_weight', 'Driver weight', 'lb')]),
  ovalWeights: section('oval-weights', 'Weights & Balance', [...atCorners([field('corner_weight', 'Corner weight', 'lb')]), field('total_weight', 'Total weight', 'lb'), field('front_weight_pct', 'Front weight', '%'), field('rear_weight_pct', 'Rear weight', '%'), field('left_side_pct', 'Left side weight', '%'), field('cross_weight', 'Cross weight', '%')]),
  roadWeights: section('road-weights', 'Weights & Balance', [...atCorners([field('corner_weight', 'Corner weight', 'lb')]), field('total_weight', 'Total weight', 'lb'), field('front_weight_pct', 'Front weight', '%'), field('rear_weight_pct', 'Rear weight', '%'), field('cross_weight', 'Cross weight', '%')]),
  fourCornerTires: section('tires', 'Tires & Temperatures', atCorners([field('cold_pressure', 'Cold pressure', 'psi'), field('hot_pressure', 'Hot pressure', 'psi'), field('temperature_inner', 'Inner temperature', '°F'), field('temperature_middle', 'Middle temperature', '°F'), field('temperature_outer', 'Outer temperature', '°F'), text('tire_compound', 'Tire / compound')])),
  ovalTires: section('oval-tires', 'Tire Size & Stagger', [...atCorners([text('tire_size', 'Tire size'), field('tire_circumference', 'Tire circumference', 'in')]), field('front_stagger', 'Front stagger', 'in'), field('rear_stagger', 'Rear stagger', 'in')]),
  ovalCorners: section('oval-corners', 'Ride Heights, Springs & Shocks', atCorners([field('ride_height', 'Ride height', 'in'), field('spring_rate', 'Spring rate', 'lb/in'), text('shock_setting', 'Shock setting'), text('compression', 'Compression', 'clicks / setting'), text('rebound', 'Rebound', 'clicks / setting')])),
  ovalAlignment: section('oval-alignment', 'Alignment', [...atCorners([field('camber', 'Camber', 'deg'), field('caster', 'Caster', 'deg')], true), field('front_toe', 'Front total toe (+ out / − in)', 'in')]),
  compactRearAlignment: section('compact-rear-alignment', 'Rear Alignment (where adjustable)', [...['lr', 'rr'].map(c => field(`${c}_camber`, `${c.toUpperCase()} camber`, 'deg')), field('rear_toe', 'Rear total toe (+ out / − in)', 'in')]),
  ovalChassis: section('oval-chassis', 'Chassis & Front Sway Bar', [text('front_arb', 'Front sway bar / setting'), text('front_arb_preload', 'Sway bar preload'), field('front_track_width', 'Front track width', 'in'), field('rear_track_width', 'Rear track width', 'in'), field('wheelbase', 'Wheelbase', 'in')]),
  legendsChassis: section('legends-chassis', 'Chassis Dimensions', [field('front_track_width', 'Front track width', 'in'), field('rear_track_width', 'Rear track width', 'in'), field('wheelbase', 'Wheelbase', 'in')]),
  rearSuspensionOval: section('oval-rear', 'Rear Suspension', [field('panhard_left_height', 'Track bar left height', 'in'), field('panhard_right_height', 'Track bar right height', 'in'), field('panhard_angle', 'Track bar angle', 'deg'), field('lr_trailing_arm_angle', 'LR trailing arm angle', 'deg'), field('rr_trailing_arm_angle', 'RR trailing arm angle', 'deg'), text('third_link_setting', 'Third link / upper link (where fitted)'), field('rear_end_offset', 'Rear end offset', 'in'), text('rear_steer', 'Rear steer')]),
  leafRear: section('leaf-rear', 'Leaf Spring Rear Suspension', [text('leaf_spring_spec', 'Leaf spring specification'), text('rear_shackle_position', 'Rear shackle position'), field('pinion_angle', 'Pinion angle', 'deg'), field('rear_end_offset', 'Rear end offset', 'in')]),
  ovalAero: section('oval-aero', 'Aero', [field('spoiler_angle', 'Spoiler angle', 'deg'), field('spoiler_height', 'Spoiler height', 'in'), field('splitter_clearance', 'Splitter clearance', 'in'), field('chassis_rake', 'Rake (rear − front)', 'in')]),
  bumpStops: section('bump-stops', 'Bump Stops & Packers (where fitted)', atCorners([text('bump_stop', 'Bump stop specification'), field('packer_height', 'Packer height', 'in'), field('bump_gap', 'Bump gap', 'in')])),
  gearing: section('gearing', 'Gearing', [field('final_drive', 'Final drive ratio'), text('gear_stack', 'Gear ratios / stack (where adjustable)')]),
  ovalDifferential: section('oval-diff', 'Rear Axle & Differential', [text('diff_configuration', 'Differential / spool configuration'), field('diff_preload', 'Preload (where adjustable)', 'N·m')]),
  brakes: section('brakes', 'Brakes', [field('brake_bias', 'Front brake bias', '%'), text('brake_pressure', 'Brake pressure setting'), text('brake_ducting', 'Brake ducting')]),
  roadRaceAlignment: section('road-alignment', 'Alignment', [...atCorners([field('camber', 'Camber', 'deg'), field('toe', 'Toe (+ out / − in)', 'deg')]), ...atCorners([field('caster', 'Caster', 'deg')], true)]),
  roadRideHeight: section('road-ride-height', 'Ride Heights & Rake', [...atCorners([field('ride_height', 'Ride height', 'mm')]), field('front_ride_height_reference', 'Front ride height reference', 'mm'), field('rear_ride_height_reference', 'Rear ride height reference', 'mm'), field('chassis_rake', 'Rake (rear − front)', 'mm')]),
  fourCornerSprings: section('springs', 'Springs', atCorners([field('spring_rate', 'Spring rate', 'N/mm')])),
  fourCornerShocks: section('shocks', 'Dampers', atCorners([text('shock_setting', 'Shock setting'), text('compression', 'Compression', 'clicks / setting'), text('rebound', 'Rebound', 'clicks / setting')])),
  fourCornerDampers: section('dampers', 'Dampers (use available channels)', atCorners([text('shock_setting', 'Combined shock setting'), text('compression_low_speed', 'Low speed compression', 'clicks / setting'), text('compression_high_speed', 'High speed compression', 'clicks / setting'), text('rebound_low_speed', 'Low speed rebound', 'clicks / setting'), text('rebound_high_speed', 'High speed rebound', 'clicks / setting')])),
  antiRollBars: section('anti-roll-bars', 'Anti-Roll Bars', [text('front_arb', 'Front anti-roll bar / position'), text('rear_arb', 'Rear anti-roll bar / position')]),
  aero: section('aero', 'Aero', [text('front_aero_setting', 'Front splitter / aero setting'), field('rear_wing_angle', 'Rear wing angle', 'deg'), field('aero_balance', 'Front aero balance (if known)', '%')]),
  formulaAero: section('formula-aero', 'Wings', [text('front_wing_setting', 'Front wing / flap setting'), field('rear_wing_angle', 'Rear wing angle', 'deg'), field('aero_balance', 'Front aero balance (if known)', '%')]),
  prototypePlatform: section('prototype-platform', 'Aero Platform (where fitted)', [field('front_heave_spring', 'Front heave spring rate', 'N/mm'), field('rear_heave_spring', 'Rear heave spring rate', 'N/mm'), text('heave_damper_setting', 'Heave damper setting'), field('front_packer_gap', 'Front packer gap', 'mm'), field('rear_packer_gap', 'Rear packer gap', 'mm'), text('diffuser_setting', 'Diffuser / aero platform notes')]),
  sportsRacerPlatform: section('sports-racer-platform', 'Aero Platform', [field('front_bump_clearance', 'Front bump clearance', 'mm'), field('rear_bump_clearance', 'Rear bump clearance', 'mm'), text('platform_notes', 'Ride height / platform notes')]),
  differential: section('differential', 'Differential (where adjustable)', [text('diff_configuration', 'Differential configuration'), field('diff_preload', 'Preload', 'N·m'), text('diff_power', 'Power / accel setting'), text('diff_coast', 'Coast / decel setting')]),
  electronics: section('electronics', 'Electronics (where supported)', [text('traction_control', 'Traction control level'), text('abs_level', 'ABS level'), text('engine_map', 'Engine / power map')]),
  prototypeElectronics: section('prototype-electronics', 'Electronics (where supported)', [text('traction_control', 'Traction control level'), text('engine_map', 'Engine / power map')]),
  veeFront: section('vee-front', 'Front Torsion Beam', [text('front_torsion_setting', 'Front torsion spring / adjuster'), field('front_ride_height', 'Front ride height', 'mm'), field('front_camber', 'Front camber', 'deg'), field('front_toe', 'Front total toe (+ out / − in)', 'deg'), field('front_caster', 'Front caster', 'deg'), text('front_shock_setting', 'Front shock setting'), text('front_arb', 'Front anti-roll bar (where fitted)')]),
  veeRear: section('vee-rear', 'Rear Swing Axle & Spring', [field('rear_ride_height', 'Rear ride height', 'mm'), field('rear_camber', 'Rear camber', 'deg'), field('rear_toe', 'Rear total toe (+ out / − in)', 'deg'), field('rear_spring_rate', 'Rear spring rate', 'N/mm'), text('rear_shock_setting', 'Rear shock setting'), text('rear_droop_limit', 'Rear droop limiter'), text('rear_arb', 'Rear anti-roll / zero-roll configuration')]),
  motorcycleSession: section('motorcycle-session', 'Session & Rider', [text('session_track', 'Track'), text('session_name', 'Session'), text('session_weather', 'Weather / surface'), field('ambient_temperature', 'Ambient temperature', '°F'), field('track_temperature', 'Track temperature', '°F'), field('fuel_load', 'Fuel load', 'gal'), field('rider_weight', 'Rider weight with gear', 'lb')]),
  motorcycleFront: section('motorcycle-front', 'Front Fork', [field('fork_height', 'Fork protrusion above top clamp', 'mm'), field('fork_preload', 'Preload', 'mm'), text('fork_compression', 'Compression', 'clicks / setting'), text('fork_rebound', 'Rebound', 'clicks / setting'), field('fork_spring_rate', 'Spring rate', 'N/mm'), field('fork_oil_level', 'Fork oil level / air gap', 'mm')]),
  motorcycleRear: section('motorcycle-rear', 'Rear Shock', [field('shock_length', 'Shock length', 'mm'), field('rear_ride_height', 'Rear ride height reference', 'mm'), field('shock_preload', 'Preload', 'mm'), text('shock_compression', 'Compression', 'clicks / setting'), text('shock_rebound', 'Rebound', 'clicks / setting'), field('shock_spring_rate', 'Spring rate', 'N/mm')]),
  motorcycleGeometry: section('motorcycle-geometry', 'Sag & Geometry', [...ends([field('static_sag', 'Static sag', 'mm'), field('rider_sag', 'Rider sag', 'mm')]), field('wheelbase', 'Wheelbase', 'mm'), field('steering_head_angle', 'Steering head angle', 'deg'), field('triple_clamp_offset', 'Triple clamp offset (where adjustable)', 'mm')]),
  motorcycleTires: section('motorcycle-tires', 'Tires', ends([text('tire_compound', 'Tire / compound'), field('cold_pressure', 'Cold pressure', 'psi'), field('hot_pressure', 'Hot pressure', 'psi'), field('tire_temperature', 'Tire temperature', '°F')])),
  motorcycleGearing: section('motorcycle-gearing', 'Sprockets & Gearing', [field('front_sprocket', 'Front sprocket', 'teeth'), field('rear_sprocket', 'Rear sprocket', 'teeth'), field('final_drive', 'Final drive ratio'), field('chain_slack', 'Chain slack', 'mm')]),
  motorcycleBrakes: section('motorcycle-brakes', 'Brakes & Controls', [text('front_brake_pad', 'Front brake pad'), text('rear_brake_pad', 'Rear brake pad'), text('lever_position', 'Lever position'), text('foot_control_position', 'Foot control position')]),
  motorcycleElectronics: section('motorcycle-electronics', 'Electronics (where fitted)', [text('traction_control', 'Traction control'), text('abs_level', 'ABS'), text('engine_braking', 'Engine braking'), text('power_map', 'Power map'), text('wheelie_control', 'Wheelie control')]),
  offroadFork: section('offroad-fork', 'Off-Road Suspension', [text('fork_oil_viscosity', 'Fork oil viscosity'), text('shock_compression_high_speed', 'High speed compression', 'turns / setting'), text('shock_compression_low_speed', 'Low speed compression', 'clicks / setting')]),
  flatTrack: section('flat-track', 'Flat Track Chassis & Tires', [text('tire_cut', 'Tire cut / pattern'), field('rear_wheel_offset', 'Rear wheel offset (where adjustable)', 'mm'), text('swingarm_setting', 'Swingarm / axle position'), text('rear_brake_setting', 'Rear brake setting')]),
  rcSession: section('rc-session', 'Track & Vehicle', [text('session_track', 'Track'), text('surface', 'Surface'), text('traction_level', 'Traction level'), text('chassis_model', 'Chassis / model'), text('power_type', 'Electric / nitro'), field('track_temperature', 'Track temperature', '°F')]),
  rcGeometry: section('rc-geometry', 'Ride Height & Alignment', [...ends([field('ride_height', 'Ride height', 'mm'), field('camber', 'Camber', 'deg'), field('toe', 'Total toe (+ out / − in)', 'deg'), field('droop', 'Droop', 'mm'), text('roll_center', 'Roll center / link position')]), field('front_caster', 'Front caster', 'deg'), field('wheelbase', 'Wheelbase', 'mm')]),
  rcShocks: section('rc-shocks', 'Shocks & Springs', ends([text('shock_oil', 'Shock oil', 'cSt / wt (specify scale)'), text('shock_piston', 'Shock piston holes / size'), text('spring', 'Spring / rate'), text('shock_upper_position', 'Upper shock position'), text('shock_lower_position', 'Lower shock position'), field('shock_length', 'Shock length', 'mm')])),
  rcTires: section('rc-tires', 'Tires & Inserts', ends([text('tire', 'Tire / compound'), text('insert', 'Insert'), field('wheel_hex_offset', 'Wheel hex offset', 'mm')])),
  rcAdditive: section('rc-additive', 'Tire Preparation (where allowed)', [text('tire_additive', 'Tire additive'), field('additive_time', 'Application time', 'min'), text('tire_preparation', 'Tire preparation')]),
  rcDiff2wd: section('rc-diff-2wd', 'Rear Differential', [text('rear_diff_configuration', 'Rear ball / gear differential'), text('rear_diff_oil', 'Rear diff oil (gear diff)', 'cSt'), text('ball_diff_setting', 'Ball diff setting'), text('slipper_setting', 'Slipper clutch setting')]),
  rcDiff4wd: section('rc-diff-4wd', 'Differentials & Slipper', [text('front_diff_configuration', 'Front differential configuration'), text('front_diff_oil', 'Front diff oil', 'cSt'), text('center_drive_configuration', 'Center diff / slipper / spool'), text('center_diff_oil', 'Center diff oil (where fitted)', 'cSt'), text('rear_diff_configuration', 'Rear differential configuration'), text('rear_diff_oil', 'Rear diff oil', 'cSt'), text('slipper_setting', 'Slipper (where fitted)')]),
  rcTouringDiff: section('rc-touring-diff', 'Touring Drivetrain', [text('front_diff_configuration', 'Front spool / diff configuration'), text('front_diff_oil', 'Front diff oil (where fitted)', 'cSt'), text('rear_diff_configuration', 'Rear diff configuration'), text('rear_diff_oil', 'Rear diff oil', 'cSt'), text('belt_tension', 'Belt / drivetrain tension')]),
  rcGearing: section('rc-gearing', 'Gearing & Power', [field('pinion', 'Pinion / clutch bell', 'teeth'), field('spur', 'Spur', 'teeth'), field('final_drive', 'Final drive ratio'), text('motor_setting', 'Motor / engine setting'), text('esc_setting', 'ESC setting (electric)')]),
  rcWeight: section('rc-weight', 'Battery & Weight Placement', [text('battery_placement', 'Battery placement (electric)'), text('weight_placement', 'Weight placement'), field('total_weight', 'Total weight', 'g')]),
  rcWing: section('rc-wing', 'Wing', [text('wing_position', 'Wing position'), field('wing_angle', 'Wing angle', 'deg')]),
  rcOval: section('rc-oval', 'Oval Balance', [...atCorners([text('spring', 'Spring / rate'), field('corner_weight', 'Corner weight', 'g')]), field('cross_weight', 'Cross weight', '%'), field('left_side_pct', 'Left side weight', '%'), field('front_stagger', 'Front stagger', 'mm'), field('rear_stagger', 'Rear stagger', 'mm'), text('rear_pod_setting', 'Rear pod / solid axle setting (where fitted)')]),
  sprintChassis: section('sprint-chassis', 'Sprint Chassis', [field('wheelbase', 'Wheelbase', 'in'), field('front_stagger', 'Front stagger', 'in'), field('rear_stagger', 'Rear stagger', 'in'), text('front_axle', 'Front axle specification'), text('front_panhard', 'Front panhard setting'), text('jacobs_ladder', 'Jacobs ladder setting'), text('rear_axle_location', 'Rear axle location')]),
  sprintCorners: section('sprint-corners', 'Four Corners', atCorners([text('torsion_bar', 'Torsion bar diameter / rate'), field('block_size', 'Block size', 'in'), text('turns_off_block', 'Turns off block'), text('shock_setting', 'Shock setting'), field('cold_pressure', 'Cold tire pressure', 'psi'), text('tire_size', 'Tire size'), field('wheel_offset', 'Wheel offset', 'in')])),
  sprintWing: section('sprint-wing', 'Wings', [field('top_wing_angle', 'Top wing angle', 'deg'), field('top_wing_position', 'Top wing position', 'in'), field('nose_wing_angle', 'Nose wing angle', 'deg')]),
  kartGeneral: section('kart-general', 'General', [text('session_track', 'Track'), text('session_name', 'Session'), text('session_weather', 'Weather'), field('ambient_temperature', 'Ambient temperature', '°F'), field('track_temperature', 'Track temperature', '°F'), field('driver_weight', 'Driver weight', 'lb'), field('fuel_load', 'Fuel load', 'gal'), field('total_weight', 'Total weight', 'lb')]),
  kartTires: section('kart-tires', 'Tires', atCorners([field('cold_pressure', 'Cold pressure', 'psi'), field('hot_pressure', 'Hot pressure', 'psi'), text('tire_compound', 'Tire / compound'), field('tire_circumference', 'Tire circumference (where recorded)', 'mm'), field('tire_temperature', 'Tire temperature (where recorded)', '°F')])),
  kartFrontGeometry: section('kart-front', 'Front End', [field('front_track_width', 'Front track width', 'mm'), ...atCorners([field('camber', 'Camber', 'deg'), field('caster', 'Caster', 'deg'), field('toe', 'Toe (+ out / − in)', 'mm')], true), text('front_height_setting', 'Front chassis height / spindle spacer setting'), field('front_ride_height', 'Front ride height (where measured)', 'mm'), field('front_hub_length', 'Front hub length', 'mm'), text('front_hub_position', 'Front hub position / spacer configuration')]),
  kartRearAxle: section('kart-rear', 'Rear End', [field('rear_track_width', 'Rear track width', 'mm'), text('rear_axle_height', 'Rear axle height / cassette position'), text('rear_axle_type', 'Rear axle type / stiffness'), field('rear_axle_diameter', 'Rear axle diameter', 'mm'), field('rear_axle_length', 'Rear axle length', 'mm'), field('rear_hub_length', 'Rear hub length', 'mm'), text('rear_hub_position', 'Rear hub position / spacer configuration'), text('rear_bearing_configuration', 'Rear bearing configuration / clamping')]),
  kartSeat: section('kart-seat', 'Seat', [field('seat_fore_aft', 'Seat fore/aft position (record datum)', 'mm'), field('seat_lateral_position', 'Seat lateral position (record datum)', 'mm'), field('seat_height', 'Seat height (record datum)', 'mm'), text('seat_type', 'Seat type / stiffness'), text('seat_strut_configuration', 'Seat strut configuration')]),
  kartChassis: section('kart-chassis', 'Chassis', [text('chassis_bar_setting', 'Chassis / torsion bar configuration (where fitted)'), text('frame_stiffness_setting', 'Frame / stiffness configuration (where available)'), text('ballast_position', 'Weight / ballast position'), field('ballast_weight', 'Ballast weight', 'lb')]),
  kartSteering: section('kart-steering', 'Ackerman / Steering', [text('ackerman_setting', 'Ackerman setting / steering arm holes'), text('steering_geometry_setting', 'Steering column / tie-rod geometry setting')]),
  kartGearing: section('kart-gearing', 'Gearing', [field('front_sprocket', 'Front / drive sprocket', 'teeth'), field('rear_sprocket', 'Rear sprocket', 'teeth'), field('final_drive', 'Final drive ratio')]),
  kartClutchDrive: section('kart-clutch-drive', 'Clutch / Direct Drive', [text('kart_drive_configuration', 'Centrifugal clutch / direct-drive configuration'), field('clutch_engagement_rpm', 'Clutch engagement (centrifugal clutch only)', 'rpm')]),
  kartEngine: section('kart-engine', 'Engine', [text('engine_configuration', 'Engine configuration'), text('engine_map', 'Engine map / ignition setting (where adjustable)'), text('carburetor_configuration', 'Carburetor configuration (where fitted)'), text('main_jet', 'Main jet (where adjustable)'), text('needle_setting', 'Needle / clip setting (where adjustable)'), text('carburetor_adjustment', 'Carburetor adjustment (where permitted)'), text('exhaust_configuration', 'Exhaust configuration (where permitted)')]),
  kartBrakes: section('kart-brakes', 'Brakes', [text('rear_brake_configuration', 'Rear brake / pad configuration'), text('brake_pedal_setting', 'Brake pedal position / free play')]),
  kartShifterBrakes: section('kart-shifter-brakes', 'Front / Rear Brakes', [text('front_brake_configuration', 'Front brake / pad configuration'), field('brake_bias', 'Front brake balance (where adjustable)', '%')]),
};

export const EXPANDED_CLASS_CONFIGS: Record<string, ClassConfig> = {};
function add(name: string, category: SetupCategory, family: string, groups: string[], description: string) {
  EXPANDED_CLASS_CONFIGS[name] = {
    name, category, family, description, fieldGroups: [...groups], developmentOnly: true,
    showWingAero: groups.includes('sprintWing'), showWeightBalance: false, showDrivechain: false,
    generalFields: [], frontCornerFields: [], rearCornerFields: [], suspensionFields: [],
    extraSections: groups.map(group => ({ ...SETUP_FIELD_GROUPS[group], fields: SETUP_FIELD_GROUPS[group].fields.map(f => ({
      ...f, section: SETUP_FIELD_GROUPS[group].id, applicableClass: name, applicableCategory: category,
    })) })),
  };
}

add('Legends', 'pavement_oval', 'oval', pavementLegendsSchema, 'Motorcycle-powered spec coupe with coil springs and a live rear axle');
add('Pavement Late Model', 'pavement_oval', 'oval', pavementLateModelSchema, 'Base sheet for Late Model Stock, Pro Late Model and Super Late Model cars');
add('Pavement Modified', 'pavement_oval', 'oval', pavementModifiedSchema, 'Common asphalt tube-frame modified with a live rear axle');
add('Stock Car / ARCA', 'pavement_oval', 'oval', pavementLateModelSchema, 'Traditional live-axle ARCA / regional stock car foundation');
add('Street Stock / Sportsman', 'pavement_oval', 'oval', pavementModifiedSchema, 'Common coil-spring pavement stock car / sportsman foundation');
add('Mini Stock / Compact', 'pavement_oval', 'oval', pavementCompactSchema, 'Production-based four-cylinder pavement oval car; rear alignment where adjustable');

const road = ['session', 'roadWeights', 'fourCornerTires', 'roadRaceAlignment', 'roadRideHeight', 'fourCornerSprings'];
add('GT3', 'road_course', 'sports_car', [...road, 'fourCornerDampers', 'antiRollBars', 'aero', 'differential', 'brakes', 'electronics', 'gearing'], 'Comprehensive GT3 foundation with multi-channel dampers, aero, ABS and TC');
add('GT4', 'road_course', 'sports_car', [...road, 'fourCornerShocks', 'antiRollBars', 'aero', 'differential', 'brakes', 'electronics', 'gearing'], 'Production-derived GT car with simpler dampers and available electronics');
add('Prototype', 'road_course', 'sports_car', [...road, 'fourCornerDampers', 'antiRollBars', 'aero', 'prototypePlatform', 'differential', 'brakes', 'prototypeElectronics', 'gearing'], 'Aero-sensitive sports prototype; heave controls only where fitted');
add('Radical / Sports Racer', 'road_course', 'sports_car', [...road, 'fourCornerShocks', 'antiRollBars', 'aero', 'sportsRacerPlatform', 'differential', 'brakes', 'gearing'], 'Lightweight sports racer with ride height and aero platform emphasis');
add('Touring Car', 'road_course', 'sports_car', [...road, 'fourCornerShocks', 'antiRollBars', 'aero', 'differential', 'brakes', 'gearing'], 'Production-bodied touring car; no assumed GT3 electronics');
add('Production Track Car', 'road_course', 'sports_car', [...road, 'fourCornerShocks', 'antiRollBars', 'differential', 'brakes', 'gearing'], 'Common production-based track car with mechanical suspension tuning');
add('Time Attack', 'road_course', 'sports_car', [...road, 'fourCornerDampers', 'antiRollBars', 'aero', 'differential', 'brakes', 'electronics', 'gearing'], 'Modified time attack car with aero and available electronic controls');

const formula = [...road, 'fourCornerShocks', 'antiRollBars', 'gearing', 'brakes'];
add('Formula Ford 1600 / FF1600', 'road_course', 'open_wheel', formula, 'Non-winged Formula Ford / Formula F base sheet with no aero controls');
for (const name of ['Formula Ford 2000 / FF2000', 'Formula Continental', 'F2000']) add(name, 'road_course', 'open_wheel', [...formula, 'formulaAero'], 'Winged two-litre formula foundation; distinct class identity and field metadata');
add('Formula Mazda', 'road_course', 'open_wheel', [...formula, 'formulaAero'], 'Winged club formula Mazda foundation');
add('Formula Vee', 'road_course', 'open_wheel', ['session', 'roadWeights', 'fourCornerTires', 'veeFront', 'veeRear', 'gearing', 'brakes'], 'Non-winged VW-based torsion-beam front and swing-axle rear architecture');
add('Formula Atlantic', 'road_course', 'open_wheel', [...road, 'fourCornerDampers', 'antiRollBars', 'gearing', 'brakes', 'formulaAero', 'prototypePlatform', 'differential'], 'Winged formula with ground-effect platform and adjustable differential where fitted');
add('Formula 4', 'road_course', 'open_wheel', [...formula, 'formulaAero'], 'Junior winged formula car with simple damper settings');
add('Junior Formula', 'road_course', 'open_wheel', formula, 'Generic mechanical-grip junior formula base; wings require a specific winged class');

// Kart chassis tune through geometry, axle/hubs, seat and frame flex, without
// car suspension groups. Stable shared keys allow later class-specific growth.
const kart = ['kartGeneral', 'kartTires', 'kartFrontGeometry', 'kartRearAxle', 'kartSeat', 'kartChassis', 'kartSteering', 'kartGearing', 'kartEngine', 'kartBrakes'];
add('Shifter Kart', 'road_course', 'kart', [...kart, 'kartShifterBrakes'], 'Gearbox kart with chassis flex, axle and hub tuning, front/rear brakes and final-drive sprockets');
add('Clutch Kart', 'road_course', 'kart', [...kart, 'kartClutchDrive'], 'Non-gearbox direct-drive or centrifugal-clutch kart with typical rear-only braking');

const motorcycle = ['motorcycleSession', 'motorcycleFront', 'motorcycleRear', 'motorcycleGeometry', 'motorcycleTires', 'motorcycleGearing', 'motorcycleBrakes'];
add('Road Racing / Superbike', 'motorcycle', 'motorcycle', [...motorcycle, 'motorcycleElectronics'], 'Road race motorcycle with available electronic rider aids');
add('Supersport', 'motorcycle', 'motorcycle', [...motorcycle, 'motorcycleElectronics'], 'Production-based supersport motorcycle; electronic settings where supported');
add('Track Day Motorcycle', 'motorcycle', 'motorcycle', [...motorcycle, 'motorcycleElectronics'], 'Road motorcycle track-day baseline with rider sag and tire pressures');
add('Supermoto', 'motorcycle', 'motorcycle', [...motorcycle, 'offroadFork'], 'Mixed-surface motorcycle with long-travel suspension tuning');
add('Flat Track', 'motorcycle', 'motorcycle', [...motorcycle.filter(g => g !== 'motorcycleBrakes'), 'flatTrack'], 'Dirt oval motorcycle; no assumed front brake or electronic rider aids');
add('Mini Moto', 'motorcycle', 'motorcycle', motorcycle, 'Small road racing motorcycle with simple suspension and gearing');
add('Motocross', 'motorcycle', 'motorcycle', [...motorcycle, 'offroadFork'], 'Off-road motorcycle discipline already named in OnlyFast onboarding');

const rc = ['rcSession', 'rcGeometry', 'rcShocks', 'rcTires', 'antiRollBars', 'rcGearing', 'rcWeight'];
add('RC 1/8 Buggy', 'rc', 'rc', [...rc, 'rcDiff4wd', 'rcWing'], 'Four-wheel-drive 1/8 buggy, electric or nitro; center diff where fitted');
add('RC 1/10 Buggy', 'rc', 'rc', [...rc, 'rcDiff2wd', 'rcWing'], 'Common two-wheel-drive 1/10 buggy with rear ball / gear diff and slipper');
add('RC 1/10 4WD Buggy', 'rc', 'rc', [...rc, 'rcDiff4wd', 'rcWing'], 'Four-wheel-drive 1/10 buggy with distinct drivetrain definition');
add('RC Short Course', 'rc', 'rc', [...rc, 'rcDiff4wd'], 'Common 4WD short-course truck; no assumed buggy wing');
add('RC Touring Car', 'rc', 'rc', [...rc, 'rcTouringDiff', 'rcAdditive', 'rcWing'], 'Common 4WD electric touring car with tire preparation and belt settings');
add('RC Oval', 'rc', 'rc', [...rc.filter(g => g !== 'antiRollBars'), 'rcDiff2wd', 'rcOval'], 'Common electric 2WD oval foundation with corner springs, stagger and balance');

add('Winged Sprint Cars', 'dirt_oval', 'oval', ['session', 'ovalWeights', 'sprintChassis', 'sprintCorners', 'sprintWing', 'gearing', 'brakes'], 'Winged sprint car referenced by the existing class icon registry');

Object.assign(EXPANDED_CLASS_CONFIGS, ROAD_RACING_CLASS_CONFIGS);

export const EXPANDED_CAR_CLASSES = Object.keys(EXPANDED_CLASS_CONFIGS);
export function isDevelopmentClass(name?: string | null): boolean {
  return EXPANDED_CAR_CLASSES.some(c => c.toLowerCase() === (name || '').trim().toLowerCase());
}
export function areSetupSheetsCompatible(source?: string, target?: string): boolean {
  if (isDevelopmentClass(source) || isDevelopmentClass(target)) return (source || '').trim().toLowerCase() === (target || '').trim().toLowerCase();
  return (source === 'Custom Car') === (target === 'Custom Car');
}

export function setupClassLabel(id?: string | null): string {
  return ROAD_RACING_CLASS_CONFIGS[id || '']?.name || id || '';
}
