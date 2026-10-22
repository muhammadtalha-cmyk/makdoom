/** Geometry shared by the scene, the floor reflection shader and the choreography. No imports: safe everywhere. */
export const FLOOR_Y = -1.05;
export const PODIUM_TOP = FLOOR_Y + 0.14;
// Proportions measured from the real Makhdoom bottle: chunky square flacon, thick base, tall black cap.
export const BOTTLE = { w: 1.0, h: 1.25, d: 0.62, capH: 0.52, collarH: 0.1, capR: 0.215 };
export const BOTTLE_TOP = BOTTLE.h + BOTTLE.collarH + BOTTLE.capH;
