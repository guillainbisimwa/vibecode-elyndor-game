import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import GameplayCanvas from '../Game/GameplayCanvas';

interface GlobeProps {
  value: number;
  max: number;
  label: string;
  ring: string;
  from: string;
  to: string;
}

/** A curved ARPG-style orb showing a vital stat as a radial fill ring + liquid orb. */
const Globe: React.FC<GlobeProps> = ({ value, max, label, ring, from, to }) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[84px] h-[84px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={R} fill="none" stroke="#141724" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={ring}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 32% 28%, ${from}, ${to})`,
              boxShadow: `0 0 12px ${ring}66, inset 0 -6px 10px rgba(0,0,0,0.5)`,
            }}
          >
            <span className="text-[11px] font-bold font-mono text-white drop-shadow">{value}</span>
          </div>
        </div>
      </div>
      <span className="text-[9px] font-mono tracking-widest text-[#8a8da3] uppercase">{label}</span>
    </div>
  );
};

const SKILLS = [
  { icon: '🗡️', key: '1', color: '#e2b653' },
  { icon: '🔨', key: '2', color: '#e2b653' },
  { icon: '🔮', key: '3', color: '#2b6ede' },
  { icon: '🏃', key: '4', color: '#27ae60' },
];

const GameplayUI: React.FC = () => {
  const {
    character,
    activeNpc,
    dialogueHistory,
    chatWithNpc,
    enemyHp,
    enemyMaxHp,
    enemyName,
    combatLogs,
    submitCombatTurn,
    usePotion,
    inventory,
    setScreen
  } = useGameStore();

  const [message, setMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const combatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat and combat streams
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogueHistory]);

  useEffect(() => {
    combatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLogs]);

  if (!character) return <div className="text-center text-elyndor-gold">Reconstituting gameplay frame...</div>;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loadingChat) return;
    setLoadingChat(true);
    await chatWithNpc(message);
    setMessage('');
    setLoadingChat(false);
  };

  const isCombatActive = enemyHp > 0;
  const potionsCount = inventory.find(i => i.slot === 'potion')?.quantity || 0;

  return (
    <div className="w-full h-[95vh] flex flex-col md:flex-row gap-4 relative">
      {/* Left Panel: Hero Vitality Frame */}
      <div className="w-full md:w-[260px] bg-[#0c0d13]/90 border border-elyndor-border/15 p-4 rounded-lg flex flex-col gap-5 relative z-10 justify-between">
        <div className="flex flex-col gap-4">
          <div className="border-b border-elyndor-border/10 pb-2 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-elyndor-gold/60 shrink-0"
              style={{ background: 'radial-gradient(circle at 30% 25%, #2b2d41, #0c0d13)' }}
            >
              <span className="text-lg">
                {character.character_class === 'Mage' ? '🧙' : character.character_class === 'Ranger' ? '🏹' : '⚔️'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-[#5b5e70] tracking-widest font-bold uppercase font-mono">PLAYER INTERFACE</span>
              <h2 className="font-cinzel text-base font-bold text-white uppercase leading-tight">{character.name}</h2>
              <p className="text-[10px] text-elyndor-gold font-bold font-mono">LVL {character.level} {character.character_class}</p>
            </div>
          </div>

          {/* Vital globes */}
          <div className="flex justify-around items-center py-1">
            <Globe value={character.health} max={character.max_health} label="Health" ring="#e0574a" from="#ff7a6a" to="#8c1d1d" />
            <Globe value={character.mana} max={character.max_mana} label="Mana" ring="#3f8bff" from="#6fb0ff" to="#1c3a7a" />
          </div>

          {/* XP progress toward next level */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between items-center text-[9px] font-bold font-mono tracking-wider">
              <span className="text-elyndor-gold">EXPERIENCE</span>
              <span className="text-[#a3a5be]">{character.experience} / {character.level * 1000}</span>
            </div>
            <div className="w-full bg-[#141724] h-2.5 rounded border border-[#2b2d41] overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-elyndor-gold rounded transition-all duration-300"
                style={{ width: `${Math.min(100, (character.experience / (character.level * 1000)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Quick loot display */}
          <div className="flex justify-between border-t border-elyndor-ash/40 pt-2 text-[10px] font-mono text-[#a3a5be]">
            <span>🪙 {character.gold} GOLD</span>
            <span>✨ {character.experience} XP</span>
          </div>
        </div>

        <button
          onClick={() => setScreen('WORLD_MAP')}
          className="w-full p-2.5 rounded border border-elyndor-blood/40 bg-elyndor-blood/10 text-red-400 text-xs uppercase tracking-widest font-cinzel hover:bg-elyndor-blood/25 cursor-pointer font-bold transition-all"
        >
          Retreat to Town
        </button>
      </div>

      {/* Center Panel: Interactive 3D Game */}
      <div className="flex-1 h-full relative">
        <GameplayCanvas />

        {/* ARPG skill/action bar (visual HUD) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-[#0c0d15]/80 border border-elyndor-border/30 rounded-xl px-3 py-2 backdrop-blur-sm shadow-2xl">
            {SKILLS.map((s) => (
              <div
                key={s.key}
                className="relative w-11 h-11 rounded-lg flex items-center justify-center bg-[#141724]/80 border"
                style={{ borderColor: `${s.color}55` }}
              >
                <span className="text-lg">{s.icon}</span>
                <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-bold text-[#8a8da3] bg-[#06070a] rounded px-1 border border-elyndor-border/20">
                  {s.key}
                </span>
              </div>
            ))}
            <div className="w-px h-8 bg-elyndor-border/20 mx-1" />
            <div className="relative w-11 h-11 rounded-lg flex items-center justify-center bg-[#1c0c0c]/80 border border-red-900/60">
              <span className="text-lg">🧪</span>
              <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-bold text-red-300 bg-[#06070a] rounded px-1 border border-red-900/40">
                x{potionsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Dynamic AI Multi-Agent Interaction Overlays */}
      <div className="w-full md:w-[350px] bg-[#0c0d13]/90 border border-elyndor-border/15 rounded-lg flex flex-col overflow-hidden justify-between relative z-10">
        
        {/* Scenario A: NPC Chat window active */}
        {activeNpc && !isCombatActive && (
          <div className="flex-1 flex flex-col h-full justify-between p-4 gap-4">
            <div>
              <div className="border-b border-elyndor-border/10 pb-2">
                <span className="text-[9px] text-[#5b5e70] tracking-widest font-bold uppercase font-mono">NPC CHAT PORTAL</span>
                <h3 className="font-cinzel text-sm font-bold text-elyndor-gold uppercase">{activeNpc.name}</h3>
                <span className="text-[10px] text-zinc-500 capitalize tracking-wider italic">"{activeNpc.personality} Personality"</span>
              </div>
              <p className="text-[11px] text-[#a3a5be] leading-normal bg-[#07080d]/40 p-2 border border-elyndor-ash/40 rounded mt-2">
                {activeNpc.description}
              </p>
            </div>

            {/* Bubble history list */}
            <div className="flex-1 overflow-y-auto max-h-[300px] flex flex-col gap-3 pr-1 text-xs">
              {dialogueHistory.map((d, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border leading-relaxed ${
                    d.role === 'player'
                      ? 'bg-elyndor-ash/30 border-elyndor-border/10 self-end text-[#e3e4e6] max-w-[85%]'
                      : 'bg-elyndor-gold/5 border-elyndor-gold/20 self-start text-[#e2b653] max-w-[85%]'
                  }`}
                >
                  <p className="text-[10px] uppercase font-bold tracking-widest font-mono mb-1 text-zinc-500">
                    {d.role === 'player' ? 'YOU' : activeNpc.name}
                  </p>
                  <p>{d.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-elyndor-ash/40 pt-3">
              <input
                type="text"
                className="flex-1 p-2 text-xs rounded input-dark"
                placeholder="Ask about quests, help, or lore..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={loadingChat}
              />
              <button
                type="submit"
                disabled={loadingChat || !message.trim()}
                className="p-2 px-4 rounded btn-gold text-xs font-cinzel"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Scenario B: COMBAT ARENA Active */}
        {isCombatActive && (
          <div className="flex-1 flex flex-col h-full justify-between p-4 gap-4 bg-gradient-to-b from-[#1c0c0c]/30 to-[#0c0d13]">
            <div>
              <div className="border-b border-elyndor-blood/20 pb-2">
                <span className="text-[9px] text-[#5b5e70] tracking-widest font-bold uppercase font-mono">COMBAT ARENA ACTIVE</span>
                <h3 className="font-cinzel text-sm font-bold text-red-400 uppercase">⚠️ {enemyName}</h3>
                <span className="text-[10px] text-yellow-500 font-bold font-mono">LEVEL {character.level} MONSTER THREAT</span>
              </div>

              {/* Enemy Health Indicator */}
              <div className="flex flex-col gap-1 text-xs mt-3">
                <div className="flex justify-between items-center text-[10px] font-bold font-mono text-red-400 uppercase">
                  <span>Enemy Health</span>
                  <span>{enemyHp} / {enemyMaxHp}</span>
                </div>
                <div className="w-full bg-[#141724] h-3 rounded border border-red-950 overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-red-800 to-red-600 rounded transition-all duration-300"
                    style={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Scrollable battle logs */}
            <div className="flex-1 overflow-y-auto max-h-[160px] bg-black/60 border border-red-950/20 p-3 rounded flex flex-col gap-2 font-mono text-[10px] leading-relaxed text-[#c3c5d6]">
              {combatLogs.map((log, index) => (
                <div key={index} className="flex gap-1.5 items-start">
                  <span className="text-red-500">🗡️</span>
                  <p>{log}</p>
                </div>
              ))}
              <div ref={combatEndRef} />
            </div>

            {/* Battle Skill Actions grid */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-elyndor-blood/20 pt-3">
              <button
                onClick={() => submitCombatTurn('light')}
                className="p-2.5 rounded border border-elyndor-border/20 bg-elyndor-ash/40 text-[#e3e4e6] hover:border-elyndor-gold font-cinzel font-bold text-center uppercase text-[10px] tracking-wider transition-all hover:bg-elyndor-ash/80"
              >
                🗡️ Swift Strike
              </button>
              <button
                onClick={() => submitCombatTurn('heavy')}
                className="p-2.5 rounded border border-elyndor-border/20 bg-elyndor-ash/40 text-[#e3e4e6] hover:border-elyndor-gold font-cinzel font-bold text-center uppercase text-[10px] tracking-wider transition-all hover:bg-elyndor-ash/80"
              >
                🔨 Heavy Bash
              </button>
              <button
                onClick={() => submitCombatTurn('skill')}
                className="p-2.5 rounded border border-elyndor-border/20 bg-[#121c2d] text-blue-400 hover:border-blue-400 font-cinzel font-bold text-center uppercase text-[10px] tracking-wider transition-all hover:bg-[#1a2c41]"
              >
                🔮 Aether Blast
              </button>
              <button
                onClick={() => submitCombatTurn('dodge')}
                className="p-2.5 rounded border border-elyndor-border/20 bg-[#122319] text-emerald-400 hover:border-emerald-400 font-cinzel font-bold text-center uppercase text-[10px] tracking-wider transition-all hover:bg-[#183623]"
              >
                🏃 Shadow Step
              </button>

              <button
                disabled={potionsCount === 0}
                onClick={usePotion}
                className={`col-span-2 p-2.5 rounded border text-center uppercase font-cinzel font-bold text-[10px] tracking-wider flex justify-center gap-2 items-center transition-all ${
                  potionsCount > 0
                    ? 'border-red-900 bg-red-950/20 text-red-400 hover:bg-red-950/40 cursor-pointer'
                    : 'border-zinc-800 bg-zinc-900/10 text-zinc-500 cursor-not-allowed'
                }`}
              >
                🧪 CHUG HEALTH POTION (Qty: {potionsCount})
              </button>
            </div>
          </div>
        )}

        {/* Scenario C: Default region travel/exploration guides */}
        {!activeNpc && !isCombatActive && (
          <div className="flex-1 flex flex-col justify-between p-4">
            <div className="flex flex-col gap-4">
              <div className="border-b border-elyndor-border/10 pb-2">
                <span className="text-[9px] text-[#5b5e70] tracking-widest font-bold uppercase font-mono">EXPLORATION PORTAL</span>
                <h3 className="font-cinzel text-sm font-bold text-elyndor-gold uppercase">{character.current_region} Sanctuary</h3>
                <span className="text-[10px] text-zinc-500 italic">"Explore & Locate Threat Encounters"</span>
              </div>

              <div className="bg-[#07080d]/40 border border-elyndor-border/5 p-4 rounded flex flex-col gap-3 text-xs leading-relaxed text-[#a3a5be]">
                <p>
                  You have stepped inside the hostile grids of <strong className="text-white">{character.current_region}</strong>.
                </p>
                <div className="flex gap-2 items-start text-[11px]">
                  <span className="text-yellow-500 font-mono">1.</span>
                  <p>Use your keyboard <strong className="text-white">WASD or Arrow Keys</strong> to steer your hero icon across the coordinate paths.</p>
                </div>
                <div className="flex gap-2 items-start text-[11px]">
                  <span className="text-yellow-500 font-mono">2.</span>
                  <p>Step on the glowing <strong className="text-[#2b569a]">🧙 portal (T)</strong> to request dynamic quest assignments from NPCs.</p>
                </div>
                <div className="flex gap-2 items-start text-[11px]">
                  <span className="text-yellow-500 font-mono">3.</span>
                  <p>Slay the <strong className="text-red-500">👿 skull threats (M)</strong> blocking your forward pathways.</p>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 leading-normal border-t border-elyndor-ash/40 pt-4 italic uppercase tracking-wider font-mono text-center">
              👑 Legends of Elyndor - ADK v2.0
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default GameplayUI;
