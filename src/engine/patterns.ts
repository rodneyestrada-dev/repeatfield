export type PatternId = 'straight'|'half-drop'|'brick'|'checker-rotate'|'mirror-grid'|'quarter-turn-rosette'|'triangle-kaleidoscope'|'radial-kaleidoscope';
export type SegmentCount = 3|4|6|8|12;
export const segmentOptions: SegmentCount[] = [3,4,6,8,12];
export const PATTERNS: {id: PatternId; name: string; code: string}[] = [
  ['straight','Straight Repeat'],['half-drop','Half-Drop'],['brick','Brick'],['checker-rotate','Checker Rotate'],['mirror-grid','Mirror Grid'],['quarter-turn-rosette','Quarter-Turn Rosette'],['triangle-kaleidoscope','Triangle Kaleidoscope'],['radial-kaleidoscope','Radial Kaleidoscope']
].map(([id,name], i) => ({id: id as PatternId, name, code: String(i+1).padStart(2,'0')}));
export interface RepeatSettings { patternId: PatternId; sourceZoom: number; sourceOffsetX: number; sourceOffsetY: number; sourceRotation: number; tileScale: number; gap: number; fieldRotation: number; segments: SegmentCount; showGuides: boolean; background: string }
export const DEFAULT_REPEAT: RepeatSettings = {patternId:'quarter-turn-rosette',sourceZoom:1,sourceOffsetX:0,sourceOffsetY:0,sourceRotation:0,tileScale:150,gap:0,fieldRotation:0,segments:8,showGuides:false,background:'#f2ece3'};
