// File: src/store.ts
import { create } from 'zustand';
import { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

export enum ViewMode {
  POV1 = 'POV 1 (Nose)',
  POV2 = 'POV 2 (Rear)',
  POV3 = 'POV 3 (Overhead)',
  POV4 = 'POV 4 (Custom)',
  OVERHEAD = 'OVERHEAD',
  SPLIT = 'SPLIT'
}

export interface Pov4Config {
  posX: number; posY: number; posZ: number;
  yaw: number; pitch: number; roll: number;
}

// אין ברירת מחדל "חכמה" — הכל מתחיל ב-0 (המצלמה על מרכז הרובוט)
const POV4_DEFAULT: Pov4Config = { posX: 0, posY: 0, posZ: 0, yaw: 0, pitch: 0, roll: 0 };

export type AppPhase = 'registration' | 'training' | 'session';

export interface SessionRecord {
  subjectId: string;
  subjectName: string;
  sessionNumber: number;
  sessionLabel: string;
  totalTime: string;
  seg1Time: string;
  eSeg1: number;
  seg2Time: string;
  eSeg2: number;
  narrowEntryTime: string;
  lap1Time: string;
  lap2Time: string;
  narrowExitTime: string;
}

export interface SegmentRecord {
  subjectId: string;
  subjectName: string;
  sessionNumber: number;
  segmentName: string;
  pov: string;
  symbology: string;
  steerMode: 'A' | 'B' | 'C';
  time: string;
  flips: number | string;
  // --- הגדרות POV4 ששלטו הכי הרבה זמן במקטע ---
  pov4DomPosX: string;
  pov4DomPosY: string;
  pov4DomPosZ: string;
  pov4DomYaw: string;
  pov4DomPitch: string;
  pov4DomRoll: string;
  // --- הגדרות POV4 האחרונות בסוף המקטע ---
  pov4LastPosX: string;
  pov4LastPosY: string;
  pov4LastPosZ: string;
  pov4LastYaw: string;
  pov4LastPitch: string;
  pov4LastRoll: string;
}

interface TelemetryState {
  pitch: number;
  roll: number;
  isFlipped: boolean;
  cameraYaw: number;
  cameraPitch: number;
  pov4: Pov4Config;
  setPov4: (patch: Partial<Pov4Config>) => void;
  resetPov4: () => void;
  viewMode: ViewMode;
  robotBodyRef: { current: RapierRigidBody | null };
  trackSpeedL: number;
  trackSpeedR: number;
  setTelemetry: (pitch: number, roll: number, isFlipped: boolean) => void;
  setCameraYaw: (yaw: number) => void;
  setCameraPitch: (pitch: number) => void;
  // --- רחפן ---
  droneView: boolean;            // true = שליטה וצפייה דרך הרחפן; false = שליטה ברובוט
  droneManual: boolean;          // true = הטסה ידנית (ריחוף במקום); false = מעקב אוטומטי
  dronePosition: [number, number, number];
  droneGimbalYaw: number;        // מעלות — סבסוב מצלמת המטען
  droneGimbalPitch: number;      // מעלות — הטיית מצלמת המטען
  droneFov: number;
  toggleDroneView: () => void;
  toggleDroneManual: () => void;
  setDronePosition: (p: [number, number, number]) => void;
  setDroneGimbal: (yaw: number, pitch: number) => void;
  setDroneFov: (fov: number) => void;
  aimScreenX: number;
  aimScreenY: number;
  aimVisible: boolean;
  setAimScreen: (x: number, y: number, visible: boolean) => void;
  steerMode: 'A' | 'B' | 'C';
  setSteerMode: (m: 'A' | 'B' | 'C') => void;
  setViewMode: (mode: ViewMode) => void;
  setTrackSpeeds: (l: number, r: number) => void;
  // --- שדות תיעוד לפי מקטע ---
  segmentRecords: SegmentRecord[];
  augLayerOn: boolean;
  symLayerOn: boolean;
  setLayerFlags: (aug: boolean, sym: boolean) => void;
  _povDwell: Record<string, number>;
  _povSince: number;
  _symDwell: Record<string, number>;
  _symSince: number;
  _pov4Dwell: Record<string, number>;
  _pov4Since: number;
  _pushSegment: (segmentName: string, startTs: number | null, endTs: number | null, flips: number | null) => void;

  // --- ניהול שלבי הניסוי ---
  appPhase: AppPhase;
  menuOpen: boolean;
  subjectId: string;
  subjectName: string;
  currentSessionNumber: number | null;
  sessionComplete: boolean;
  sessionRecords: SessionRecord[];
  resetRequest: number;
  setSubjectAndStart: (id: string, name: string) => void;
  goToTraining: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  startSession: (num: number) => void;
  requestReset: () => void;
  commitSessionRecord: () => void;

  // --- משתני זמני הניסוי והצ'קפוינט ---
  expStart: number | null;
  expEnd: number | null;
  seg1End: number | null;
  seg2End: number | null;
  narrowStart: number | null;
  narrowEnd: number | null;
  lap1Start: number | null;
  lap1End: number | null;
  lap2Start: number | null;
  lap2End: number | null;
  narrowExitStart: number | null;
  narrowExitEnd: number | null;
  alley1Start: number | null;
  alley1End: number | null;
  alley2Start: number | null;
  alley2End: number | null;
  hill6EndTouchCount: number;
  lastHill6EndTouch: number;

  insideTouchCount: number;
  lastInsideTouch: number;
  corridor2TouchCount: number;
  lastCorridor2Touch: number;
  corridor1TouchCount: number;
  lastCorridor1Touch: number;

  lastCheckpoint: { pos: { x: number, y: number, z: number }, rot: { x: number, y: number, z: number, w: number } } | null;
  saveCheckpoint: () => void;

  eCountSeg1: number;
  eCountSeg2: number;
  eCountNarrow: number;
  eCountLaps: number;
  recordEPress: () => void;

  // --- שערים וירטואליים בראשי הגבעות ---
  currentGateIndex: number;
  passGate: (index: number) => void;

  triggerSensor2: () => void;
  triggerSensor3: () => void;
  triggerHill6End: () => void;
  triggerBldgOutside: () => void;
  triggerBldgInside: () => void;
  triggerSensor4: () => void;
  triggerSensor6: () => void;
  triggerSensor5: () => void;
  downloadCSV: () => void;
}
// ממיר את מצב שתי שכבות-העל לתווית של חלופת הסימון
const symLabel = (aug: boolean, sym: boolean) =>
  aug && sym ? 'שניהם' : aug ? 'אוגמנטציה' : sym ? 'סימבולוגיה' : 'ללא';

// ממיר את מזהה ה-POV לתווית קריאה בקובץ
const povName = (v: string) =>
  v === ViewMode.POV1 ? '1 (אף)' :
  v === ViewMode.POV2 ? '2 (אחורי)' :
  v === ViewMode.POV3 ? '3 (על)' :
  v === ViewMode.POV4 ? '4 (מותאם)' : String(v);
// ערכי ברירת מחדל לאיפוס מלא של מדדי הסשן (נקרא בכל תחילת סשן חדש)
const blankTimers = {
  expStart: null, expEnd: null, seg1End: null, seg2End: null,
  narrowStart: null, narrowEnd: null,
  lap1Start: null, lap1End: null, lap2Start: null, lap2End: null,
  narrowExitStart: null, narrowExitEnd: null,
  alley1Start: null, alley1End: null,
  alley2Start: null, alley2End: null,
  hill6EndTouchCount: 0, lastHill6EndTouch: 0,
  insideTouchCount: 0, lastInsideTouch: 0,
  corridor2TouchCount: 0, lastCorridor2Touch: 0,
  corridor1TouchCount: 0, lastCorridor1Touch: 0,
  eCountSeg1: 0, eCountSeg2: 0, eCountNarrow: 0, eCountLaps: 0,
  lastCheckpoint: null,
  currentGateIndex: 0,
};

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  pitch: 0,
  roll: 0,
  isFlipped: false,
  cameraYaw: 0,
  cameraPitch: 0,
  viewMode: ViewMode.POV2,
  robotBodyRef: { current: null },
  trackSpeedL: 0,
  trackSpeedR: 0,
  segmentRecords: [],
  augLayerOn: false,
  symLayerOn: false,
  _povDwell: {},
  _povSince: 0,
  _symDwell: {},
  _symSince: 0,
  _pov4Dwell: {},
  _pov4Since: 0,
  setTelemetry: (pitch, roll, isFlipped) => set({ pitch, roll, isFlipped }),
  setCameraYaw: (yaw) => set({ cameraYaw: yaw }),
  setCameraPitch: (pitch) => set({ cameraPitch: pitch }),
  pov4: { ...POV4_DEFAULT },
  setPov4: (patch) => {
    const s = get();
    const now = Date.now();
    // אם היינו ב-POV4, צוברים את הזמן שעבר לתצורה הקודמת לפני שמעדכנים
    if (s.viewMode === ViewMode.POV4) {
      const key = `${s.pov4.posX},${s.pov4.posY},${s.pov4.posZ},${s.pov4.yaw},${s.pov4.pitch},${s.pov4.roll}`;
      set({
        _pov4Dwell: { ...s._pov4Dwell, [key]: (s._pov4Dwell[key] || 0) + (now - (s._pov4Since || now)) },
        _pov4Since: now,
        pov4: { ...s.pov4, ...patch },
      });
    } else {
      set({ pov4: { ...s.pov4, ...patch } });
    }
  },
  resetPov4: () => set({ pov4: { ...POV4_DEFAULT } }),
  // --- רחפן ---
  droneView: false,
  droneManual: false,
  dronePosition: [0, 7.5, 11],
  droneGimbalYaw: 0,
  droneGimbalPitch: -15,
  droneFov: 60,
  toggleDroneView: () => set(s => ({ droneView: !s.droneView })),
  toggleDroneManual: () => set(s => ({ droneManual: !s.droneManual })),
  setDronePosition: (p) => set({ dronePosition: p }),
  setDroneGimbal: (yaw, pitch) =>
    set({ droneGimbalYaw: yaw, droneGimbalPitch: Math.max(-90, Math.min(90, pitch)) }),
  setDroneFov: (fov) => set({ droneFov: Math.max(20, Math.min(100, fov)) }),

  // מיקום הצלב המעוגל על המסך, בפיקסלים ממרכז המסך.
  // מחושב ב-Robot.tsx על ידי היטל אמיתי דרך המצלמה הפעילה.
  aimScreenX: 0,
  aimScreenY: 0,
  aimVisible: false,
  setAimScreen: (x, y, visible) => {
    const s = get();
    // מעדכנים רק כשיש שינוי אמיתי, כדי לא לצייר מחדש לחינם בכל פריים
    if (s.aimVisible === visible &&
        Math.abs(s.aimScreenX - x) < 0.5 &&
        Math.abs(s.aimScreenY - y) < 0.5) return;
    set({ aimScreenX: x, aimScreenY: y, aimVisible: visible });
  },
  steerMode: 'A',
  setSteerMode: (m) => set({ steerMode: m }),
  setViewMode: (mode) => {
    const s = get();
    const now = Date.now();
    set({
      _povDwell: { ...s._povDwell, [s.viewMode]: (s._povDwell[s.viewMode] || 0) + (now - (s._povSince || now)) },
      _povSince: now,
      viewMode: mode,
    });
  },
  setTrackSpeeds: (l, r) => set({ trackSpeedL: l, trackSpeedR: r }),
  // מדווח ל-store אילו שכבות-על פעילות כרגע (נקרא מ-LayersMenu)
  setLayerFlags: (aug, sym) => {
    const s = get();
    const now = Date.now();
    const prevKey = symLabel(s.augLayerOn, s.symLayerOn);
    set({
      _symDwell: { ...s._symDwell, [prevKey]: (s._symDwell[prevKey] || 0) + (now - (s._symSince || now)) },
      _symSince: now,
      augLayerOn: aug,
      symLayerOn: sym,
    });
  },

  // נקרא בכל סוף-מקטע: בוחר את ה-POV והסימבולוגיה ששלטו הכי הרבה זמן, ורושם שורה
  _pushSegment: (segmentName, startTs, endTs, flips) => {
    const s = get();
    const now = Date.now();
    const povD = { ...s._povDwell };
    povD[s.viewMode] = (povD[s.viewMode] || 0) + (now - (s._povSince || now));
    const symKey = symLabel(s.augLayerOn, s.symLayerOn);
    const symD = { ...s._symDwell };
    symD[symKey] = (symD[symKey] || 0) + (now - (s._symSince || now));
    const dom = (obj: Record<string, number>) =>
      Object.keys(obj).reduce((a, b) => (obj[a] >= obj[b] ? a : b));
    const povWinner = dom(povD);
    const symWinner = dom(symD);
    const time = (!startTs || !endTs) ? 'N/A' : ((endTs - startTs) / 1000).toFixed(2);

    // --- POV4: צוברים את זמן התצורה הנוכחית לפני הבחירה ---
    const pov4D = { ...s._pov4Dwell };
    if (s.viewMode === ViewMode.POV4) {
      const curKey = `${s.pov4.posX},${s.pov4.posY},${s.pov4.posZ},${s.pov4.yaw},${s.pov4.pitch},${s.pov4.roll}`;
      pov4D[curKey] = (pov4D[curKey] || 0) + (now - (s._pov4Since || now));
    }
    // התצורה ששלטה הכי הרבה זמן במקטע (אם בכלל היה POV4)
    const pov4Keys = Object.keys(pov4D);
    const domPov4 = pov4Keys.length > 0
      ? pov4Keys.reduce((a, b) => (pov4D[a] >= pov4D[b] ? a : b)).split(',')
      : ['', '', '', '', '', ''];
    // התצורה האחרונה בפועל (הערכים הנוכחיים של הסליידרים)
    const lastPov4 = s.pov4;

    const record: SegmentRecord = {
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      sessionNumber: s.currentSessionNumber ?? 0,
      segmentName,
      pov: povName(povWinner),
      symbology: symWinner,
      steerMode: s.steerMode,
      time,
      flips: flips === null ? '' : flips,
      pov4DomPosX: domPov4[0], pov4DomPosY: domPov4[1], pov4DomPosZ: domPov4[2],
      pov4DomYaw: domPov4[3], pov4DomPitch: domPov4[4], pov4DomRoll: domPov4[5],
      pov4LastPosX: String(lastPov4.posX), pov4LastPosY: String(lastPov4.posY), pov4LastPosZ: String(lastPov4.posZ),
      pov4LastYaw: String(lastPov4.yaw), pov4LastPitch: String(lastPov4.pitch), pov4LastRoll: String(lastPov4.roll),
    };
    set({
      segmentRecords: [...s.segmentRecords, record],
      _povDwell: {}, _povSince: now, _symDwell: {}, _symSince: now,
      _pov4Dwell: {}, _pov4Since: now,
    });
  },

  // --- שלבי הניסוי ---
  appPhase: 'registration',
  menuOpen: false,
  subjectId: '',
  subjectName: '',
  currentSessionNumber: null,
  sessionComplete: false,
  sessionRecords: [],
  resetRequest: 0,

  setSubjectAndStart: (id, name) => {
    set({ subjectId: id, subjectName: name, appPhase: 'training', menuOpen: false, sessionComplete: false, viewMode: ViewMode.POV2, pov4: { ...POV4_DEFAULT }, steerMode: 'A' });
    get().requestReset();
  },

  goToTraining: () => {
    set({ appPhase: 'training', menuOpen: false, sessionComplete: false, viewMode: ViewMode.POV2, steerMode: 'A' });
    get().requestReset();
  },

  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),

  startSession: (num) => {
    const t = Date.now();
    set({ ...blankTimers, appPhase: 'session', currentSessionNumber: num, sessionComplete: false, menuOpen: false, viewMode: ViewMode.POV2, steerMode: 'A', _povDwell: {}, _povSince: t, _symDwell: {}, _symSince: t });
    get().requestReset();
  },

  requestReset: () => set(state => ({ resetRequest: state.resetRequest + 1 })),

  // שמירת שורת סשן בזיכרון (ללא הורדה). שומר על שמות ייחודיים כדי לא לדרוס.
  commitSessionRecord: () => {
    const s = get();
    const effectiveEnd = s.expEnd || Date.now();
    const calc = (a: number | null, b: number | null) => (!a || !b) ? "N/A" : ((b - a) / 1000).toFixed(2);
    const num = s.currentSessionNumber ?? 0;
    const priorCount = s.sessionRecords.filter(r => r.sessionNumber === num).length;
    const label = priorCount === 0 ? String(num) : `${num} (${priorCount})`;

    const record: SessionRecord = {
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      sessionNumber: num,
      sessionLabel: label,
      totalTime: calc(s.expStart, effectiveEnd),
      seg1Time: calc(s.expStart, s.seg1End),
      eSeg1: s.eCountSeg1,
      seg2Time: calc(s.seg1End, s.seg2End),
      eSeg2: s.eCountSeg2,
      narrowEntryTime: calc(s.narrowStart, s.narrowEnd),
      lap1Time: calc(s.lap1Start, s.lap1End),
      lap2Time: calc(s.lap2Start, s.lap2End),
      narrowExitTime: calc(s.narrowExitStart, s.narrowExitEnd),
    };

    set({ sessionRecords: [...s.sessionRecords, record] });
    console.log("Session record saved:", record);
  },

  expStart: null,
  expEnd: null,
  seg1End: null,
  seg2End: null,
  narrowStart: null,
  narrowEnd: null,
  lap1Start: null,
  lap1End: null,
  lap2Start: null,
  lap2End: null,
  narrowExitStart: null,
  narrowExitEnd: null,

  alley1Start: null,
  alley1End: null,
  alley2Start: null,
  alley2End: null,
  hill6EndTouchCount: 0,
  lastHill6EndTouch: 0,

  insideTouchCount: 0,
  lastInsideTouch: 0,
  corridor2TouchCount: 0,
  lastCorridor2Touch: 0,
  corridor1TouchCount: 0,
  lastCorridor1Touch: 0,

  lastCheckpoint: null,

  eCountSeg1: 0,
  eCountSeg2: 0,
  eCountNarrow: 0,
  eCountLaps: 0,

  // --- שערים וירטואליים: מתחילים בשער הראשון (אינדקס 0) ---
  currentGateIndex: 0,

  // נקרא כשהרובוט חוצה את השער הפעיל. מקדם את האינדקס לשער הבא בלבד.
  passGate: (index) => {
    if (get().currentGateIndex === index) {
      set({ currentGateIndex: index + 1 });
      console.log(`Gate ${index} passed. Next gate: ${index + 1}`);
    }
  },

  recordEPress: () => {
    const { expStart, seg1End, narrowStart, narrowEnd, expEnd } = get();
    if (!expStart || expEnd) return;

    if (!seg1End) {
      set(state => ({ eCountSeg1: state.eCountSeg1 + 1 }));
      console.log(`E pressed in Segment 1. Count: ${get().eCountSeg1}`);
    } else if (!narrowStart) {
      set(state => ({ eCountSeg2: state.eCountSeg2 + 1 }));
      console.log(`E pressed in Segment 2. Count: ${get().eCountSeg2}`);
    } else if (!narrowEnd) {
      set(state => ({ eCountNarrow: state.eCountNarrow + 1 }));
      console.log(`E pressed in Narrow Passage. Count: ${get().eCountNarrow}`);
    } else {
      set(state => ({ eCountLaps: state.eCountLaps + 1 }));
      console.log(`E pressed in Corridor Laps. Count: ${get().eCountLaps}`);
    }
  },

  saveCheckpoint: () => {
    const body = get().robotBodyRef.current;
    if (body) {
      const pos = body.translation();
      const rot = body.rotation();
      const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w), 'YXZ');
      const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'));

      set({
        lastCheckpoint: {
          pos: { x: pos.x, y: 1.5, z: pos.z },
          rot: { x: flatQuat.x, y: flatQuat.y, z: flatQuat.z, w: flatQuat.w }
        }
      });
      console.log("Checkpoint Saved!");
    }
  },

  triggerSensor2: () => {
    get().saveCheckpoint();
    if (!get().expStart) {
      console.log("Experiment & Segment 1 Started");
      set({ expStart: Date.now() });
    }
  },

  triggerSensor3: () => {
    get().saveCheckpoint();
    if (get().expStart && !get().seg1End) {
      console.log("Segment 1 Ended, Segment 2 Started");
      set({ seg1End: Date.now() });
      get()._pushSegment('גבעות 1', get().expStart, get().seg1End, get().eCountSeg1);
    }
  },

  triggerHill6End: () => {
    const now = Date.now();
    const { hill6EndTouchCount, lastHill6EndTouch } = get();
    // מונע ספירה כפולה: מתעלמים מנגיעות שמתרחשות תוך 3 שניות מהקודמת
    if (now - lastHill6EndTouch < 3000) return;
    get().saveCheckpoint();

    if (hill6EndTouchCount === 0) {
      // נגיעה ראשונה: סוף גבעות 2 + התחלת סמטה 1
      console.log("Segment 2 Ended, Alley 1 Started");
      set({ seg2End: now, alley1Start: now, hill6EndTouchCount: 1, lastHill6EndTouch: now });
      get()._pushSegment('גבעות 2', get().seg1End, now, get().eCountSeg2);
    } else if (hill6EndTouchCount === 1) {
      // נגיעה שנייה: סוף סמטה 2 + סוף הניסוי כולו
      console.log("Alley 2 Ended, Experiment Finished");
      set({ alley2End: now, expEnd: now, hill6EndTouchCount: 2, lastHill6EndTouch: now });
      get()._pushSegment('מעבר בסמטה 2', get().alley2Start, now, null);
      get().commitSessionRecord();
      set({ sessionComplete: true });
    } else {
      set({ lastHill6EndTouch: now });
    }
  },

  triggerBldgOutside: () => {
    get().saveCheckpoint();
    if (!get().narrowStart) {
      // סוף סמטה 1 (אם היא נמדדת) — נרשם לפני תחילת הפתח הצר
      if (get().alley1Start && !get().alley1End) {
        const now = Date.now();
        set({ alley1End: now });
        get()._pushSegment('מעבר בסמטה 1', get().alley1Start, now, null);
      }
      console.log("Narrow Passage (Entry) Started");
      set({ narrowStart: Date.now() });
    }
  },

  // sensor-bldg-inside = שטיח הכניסה. נדרך שלוש פעמים:
  // דריכה 1: מסיים "פתח צר - כניסה". דריכה 2: מסיים סיבוב 1 ומתחיל סיבוב 2.
  // דריכה 3 (מהירה): לא עושה כלום, רק נספרת.
  triggerBldgInside: () => {
    const now = Date.now();
    const { insideTouchCount, lastInsideTouch } = get();
    // חלון קצר נגד רעידות פיזיקה בלבד. דריכה מהירה אמיתית עדיין נספרת.
    if (now - lastInsideTouch < 700) return;
    get().saveCheckpoint();

    if (insideTouchCount === 0) {
      // דריכה 1: סוף פתח צר כניסה
      console.log("Narrow (Entry) Ended");
      set({ narrowEnd: now, insideTouchCount: 1, lastInsideTouch: now });
      get()._pushSegment('פתח צר - כניסה', get().narrowStart, now, get().eCountNarrow);
    } else if (insideTouchCount === 1) {
      // דריכה 2: סוף סיבוב 1 + התחלת סיבוב 2
      console.log("Lap 1 Ended, Lap 2 Started");
      set({ lap1End: now, lap2Start: now, insideTouchCount: 2, lastInsideTouch: now });
      get()._pushSegment('סיבוב 1', get().lap1Start, now, null);
    } else if (insideTouchCount === 2) {
      // דריכה 3 (מהירה): מעבר בדרך — נספרת אך אינה מודדת דבר
      console.log("BldgInside pass-through touch - ignored");
      set({ insideTouchCount: 3, lastInsideTouch: now });
    } else {
      set({ lastInsideTouch: now });
    }
  },

  // מנוטרל: השטיח הימני נשאר קיים אך אינו מודד דבר.
  // כל הסיבובים עברו ל-sensor-6 (השמאלי) ול-sensor-bldg-inside.
  triggerSensor4: () => {
    get().saveCheckpoint();
  },

  // sensor-6 (השמאלי) = קצה המסדרון. נדרך שלוש פעמים:
  // דריכה 1: מתחיל סיבוב 1. דריכה 2 (מהירה): לא עושה כלום, רק נספרת.
  // דריכה 3: מסיים סיבוב 2 ופותח "פתח צר - יציאה".
  triggerSensor6: () => {
    const now = Date.now();
    const { corridor1TouchCount, lastCorridor1Touch } = get();
    // חלון קצר נגד רעידות פיזיקה בלבד. דריכה מהירה אמיתית עדיין נספרת.
    if (now - lastCorridor1Touch < 700) return;
    get().saveCheckpoint();

    if (corridor1TouchCount === 0) {
      // דריכה 1: התחלת סיבוב 1
      console.log("Lap 1 Started");
      set({ lap1Start: now, corridor1TouchCount: 1, lastCorridor1Touch: now });
    } else if (corridor1TouchCount === 1) {
      // דריכה 2 (מהירה): מעבר בדרך — נספרת אך אינה מודדת דבר
      console.log("Sensor6 pass-through touch - ignored");
      set({ corridor1TouchCount: 2, lastCorridor1Touch: now });
    } else if (corridor1TouchCount === 2) {
      // דריכה 3: סוף סיבוב 2 + פתיחת פתח צר יציאה
      console.log("Lap 2 Ended, Narrow (Exit) Started");
      set({ lap2End: now, narrowExitStart: now, corridor1TouchCount: 3, lastCorridor1Touch: now });
      get()._pushSegment('סיבוב 2', get().lap2Start, now, null);
    } else {
      set({ lastCorridor1Touch: now });
    }
  },

  // שטיח אחרון: עוצר מדידה, שומר שורה בזיכרון, ומדליק את כפתור "הבא".
  triggerSensor5: () => {
    if (get().expStart && !get().expEnd && !get().narrowExitEnd) {
      const now = Date.now();
      // סוף פתח צר יציאה + התחלת סמטה 2 (הניסוי לא נגמר כאן יותר!)
      set({ narrowExitEnd: now, alley2Start: now });
      get()._pushSegment('פתח צר - יציאה', get().narrowExitStart, now, null);
      console.log("Narrow (Exit) Ended, Alley 2 Started");
    }
  },

  // מוריד קובץ CSV עם כל השורות שנצברו (שורה לכל סשן).
  downloadCSV: () => {
    const s = get();
    if (s.segmentRecords.length === 0) {
      alert("עדיין לא נשמרו מקטעים. יש להשלים לפחות מקטע אחד לפני ההורדה.");
      return;
    }

    const headers = [
      "מספר נבדק",
      "שם נבדק",
      "מספר הסשן",
      "מקטע",
      "POV",
      "סימבולוגיה",
      "אופן ניהוג",
      "זמן (שניות)",
      "מספר התהפכויות (לחיצה על e)",
      "POV4 שולט - X", "POV4 שולט - Y", "POV4 שולט - Z",
      "POV4 שולט - Yaw", "POV4 שולט - Pitch", "POV4 שולט - Roll",
      "POV4 אחרון - X", "POV4 אחרון - Y", "POV4 אחרון - Z",
      "POV4 אחרון - Yaw", "POV4 אחרון - Pitch", "POV4 אחרון - Roll",
    ];

    const rows = s.segmentRecords.map(r => [
      r.subjectId, r.subjectName, r.sessionNumber, r.segmentName,
      r.pov, r.symbology, r.steerMode, r.time, r.flips,
      r.pov4DomPosX, r.pov4DomPosY, r.pov4DomPosZ,
      r.pov4DomYaw, r.pov4DomPitch, r.pov4DomRoll,
      r.pov4LastPosX, r.pov4LastPosY, r.pov4LastPosZ,
      r.pov4LastYaw, r.pov4LastPitch, r.pov4LastRoll,
    ]);

    const esc = (v: any) => {
      const str = String(v ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    // BOM (\uFEFF) כדי שעברית תיפתח נכון באקסל
    const csvContent = "\uFEFF" + [headers, ...rows].map(row => row.map(esc).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `subject_${s.subjectId || 'unknown'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}));