// src/App.tsx

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { View } from '@react-three/drei';
import { Robot, RobotVisuals } from './components/Robot';
import { World } from './components/World';
import { InfoBar } from './components/InfoBar';
import { LayersMenu } from './components/LayersMenu';
import { ExperimentUI } from './components/ExperimentUI';
import { DroneControls, DroneVisuals } from './components/Drone';
import { useTelemetryStore, ViewMode } from './store';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const view1Ref = useRef<HTMLDivElement>(null);
  const view2Ref = useRef<HTMLDivElement>(null);
  const viewMode = useTelemetryStore(s => s.viewMode);
  const appPhase = useTelemetryStore(s => s.appPhase);
  const steerMode = useTelemetryStore(s => s.steerMode);
  const droneView = useTelemetryStore(s => s.droneView);

  // practice = שטח אימון נקי (כל מה שאינו סשן). sym = סימבוליקה/מדידה (רק בסשן).
  const practice = appPhase !== 'session';
  const sym = appPhase === 'session';

  const [layers, setLayers] = useState({
    augmentation: true,
    symbology: true,
    horizon: true,
    compass: true,
    path: false,
    attitude: true,
    centerAttitude: true,
    predictive: true,
    hillOverlay: false,
  });

  // ================= חלונית מבט-על (Picture in Picture) =================
  // pipBoxRef  – המסגרת החיצונית שאותה גוררים ומשנים בגודל
  // pipOpen    – האם החלונית פתוחה (נפתחת/נסגרת ב-Command+P / Ctrl+P)
  // pipPosRef  – מיקום החלונית (נשמר ב-ref; משתנה ישירות בזמן גרירה, בלי רינדור מחדש)
  // pipSizeRef – גודל החלונית (נשמר ב-ref; משתנה ישירות בזמן שינוי גודל)
  const pipBoxRef = useRef<HTMLDivElement>(null);
  const [pipOpen, setPipOpen] = useState(false);
  const [pipCanvasKey, setPipCanvasKey] = useState(0); // בכל שינוי שלו – מבט-העל מצויר מחדש לפי הגודל הנוכחי
  const pipPosRef = useRef({ x: 24, y: 96 });
  const pipSizeRef = useRef({ w: 260, h: 200 });
  const pipDrag = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  const pipResize = useRef({
    active: false, dir: '',
    startX: 0, startY: 0, startLeft: 0, startTop: 0, startW: 0, startH: 0,
  });

  // פתיחה/סגירה של החלונית ב-Command+P (מק) או Ctrl+P (ווינדוס)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault(); // מבטל את חלון ההדפסה של הדפדפן
        setPipOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // גרירה ושינוי-גודל — הכל דרך שינוי ישיר של ה-style, בלי setState,
  // כדי שהחלונית תישאר חלקה ולא תתרנדר מחדש באמצע.
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      const box = pipBoxRef.current;
      if (!box) return;

      // --- גרירה (הזזה) ---
      if (pipDrag.current.dragging) {
        const x = e.clientX - pipDrag.current.offsetX;
        const y = e.clientY - pipDrag.current.offsetY;
        pipPosRef.current = { x, y };
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        return;
      }

      // --- שינוי גודל ---
      if (pipResize.current.active) {
        const r = pipResize.current;
        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;
        let left = r.startLeft, top = r.startTop, w = r.startW, h = r.startH;
        const MIN_W = 260, MIN_H = 200; // גודל מינימלי של החלונית

        if (r.dir.includes('e')) w = r.startW + dx;
        if (r.dir.includes('s')) h = r.startH + dy;
        if (r.dir.includes('w')) { w = r.startW - dx; left = r.startLeft + dx; }
        if (r.dir.includes('n')) { h = r.startH - dy; top = r.startTop + dy; }

        const MAX_W = 520, MAX_H = 400; // גודל מקסימלי של החלונית — אפשר לשנות את המספרים
        if (w < MIN_W) { if (r.dir.includes('w')) left -= (MIN_W - w); w = MIN_W; }
        if (h < MIN_H) { if (r.dir.includes('n')) top -= (MIN_H - h); h = MIN_H; }
        if (w > MAX_W) { if (r.dir.includes('w')) left -= (MAX_W - w); w = MAX_W; }
        if (h > MAX_H) { if (r.dir.includes('n')) top -= (MAX_H - h); h = MAX_H; }

        pipPosRef.current = { x: left, y: top };
        pipSizeRef.current = { w, h };
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
      }
    };
    const onUp = () => {
      pipDrag.current.dragging = false;
      if (pipResize.current.active) {
        pipResize.current.active = false;
        setPipCanvasKey(k => k + 1); // סיימנו לשנות גודל → מציירים מחדש את מבט-העל לפי הגודל החדש
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // מתחילים גרירה (לחיצה על פס הכותרת)
  const startPipDrag = (e: React.MouseEvent) => {
    pipDrag.current.dragging = true;
    pipDrag.current.offsetX = e.clientX - pipPosRef.current.x;
    pipDrag.current.offsetY = e.clientY - pipPosRef.current.y;
    e.preventDefault();
  };

  // מתחילים שינוי-גודל (לחיצה על אחת מהידיות בגבולות). dir = כיוון: n/s/e/w וצירופים.
  const startPipResize = (dir: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = pipResize.current;
    r.active = true;
    r.dir = dir;
    r.startX = e.clientX;
    r.startY = e.clientY;
    r.startLeft = pipPosRef.current.x;
    r.startTop = pipPosRef.current.y;
    r.startW = pipSizeRef.current.w;
    r.startH = pipSizeRef.current.h;
  };

  // רשימת הידיות: 4 שוליים + 4 פינות, כל אחת עם המיקום והסמן המתאים
  const pipHandles = [
    { dir: 'n',  cls: 'top-0 left-0 right-0 h-1 cursor-ns-resize' },
    { dir: 's',  cls: 'bottom-0 left-0 right-0 h-1 cursor-ns-resize' },
    { dir: 'e',  cls: 'top-0 bottom-0 right-0 w-1 cursor-ew-resize' },
    { dir: 'w',  cls: 'top-0 bottom-0 left-0 w-1 cursor-ew-resize' },
    { dir: 'ne', cls: 'top-0 right-0 w-3 h-3 cursor-nesw-resize' },
    { dir: 'nw', cls: 'top-0 left-0 w-3 h-3 cursor-nwse-resize' },
    { dir: 'se', cls: 'bottom-0 right-0 w-3 h-3 cursor-nwse-resize' },
    { dir: 'sw', cls: 'bottom-0 left-0 w-3 h-3 cursor-nesw-resize' },
  ];

  useEffect(() => {
    if (viewMode === ViewMode.POV1) {
      setLayers(prev => ({ ...prev, horizon: false }));
    } else {
      setLayers(prev => ({ ...prev, horizon: false }));
    }
  }, [viewMode]);

  return (
    <div ref={containerRef} className="w-full h-screen bg-gray-900 relative overflow-hidden select-none">
      <div className="absolute inset-0 flex flex-row">
        {viewMode === ViewMode.SPLIT ? (
          <>
            <div ref={view1Ref} className="flex-1 h-full border-r border-red-900/50 relative">
               <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-900/80 text-white text-[10px] font-mono z-10 rounded">TPV_CAM_A</div>
            </div>
            <div ref={view2Ref} className="flex-1 h-full relative">
               <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-900/80 text-white text-[10px] font-mono z-10 rounded">FPV_CAM_B</div>
            </div>
          </>
        ) : (
          <div ref={view1Ref} className="w-full h-full" />
        )}
      </div>

      <Canvas shadows eventSource={containerRef} className="pointer-events-none">
        <Physics>
          <World practice={practice} showHillOverlay={layers.hillOverlay} showCompass={sym && layers.symbology && layers.compass} />
          <Robot hideVisuals={true} />
        </Physics>

        <DroneControls />

        <View track={view1Ref}>
           <World visualsOnly={true} practice={practice} showHillOverlay={layers.hillOverlay} />
           <RobotVisuals sync={true} showPredictive={sym && layers.predictive} yieldToDrone={true} />
           <DroneVisuals camera={droneView} />
        </View>

        {viewMode === ViewMode.SPLIT && (
          <View track={view2Ref}>
            <World visualsOnly={true} practice={practice} showHillOverlay={layers.hillOverlay} />
            <RobotVisuals mode={ViewMode.POV1} sync={true} showPredictive={sym && layers.predictive}/>
          </View>
        )}
      </Canvas>

      {(appPhase === 'training' || appPhase === 'session') && (
        <InfoBar 
          showHorizon={sym && layers.horizon} 
          showCompass={sym && layers.compass} 
          showAttitude={sym && layers.attitude}
          showCenterAttitude={sym && layers.centerAttitude} 
        />
      )}

      {(appPhase === 'training' || appPhase === 'session') && <LayersMenu layers={layers} setLayers={setLayers} />}
      {/* כפתור מבט-על (PiP) — מתחת לכפתור השכבות, אותו גודל וסגנון */}
      {(appPhase === 'training' || appPhase === 'session') && (
        <button
          onClick={() => setPipOpen(o => !o)}
          className="absolute top-16 right-4 z-50 bg-black/70 hover:bg-black/90 backdrop-blur-sm rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center overflow-hidden pointer-events-auto w-10 h-10"
          title="מבט-על (Picture in Picture)"
        >
          {/* אייקון PiP מצויר: מסגרת גדולה + חלון קטן בפינה עליונה-שמאלית */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="15" rx="2" stroke="white" strokeWidth="1.8" opacity="0.9" />
            <rect x="5" y="6" width="7" height="6" rx="1" fill="white" opacity="0.9" />
          </svg>
        </button>
      )}
      {/* כפתור מצב ניהוג — לחיצה מחליפה A→B→C */}
      {(appPhase === 'training' || appPhase === 'session') && (
        <button
          onClick={() => {
            const cur = useTelemetryStore.getState().steerMode;
            const next = cur === 'A' ? 'B' : cur === 'B' ? 'C' : 'A';
            useTelemetryStore.getState().setSteerMode(next);
          }}
          className="absolute top-28 right-4 z-50 w-10 h-10 flex items-center justify-center pointer-events-auto rounded-full border border-white/25 bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
          title={`מצב ניהוג: ${steerMode} · לחיצה להחלפה`}
        >
          <span className="text-white/80 font-sans text-xs font-bold tabular-nums">
            {steerMode}
          </span>
        </button>
      )}

      {/* ================= חלונית מבט-העל ================= */}
      {/* קנבס עצמאי משלה — מנותק מהמסך הראשי, ולכן לא הופך שקוף מעל גבעות */}
      {pipOpen && (
        <div
          ref={pipBoxRef}
          className="absolute z-[80] pointer-events-auto rounded-lg overflow-hidden shadow-2xl border border-white/30 bg-black flex flex-col"
          style={{
            left: `${pipPosRef.current.x}px`,
            top: `${pipPosRef.current.y}px`,
            width: `${pipSizeRef.current.w}px`,
            height: `${pipSizeRef.current.h}px`,
          }}
        >
          {/* אזור התמונה: גרירה על כל השטח, קנבס תלת-מימד עצמאי, ✕ צף בפינה */}
          <div
            onMouseDown={startPipDrag}
            className="flex-1 relative bg-black cursor-move"
          >
            <Canvas key={pipCanvasKey} className="w-full h-full">
              <Suspense fallback={null}>
                <World visualsOnly={true} practice={practice} showHillOverlay={layers.hillOverlay} />
                <RobotVisuals mode={ViewMode.OVERHEAD} sync={true} />
              </Suspense>
            </Canvas>

            {/* כפתור סגירה צף בפינה עליונה-ימנית */}
            <button
              onClick={() => setPipOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-1 right-1 z-[82] w-5 h-5 flex items-center justify-center rounded bg-black/50 hover:bg-black/80 text-white/80 hover:text-white text-xs leading-none pointer-events-auto transition-colors"
              title="סגור"
            >
              ✕
            </button>
          </div>

          {/* ידיות שינוי-הגודל בכל הגבולות והפינות */}
          {pipHandles.map(h => (
            <div
              key={h.dir}
              onMouseDown={startPipResize(h.dir)}
              className={`absolute z-[81] ${h.cls}`}
            />
          ))}
        </div>
      )}

      <ExperimentUI />
    </div>
  );
}