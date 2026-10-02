import type { ClassSection, FieldDef } from './classConfigs.ts';

const number = (key: string, label: string, unit?: string): FieldDef => ({
  key, label: unit ? `${label} (${unit})` : label, unit, type: 'number', step: 'any',
});
const text = (key: string, label: string, unit?: string): FieldDef => ({
  ...number(key, label, unit), type: 'text', step: undefined,
});
const section = (id: string, title: string, fields: FieldDef[]): ClassSection => ({ id, title, fields, icon: 'car' });
const cornerFields = (fields: FieldDef[]) => ['lf', 'rf', 'lr', 'rr'].flatMap(corner =>
  fields.map(f => ({ ...f, key: `${corner}_${f.key}`, label: `${corner.toUpperCase()} ${f.label}` })));
const corners = (id: string, fields: FieldDef[]): ClassSection => ({
  ...section(id, 'Four Corners', cornerFields(fields)), layout: 'four-corners',
});
const alignment: FieldDef[] = [
  number('lf_camber', 'Left camber', 'deg'), number('rf_camber', 'Right camber', 'deg'),
  number('lf_caster', 'Left caster', 'deg'), number('rf_caster', 'Right caster', 'deg'),
  { ...number('front_toe', 'Toe', 'in'), type: 'select' },
  { key: 'front_toe_direction', label: 'Toe direction', type: 'select', pairedWith: 'front_toe',
    options: [{ value: '', label: '--' }, { value: 'in', label: 'In' }, { value: 'out', label: 'Out' }] },
];
const weights: FieldDef[] = [
  number('total_weight', 'Total weight', 'lb'), number('cross_weight_lbs', 'Cross weight', 'lb'),
  number('cross_weight', 'Cross weight', '%'), number('left_side_pct', 'Left side weight', '%'),
  number('rear_weight_pct', 'Rear weight', '%'),
];
const stagger = [number('front_stagger', 'Front tire stagger', 'in'), number('rear_stagger', 'Rear tire stagger', 'in')];
const basicCorners = [
  number('cold_pressure', 'Tire pressure — cold', 'psi'), number('hot_pressure', 'Tire pressure — hot', 'psi'),
  number('tire_circumference', 'Tire circumference', 'in'), number('ride_height', 'Ride height', 'in'),
  number('corner_weight', 'Corner weight', 'lb'), number('spring_rate', 'Spring rate', 'lb/in'),
];
const tireTemperatures = [number('temperature_inner', 'Tire temperature — inner', '°F'),
  number('temperature_middle', 'Tire temperature — middle', '°F'), number('temperature_outer', 'Tire temperature — outer', '°F')];

// Each class receives its own field metadata/copies in the setup-library
// assembler. These shared bases can later gain class-specific group overrides.
export const pavementLegendsSchema = ['pavementLegendsGeneral', 'pavementLegendsCorners', 'pavementLegendsFront', 'pavementLegendsRear'];
export const pavementLateModelSchema = ['pavementLateGeneral', 'pavementLateCorners', 'pavementLateFront', 'pavementLateRear'];
export const pavementModifiedSchema = ['pavementModifiedGeneral', 'pavementModifiedCorners', 'pavementModifiedFront', 'pavementModifiedRear'];
export const pavementCompactSchema = ['pavementCompactGeneral', 'pavementCompactCorners', 'pavementCompactFront', 'pavementCompactRear'];

