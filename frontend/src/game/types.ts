export type BlockCategory = "normal" | "tech" | "guard" | "audit";
export type ChannelState = "overloaded" | "partial" | "guarded";
export type SoundCue = "lock" | "attack" | "break" | "audit" | "win" | "lose";
export type SegmentState = "stable" | "unstable" | "critical";

export interface Point {
  x: number;
  y: number;
}

export interface Cell {
  blockId: number;
  category: BlockCategory;
  baseDurability: number;
  durability: number;
  maxDurability: number;
  fortified: number;
  audited: boolean;
  flash: number;
}

export interface Piece {
  id: number;
  category: BlockCategory;
  shape: Point[][];
  rotation: number;
  x: number;
  y: number;
}

export interface AttackPulse {
  row: number;
  side: "left" | "right";
  age: number;
}

export interface AuditBurst {
  x: number;
  y: number;
  age: number;
}

export interface CableSegment {
  row: number;
  leftCovered: boolean;
  rightCovered: boolean;
  stress: number;
  protection: number;
  signalSpeed: number;
  signalBrightness: number;
  dropChance: number;
  glitchChance: number;
  state: SegmentState;
}

export interface SignalPacket {
  id: number;
  progress: number;
  laneOffset: number;
  brightness: number;
  corrupted: number;
  state: "travelling" | "dropping";
  age: number;
}

export interface GameSnapshot {
  grid: Array<Array<Cell | null>>;
  activePiece: Piece | null;
  nextPiece: Piece;
  cableSegments: CableSegment[];
  score: number;
  timeLeftSeconds: number;
  protectionLevel: number;
  systemIntegrity: number;
  attackIntensity: number;
  destroyedSegments: number;
  preservedSegments: number;
  routeCompleted: boolean;
  status: "running" | "won" | "lost";
  failureReason: string | null;
  channelState: ChannelState;
  attackPulses: AttackPulse[];
  auditBursts: AuditBurst[];
  signalPackets: SignalPacket[];
  linkQuality: number;
  packetLoss: number;
  throughput: number;
  latencyMs: number;
  deliveredPackets: number;
  droppedPackets: number;
  stableHoldSeconds: number;
  stableTargetSeconds: number;
  showHints: boolean;
  elapsedSeconds: number;
}

export interface FinishPayload {
  score: number;
  won: boolean;
  duration_seconds: number;
  protection_level: number;
  route_completed: boolean;
  destroyed_segments: number;
  preserved_segments: number;
  failure_reason: string | null;
  extra_data: Record<string, unknown>;
}

export interface EngineControls {
  start: () => void;
  stop: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  rotate: () => void;
  softDrop: () => void;
  hardDrop: () => void;
}
