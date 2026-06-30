import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

const Dashboard: React.FC = () => {
  const { 
    character, 
    inventory, 
    activeQuests, 
    fetchDashboardSummary, 
    setScreen, 
    claimQuestReward,
    hardResetGame
  } = useGameStore();

  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetchDashboardSummary().then(res => {
      if (res) setSummary(res);
    });
  }, [character, activeQuests, inventory, fetchDashboardSummary]);

  if (!character) return <div className="text-center text-elyndor-gold">Summoning Hero State...</div>;

  const equippedWeapon = inventory.find(i => i.slot === 'weapon' && i.is_equipped);
  const equippedArmor = inventory.find(i => i.slot === 'armor' && i.is_equipped);
  const potionsCount = inventory.find(i => i.slot === 'potion')?.quantity || 0;

  return (
    <div className="glass-panel max-w-5xl w-full p-6 rounded-lg flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-elyndor-border/20 pb-4">
        <div>
          <span className="text-[10px] text-[#5b5e70] uppercase tracking-widest font-bold">ELYNDOR HERO PLATFORM</span>
          <h1 className="font-cinzel text-2xl font-bold text-elyndor-gold uppercase">
            {character.name} the {character.character_class}
          </h1>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setScreen('WORLD_MAP')}
            className="p-3 px-6 rounded btn-gold"
          >
            ENTER GAME WORLD
          </button>
          <button
            onClick={hardResetGame}
            className="p-3 px-4 rounded border border-elyndor-blood/40 bg-elyndor-blood/10 text-red-400 text-xs uppercase tracking-widest font-semibold font-cinzel hover:bg-elyndor-blood/35 cursor-pointer"
          >
            Reset Hero
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Stats & Inventory */}
        <div className="flex flex-col gap-6">
          {/* Stats */}
          <div className="bg-[#07080d] border border-elyndor-border/15 p-4 rounded flex flex-col gap-3">
            <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest">
              Hero Attributes
            </h3>
            <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 text-xs">
              <span className="text-[#6f738a]">LEVEL</span>
              <span className="text-elyndor-gold font-bold">LVL {character.level}</span>
            </div>
            <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 text-xs">
              <span className="text-[#6f738a]">EXPERIENCE</span>
              <span className="text-elyndor-gold font-bold">{character.experience} / {character.level * 1000} XP</span>
            </div>
            <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 text-xs">
              <span className="text-[#6f738a]">GOLD BALANCE</span>
              <span className="text-yellow-400 font-bold">🪙 {character.gold} G</span>
            </div>
            <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 text-xs">
              <span className="text-[#6f738a]">CURRENT HP</span>
              <span className="text-red-400 font-bold">{character.health} / {character.max_health} HP</span>
            </div>
            <div className="flex justify-between border-b border-elyndor-ash/40 pb-1.5 text-xs">
              <span className="text-[#6f738a]">CURRENT MANA</span>
              <span className="text-blue-400 font-bold">{character.mana} / {character.max_mana} MP</span>
            </div>
          </div>

          {/* Equipped Inventory Summary */}
          <div className="bg-[#07080d] border border-elyndor-border/15 p-4 rounded flex flex-col gap-3">
            <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest">
              Loot Inventory
            </h3>
            <div className="flex items-center gap-3 bg-[#0a0c12] border border-elyndor-border/5 p-2 rounded">
              <span className="text-xl">🗡️</span>
              <div>
                <p className="text-[10px] text-[#5b5e70] uppercase font-bold">Weapon Slot</p>
                <p className="text-xs text-[#e3e4e6] font-semibold">{equippedWeapon ? equippedWeapon.name : "Unarmed"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[#0a0c12] border border-elyndor-border/5 p-2 rounded">
              <span className="text-xl">🛡️</span>
              <div>
                <p className="text-[10px] text-[#5b5e70] uppercase font-bold">Armor Slot</p>
                <p className="text-xs text-[#e3e4e6] font-semibold">{equippedArmor ? equippedArmor.name : "No Cloth/Armor"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-[#0a0c12] border border-elyndor-border/5 p-2 rounded">
              <div className="flex items-center gap-3">
                <span className="text-xl">🧪</span>
                <div>
                  <p className="text-[10px] text-[#5b5e70] uppercase font-bold">Consumables</p>
                  <p className="text-xs text-[#e3e4e6] font-semibold">Healing Elixirs</p>
                </div>
              </div>
              <span className="text-xs text-elyndor-gold font-bold bg-[#141724] border border-elyndor-border/10 p-1 px-2.5 rounded">
                x {potionsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Center Column: Active Quests */}
        <div className="bg-[#07080d] border border-elyndor-border/15 p-4 rounded flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-elyndor-border/10 pb-2">
            <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest">
              Quest Tracker
            </h3>
            <span className="text-[10px] text-elyndor-gold font-mono bg-elyndor-ash/40 border border-elyndor-border/10 p-0.5 px-2 rounded">
              {activeQuests.length} ACTIVE
            </span>
          </div>

          {activeQuests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2">
              <span className="text-3xl opacity-30">📜</span>
              <p className="text-xs text-[#6f738a]">No active quests in Elyndor. Explore maps and speak to regional NPCs to secure dynamic tasks!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto flex-1 max-h-[350px]">
              {activeQuests.map((q) => (
                <div key={q.id} className="border border-elyndor-border/10 p-3 bg-[#0c0d15] rounded flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-cinzel text-xs font-bold text-white uppercase">{q.title}</h4>
                    <span className="text-[9px] text-[#a3a5be] font-mono bg-[#141724] border border-[#2b2d41] p-0.5 px-1.5 rounded uppercase">
                      {q.quest_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a3a5be] leading-relaxed">{q.description}</p>
                  
                  {/* Progress Tracker bar */}
                  <div className="flex items-center justify-between gap-3 text-[10px] mt-1">
                    <span className="text-[#6f738a] uppercase font-bold tracking-wider">Progress:</span>
                    <span className="font-mono text-white font-bold">{q.current_amount} / {q.target_amount}</span>
                  </div>
                  <div className="w-full bg-[#141724] h-1.5 rounded-full overflow-hidden border border-[#2b2d41]">
                    <div 
                      className={`h-full ${q.status === 'completed' ? 'bg-emerald-500' : 'bg-elyndor-gold'}`} 
                      style={{ width: `${(q.current_amount / q.target_amount) * 100}%` }}
                    />
                  </div>

                  {/* Claim Reward Button */}
                  {q.status === 'completed' ? (
                    <button
                      onClick={() => claimQuestReward(q.id)}
                      className="w-full mt-2 p-2 rounded btn-gold text-xs uppercase font-cinzel font-bold text-center"
                    >
                      🎁 Claim Rewards (+{q.gold_reward}G, +{q.xp_reward}XP)
                    </button>
                  ) : (
                    <div className="flex gap-4 text-[9px] text-[#6f738a] border-t border-elyndor-ash/40 pt-2 font-mono mt-1">
                      <span>🪙 {q.gold_reward} GOLD</span>
                      <span>✨ {q.xp_reward} XP</span>
                      {q.item_reward_name && <span>📦 LOOT: {q.item_reward_name}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Recent Activity Logs & World Unlocks */}
        <div className="flex flex-col gap-6">
          {/* Recent Activity */}
          <div className="bg-[#07080d] border border-elyndor-border/15 p-4 rounded flex-1 flex flex-col gap-3 min-h-[180px]">
            <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest border-b border-elyndor-border/10 pb-2">
              Recent Chronicles
            </h3>
            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[160px] flex-1 text-[11px] leading-normal text-[#a3a5be]">
              {summary ? (
                summary.recent_activity.map((act: string, idx: number) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className="text-elyndor-gold font-mono">❯</span>
                    <p>{act}</p>
                  </div>
                ))
              ) : (
                <div className="text-[#6f738a] text-center mt-4">Consulting ancient scrolls...</div>
              )}
            </div>
          </div>

          {/* World Progress bar */}
          <div className="bg-[#07080d] border border-elyndor-border/15 p-4 rounded flex flex-col gap-3">
            <h3 className="font-cinzel text-xs font-bold text-elyndor-gold uppercase tracking-widest">
              World Completion
            </h3>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6f738a]">ELYNDOR EXPLORED</span>
              <span className="text-elyndor-gold font-bold font-mono">
                {summary ? summary.world_progress_percentage : 25} %
              </span>
            </div>
            <div className="w-full bg-[#141724] h-2.5 rounded-full overflow-hidden border border-[#2b2d41]">
              <div 
                className="h-full bg-gradient-to-r from-elyndor-blood to-elyndor-gold"
                style={{ width: `${summary ? summary.world_progress_percentage : 25}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5b5e70] italic leading-relaxed">
              Unlock other dark regions (Shadow Vale, Crystal Peaks) by defeating threats and leveling up your hero profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