export const PAVEMENT_FIELD_GROUPS: Record<string, ClassSection> = {
  pavementLegendsGeneral: section('pavement-legends-general', 'General Chassis', [
    ...weights, number('engine_rpm', 'Engine RPM — target peak', 'rpm'), ...stagger,
  ]),
  pavementLegendsCorners: corners('pavement-legends-corners', [
    ...basicCorners.map(f => f.key === 'tire_circumference' ? { ...f, label: 'Tire circumference / rollout (in)' } : f),
    number('wheel_offset', 'Wheel offset', 'in'),
  ]),
  pavementLegendsFront: section('pavement-legends-front', 'Front', [...alignment, number('steering_ratio', 'Steering ratio')]),
  pavementLegendsRear: section('pavement-legends-rear', 'Rear-End & Drivetrain', [
    number('panhard_frame_height', 'Panhard bar frame mount height', 'in'),
    number('panhard_axle_height', 'Panhard bar axle mount height', 'in'),
    number('rear_steer', 'Axle squareness / rear steer', 'in'), number('final_drive', 'Gear ratio'),
  ]),
  pavementLateGeneral: section('pavement-late-general', 'General Chassis', [
    ...weights, number('rear_bite', 'Rear bite', 'lb'), number('brake_bias', 'Brake bias — front', '%'),
    number('rear_brake_bias', 'Brake bias — rear', '%'), text('brake_pad_compound', 'Brake pad compound'),
    number('final_drive', 'Final drive gear ratio'), number('grille_tape', 'Grille tape', '%'),
  ]),
  pavementLateCorners: corners('pavement-late-corners', [
    ...basicCorners.slice(0, 2), ...tireTemperatures, ...basicCorners.slice(2), number('spring_free_length', 'Spring free length', 'in'),
    text('compression_low_speed', 'Shock low-speed compression', 'clicks / valving'),
    text('compression_high_speed', 'Shock high-speed compression', 'clicks / valving'),
    text('rebound_low_speed', 'Shock low-speed rebound', 'clicks / valving'),
    text('rebound_high_speed', 'Shock high-speed rebound', 'clicks / valving'),
    number('shock_gas_pressure', 'Shock gas pressure', 'psi'),
    number('bump_gap', 'Bump stop / packer gap', 'in'), text('bump_stop', 'Bump stop rate / color'),
  ]),
  pavementLateFront: section('pavement-late-front', 'Front', [
    ...alignment, number('front_sway_bar_diameter', 'Sway bar diameter', 'in'),
    text('front_arb_preload', 'Sway bar preload', 'turns / in'), number('sway_bar_arm_length', 'Sway bar arm length', 'in'),
    text('lf_upper_control_arm_setting', 'Left upper control arm angle / mount hole', 'deg / hole'),
    text('rf_upper_control_arm_setting', 'Right upper control arm angle / mount hole', 'deg / hole'),
    text('lf_lower_control_arm_setting', 'Left lower control arm angle / mount hole', 'deg / hole'),
    text('rf_lower_control_arm_setting', 'Right lower control arm angle / mount hole', 'deg / hole'),
    text('ackermann', 'Ackermann steering', 'in / deg'), number('spindle_height_drop', 'Spindle height / drop', 'in'),
  ]),
  pavementLateRear: section('pavement-late-rear', 'Rear-End & Drivetrain', [
    number('panhard_left_height', 'Track bar chassis left mount height', 'in'),
    number('panhard_right_height', 'Track bar chassis right mount height', 'in'),
    number('lr_trailing_arm_angle', 'Left trailing arm angle', 'deg'), number('rr_trailing_arm_angle', 'Right trailing arm angle', 'deg'),
    number('lr_trailing_arm_length', 'Left trailing arm length', 'in'), number('rr_trailing_arm_length', 'Right trailing arm length', 'in'),
    text('lr_trailing_arm_chassis_hole', 'Left trailing arm chassis mount hole'), text('rr_trailing_arm_chassis_hole', 'Right trailing arm chassis mount hole'),
    number('third_link_angle', 'Third link angle', 'deg'), text('third_link_pinion_hole', 'Third link pinion mount hole'),
    number('pinion_angle', 'Pinion angle', 'deg'), number('rear_steer', 'Rear steer / axle squareness', 'in'),
  ]),
  pavementModifiedGeneral: section('pavement-modified-general', 'General Chassis', [
    ...weights, number('brake_bias', 'Brake bias — front', '%'), number('final_drive', 'Final drive gear ratio'), ...stagger,
  ]),
  pavementModifiedCorners: corners('pavement-modified-corners', [
    ...basicCorners.slice(0, 2), ...tireTemperatures, ...basicCorners.slice(2), text('compression', 'Shock compression valving'), text('rebound', 'Shock rebound valving'),
  ]),
  pavementModifiedFront: section('pavement-modified-front', 'Front', [
    ...alignment, number('front_sway_bar_diameter', 'Sway bar diameter', 'in'), text('front_arb_preload', 'Sway bar preload', 'turns / in'),
    text('lf_upper_control_arm_mount', 'Left upper control arm mount height / hole', 'in / hole'),
    text('rf_upper_control_arm_mount', 'Right upper control arm mount height / hole', 'in / hole'),
  ]),
  pavementModifiedRear: section('pavement-modified-rear', 'Rear-End & Drivetrain', [
    number('panhard_chassis_height', 'Panhard bar / J-bar chassis mount height', 'in'),
    number('panhard_pinion_height', 'Panhard bar / J-bar pinion mount height', 'in'),
    text('lr_lower_trailing_arm_chassis_hole', 'Left lower trailing arm chassis hole'),
    text('rr_lower_trailing_arm_chassis_hole', 'Right lower trailing arm chassis hole'),
    text('lr_lower_trailing_arm_axle_hole', 'Left lower trailing arm axle hole'),
    text('rr_lower_trailing_arm_axle_hole', 'Right lower trailing arm axle hole'),
    number('pull_bar_angle', 'Pull bar / torque arm angle', 'deg'),
    text('pull_bar_rate_durometer', 'Pull bar spring rate / bushing durometer', 'lb/in / durometer'),
    number('pinion_angle', 'Pinion angle', 'deg'),
  ]),
  pavementCompactGeneral: section('pavement-compact-general', 'General Chassis', [
    ...weights.filter(f => f.key !== 'rear_weight_pct'), number('front_weight_pct', 'Front weight bias', '%'),
    text('transmission_gear', 'Transmission gear used'), number('final_drive', 'Final drive ratio'),
  ]),
  pavementCompactCorners: corners('pavement-compact-corners', [...basicCorners, text('shock_setting', 'Strut / shock valving')]),
  pavementCompactFront: section('pavement-compact-front', 'Front', [...alignment, number('front_sway_bar_diameter', 'Front sway bar diameter', 'in')]),
  pavementCompactRear: section('pavement-compact-rear', 'Rear-End & Drivetrain', [
    number('lr_camber', 'Left rear camber', 'deg'), number('rr_camber', 'Right rear camber', 'deg'),
    number('lr_toe', 'Left rear toe', 'deg'), number('rr_toe', 'Right rear toe', 'deg'),
    number('rear_sway_bar_diameter', 'Rear sway bar diameter', 'in'), number('track_width_spacers', 'Track width spacers', 'in'),
  ]),
};
