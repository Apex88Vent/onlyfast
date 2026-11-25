// Presentation only. Stored accelerations, calibration and sensor smoothing are unchanged.
export const G_FORCE_VISUAL={yellow:.75,red:1.5,radius:48} as const;
export function gForceVisual(lateral:number,longitudinal:number){
  const actual=Math.hypot(lateral,longitudinal),scale=actual>G_FORCE_VISUAL.red?G_FORCE_VISUAL.red/actual:1;
  return {actual,x:lateral*scale/G_FORCE_VISUAL.red,y:-longitudinal*scale/G_FORCE_VISUAL.red,
    zone:actual>=G_FORCE_VISUAL.red?'red':actual>=G_FORCE_VISUAL.yellow?'yellow':'neutral'} as const;
}
