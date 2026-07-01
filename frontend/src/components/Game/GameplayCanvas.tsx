import React, { useEffect, useRef, useState } from 'react';
import { ThreeGameEngine, InteractionPrompt } from '../../game/GameEngine3D';

const LEGEND = [
  { icon: '💬', label: 'Talk', color: '#2b6ede' },
  { icon: '⚔️', label: 'Fight', color: '#c0392b' },
  { icon: '🪙', label: 'Loot', color: '#e2b653' },
  { icon: '🚪', label: 'Exit', color: '#a569d6' },
];

const GameplayCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreeGameEngine | null>(null);

  const [prompt, setPrompt] = useState<InteractionPrompt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new ThreeGameEngine(containerRef.current, {
        onPrompt: (p) => setPrompt(p),
        onNotice: (msg) => {
          setNotice(msg);
          window.clearTimeout(noticeTimer.current);
          noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
        },
      });
    }

    return () => {
      window.clearTimeout(noticeTimer.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-lg border border-elyndor-border/20 overflow-hidden">
      <div ref={containerRef} className="w-full h-full bg-[#06070a]" />

      {/* Controls + legend (top-left) */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none select-none">
        <div className="bg-[#0c0d15]/85 border border-elyndor-border/30 rounded-md px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] font-mono tracking-widest text-[#5b5e70] uppercase mb-1">Move</p>
          <div className="flex items-center gap-2 text-elyndor-gold">
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#1a1c28] border border-elyndor-border/40 rounded">WASD</span>
            <span className="text-[10px] text-zinc-500">or</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#1a1c28] border border-elyndor-border/40 rounded">↑ ↓ ← →</span>
          </div>
        </div>
        <div className="bg-[#0c0d15]/85 border border-elyndor-border/30 rounded-md px-3 py-2 backdrop-blur-sm flex flex-col gap-1.5">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-[10px]">
              <span>{l.icon}</span>
              <span className="font-mono uppercase tracking-wider" style={{ color: l.color }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contextual interaction prompt (bottom-center) */}
      {prompt && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none animate-fade-in">
          <div className="flex items-center gap-3 bg-[#0c0d15]/90 border rounded-lg px-5 py-3 backdrop-blur-sm shadow-2xl"
               style={{ borderColor: 'rgba(226, 182, 83, 0.5)' }}>
            <span className="text-2xl drop-shadow">{prompt.icon}</span>
            <div className="flex flex-col">
              <span className="font-cinzel text-sm font-bold text-elyndor-gold uppercase tracking-wide">{prompt.title}</span>
              <span className="text-[11px] text-[#a3a5be]">{prompt.hint}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transient toast notice (top-center) */}
      {notice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none animate-fade-in">
          <div className="bg-black/80 border border-elyndor-gold/50 rounded-md px-4 py-2 backdrop-blur-sm">
            <span className="font-cinzel text-xs text-elyndor-gold tracking-wide">{notice}</span>
          </div>
        </div>
      )}

      {/* Subtle vignette for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 140px 40px rgba(0,0,0,0.65)' }} />
    </div>
  );
};

export default GameplayCanvas;
