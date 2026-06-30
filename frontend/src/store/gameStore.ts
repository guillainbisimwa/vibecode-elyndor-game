import { create } from 'zustand';

// API Base URL - defaults to local FastAPI
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type GameScreen = 
  | 'LOGIN' 
  | 'DASHBOARD' 
  | 'CHARACTER_CREATION' 
  | 'WORLD_MAP' 
  | 'GAMEPLAY' 
  | 'SUCCESS' 
  | 'FAILURE';

export interface User {
  username: string;
  token: string;
}

export interface Character {
  id: number;
  name: string;
  character_class: 'Warrior' | 'Mage' | 'Ranger';
  level: number;
  experience: number;
  gold: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  health: number;
  max_health: number;
  mana: number;
  max_mana: number;
  current_region: string;
}

export interface Item {
  id: number;
  name: string;
  slot: 'weapon' | 'armor' | 'potion' | 'quest';
  value: number;
  stat_modifier: string;
  quantity: number;
  is_equipped: boolean;
}

export interface Quest {
  id: number;
  title: string;
  description: string;
  quest_type: 'Kill' | 'Gather' | 'Explore' | 'Escort' | 'Story';
  target_name: string;
  target_amount: number;
  current_amount: number;
  gold_reward: number;
  xp_reward: number;
  item_reward_name?: string;
  item_reward_slot?: string;
  status: 'active' | 'completed' | 'claimed';
}

export interface Region {
  id: number;
  name: string;
  description: string;
  terrain_ascii: string;
  is_unlocked: boolean;
  lore: string;
  difficulty_level: number;
}

export interface NPC {
  id: number;
  name: string;
  personality: string;
  description: string;
  greeting: string;
  current_region: string;
  is_alive: boolean;
  portrait_prompt?: string;
}

export interface DialogueMessage {
  role: 'player' | 'npc';
  text: string;
}

interface GameState {
  // Auth state
  token: string | null;
  username: string | null;
  isMockMode: boolean;
  
  // Game states
  currentScreen: GameScreen;
  character: Character | null;
  inventory: Item[];
  activeQuests: Quest[];
  regions: Region[];
  npcs: NPC[];
  activeNpc: NPC | null;
  dialogueHistory: DialogueMessage[];
  dashboardLogs: string[];
  
  // Combat stats (Real-time gameplay mirrors)
  enemyHp: number;
  enemyMaxHp: number;
  enemyName: string;
  combatLogs: string[];
  combatRewards: { gold: number, xp: number } | null;
  
  // API Actions
  setScreen: (screen: GameScreen) => void;
  login: (username: string, password: str) => Promise<boolean>;
  register: (username: string, password: str) => Promise<boolean>;
  logout: () => void;
  fetchRegions: () => Promise<void>;
  createCharacter: (name: string, character_class: 'Warrior' | 'Mage' | 'Ranger', region: string) => Promise<boolean>;
  fetchActiveCharacter: () => Promise<void>;
  fetchDashboardSummary: () => Promise<any>;
  setActiveNpc: (npc: NPC | null) => void;
  chatWithNpc: (message: string) => Promise<void>;
  claimQuestReward: (questId: number) => Promise<void>;
  submitCombatTurn: (attackType: 'light' | 'heavy' | 'skill' | 'dodge') => Promise<void>;
  triggerCombat: (enemyName: string, maxHp: number) => void;
  usePotion: () => void;
  hardResetGame: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  token: null,
  username: null,
  isMockMode: false,
  
  currentScreen: 'LOGIN',
  character: null,
  inventory: [],
  activeQuests: [],
  regions: [],
  npcs: [],
  activeNpc: null,
  dialogueHistory: [],
  dashboardLogs: ["Launch into the lands of Elyndor!"],
  
  enemyHp: 100,
  enemyMaxHp: 100,
  enemyName: "Fallen Ghoul",
  combatLogs: [],
  combatRewards: null,

  setScreen: (screen) => set({ currentScreen: screen }),
  
  login: async (username, password) => {
    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);
      
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form
      });
      
      if (!res.ok) throw new Error("Auth failed");
      const data = await res.json();
      
      set({ 
        token: data.access_token, 
        username: data.username, 
        isMockMode: false 
      });
      return true;
    } catch (e) {
      console.warn("API Server down. Falling back to local offline sandbox player.");
      // Seeding offline sandboxed user
      set({ 
        token: "offline_mock_jwt_token", 
        username: username, 
        isMockMode: true 
      });
      return true;
    }
  },

  register: async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      return res.ok;
    } catch (e) {
      return true; // Auto-bypass for easy offline sandboxing
    }
  },

  logout: () => set({ 
    token: null, 
    username: null, 
    character: null, 
    inventory: [], 
    activeQuests: [], 
    currentScreen: 'LOGIN' 
  }),

  fetchRegions: async () => {
    const { token, isMockMode } = get();
    if (isMockMode || !token) {
      // Mock data seed
      const mockRegions: Region[] = [
        {
          id: 1,
          name: "Eldergate",
          description: "An ancient woodland kingdom with glowing elven ruins and peaceful mossy trails.",
          terrain_ascii: "##########\n#S...T...#\n#..####..#\n#..#..#..#\n#..M..E..#\n##########",
          is_unlocked: true,
          lore: "Shattered marble gates and lush vegetation guard the old elven library.",
          difficulty_level: 1
        },
        {
          id: 2,
          name: "Shadow Vale",
          description: "A dark hollow under perpetual eclipse, shrouded in dense violet mist.",
          terrain_ascii: "##########\n#S.M...#.#\n##.###.#.#\n#....#.#.#\n#..G.M.E.#\n##########",
          is_unlocked: true,
          lore: "Corrupted specters hover around ancient tombs.",
          difficulty_level: 2
        },
        {
          id: 3,
          name: "Crystal Peaks",
          description: "Sapphire blizzards howling through jagged diamond ridges.",
          terrain_ascii: "##########\n#S.######\n#..#...G.#\n#.M#.###.#\n#..#..M.E#\n##########",
          is_unlocked: false,
          lore: "Forge elemental frost gems to challenge ice golems.",
          difficulty_level: 3
        },
        {
          id: 4,
          name: "Ember Desert",
          description: "Lava pools breaching scorched sand, guarding dynamic magma metalworks.",
          terrain_ascii: "##########\n#S...M...#\n####.#.#.#\n#..#.G.#.#\n#..M.M.E.#\n##########",
          is_unlocked: false,
          lore: "Created from the burning collapse of an ancient fire drake.",
          difficulty_level: 4
        }
      ];
      const mockNpcs: NPC[] = [
        { id: 1, name: "Aria the Rebel", personality: "rebellious", description: "Clad in silver leather scout cloak, glowing green daggers.", greeting: "Greetings traveler. Looking to shake some chains in Eldergate?", current_region: "Eldergate", is_alive: true, portrait_prompt: "Golden hair, high elven ranger." },
        { id: 2, name: "Eldrin the Sage", personality: "weary", description: "Holding a twisted wooden staff that glows with violet void energy.", greeting: "Speak quietly... the ghosts of Shadow Vale do not sleep.", current_region: "Shadow Vale", is_alive: true, portrait_prompt: "Old human wizard with white beard." },
        { id: 3, name: "Maron the Trader", personality: "cynical", description: "Bundle of furs, spectacles magnifying one mechanical eye.", greeting: "Got gold? Good. No gold? Beat it. Crystal Peak isn't a charity.", current_region: "Crystal Peaks", is_alive: true },
        { id: 4, name: "Sariel the Weaver", personality: "noble", description: "Clad in crimson plates forged from dragon scales.", greeting: "The flame burns bright inside those who stand straight. Speak your truth.", current_region: "Ember Desert", is_alive: true }
      ];
      set({ regions: mockRegions, npcs: mockNpcs });
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/regions`);
      if (res.ok) {
        const data = await res.json();
        set({ regions: data });
      }
    } catch (e) {
      console.error(e);
    }
  },

  createCharacter: async (name, character_class, region) => {
    const { token, isMockMode } = get();
    if (isMockMode) {
      const mockChar: Character = {
        id: 99,
        name: name,
        character_class: character_class,
        level: 1,
        experience: 0,
        gold: 150,
        strength: character_class === 'Warrior' ? 15 : 8,
        dexterity: character_class === 'Ranger' ? 16 : 10,
        intelligence: character_class === 'Mage' ? 16 : 9,
        vitality: character_class === 'Warrior' ? 14 : 9,
        health: character_class === 'Warrior' ? 150 : 100,
        max_health: character_class === 'Warrior' ? 150 : 100,
        mana: character_class === 'Mage' ? 100 : 50,
        max_mana: character_class === 'Mage' ? 100 : 50,
        current_region: region
      };
      
      const mockItems: Item[] = [
        { id: 1, name: `${character_class} Recruit's Stave`, slot: 'weapon', value: 10, stat_modifier: '{"strength":2}', quantity: 1, is_equipped: true },
        { id: 2, name: `Scout Cloak`, slot: 'armor', value: 15, stat_modifier: '{"vitality":3}', quantity: 1, is_equipped: true },
        { id: 3, name: "Health Potion", slot: "potion", value: 5, stat_modifier: "{}", quantity: 3, is_equipped: false }
      ];
      
      set({ 
        character: mockChar, 
        inventory: mockItems,
        currentScreen: 'DASHBOARD' 
      });
      return true;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/character/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, character_class, starting_region: region })
      });
      
      if (res.ok) {
        await get().fetchActiveCharacter();
        set({ currentScreen: 'DASHBOARD' });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  fetchActiveCharacter: async () => {
    const { token, isMockMode } = get();
    if (isMockMode || !token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/character/active`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({ 
          character: data.profile,
          inventory: data.inventory,
          activeQuests: data.active_quests
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  fetchDashboardSummary: async () => {
    const { token, isMockMode } = get();
    if (isMockMode || !token) {
      return {
        character: get().character,
        recent_activity: get().dashboardLogs,
        active_quest_count: get().activeQuests.length,
        completed_quest_count: 0,
        inventory_count: get().inventory.length,
        world_progress_percentage: 25
      };
    }
    
    try {
      const res = await fetch(`${API_URL}/api/character/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error(e);
    }
  },

  setActiveNpc: (npc) => {
    if (npc) {
      set({ 
        activeNpc: npc,
        dialogueHistory: [{ role: 'npc', text: npc.greeting }]
      });
    } else {
      set({ activeNpc: null, dialogueHistory: [] });
    }
  },

  chatWithNpc: async (message) => {
    const { token, activeNpc, dialogueHistory, isMockMode, character } = get();
    if (!activeNpc) return;
    
    const updatedHistory = [...dialogueHistory, { role: 'player' as const, text: message }];
    set({ dialogueHistory: updatedHistory });
    
    if (isMockMode || !token) {
      // Offline multi-agent dialogue responses
      setTimeout(() => {
        let reply = "";
        let newQuest: Quest | null = null;
        
        if (message.toLowerCase().includes("quest") || message.toLowerCase().includes("help")) {
          reply = `The dark forces are swelling in ${character?.current_region || "Eldergate"}. Slay some Fallen Ghouls for me and you will be richly rewarded with ancient silver!`;
          newQuest = {
            id: random.randint(100, 999),
            title: "Crush the Ghouls",
            description: `Aria needs you to defeat Fallen Ghouls in ${character?.current_region}.`,
            quest_type: 'Kill',
            target_name: 'Fallen Ghoul',
            target_amount: 3,
            current_amount: 0,
            gold_reward: 75,
            xp_reward: 200,
            status: 'active'
          };
        } else {
          reply = `Keep your blades sharpened. The shadow over Elyndor crawls closer. We need brave souls like you.`;
        }
        
        const finalHistory = [...updatedHistory, { role: 'npc' as const, text: reply }];
        set({ dialogueHistory: finalHistory });
        
        if (newQuest) {
          set({ activeQuests: [...get().activeQuests, newQuest] });
        }
      }, 700);
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/npc/chat/${activeNpc.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
      
      if (res.ok) {
        const data = await res.json();
        set({ 
          dialogueHistory: data.history,
        });
        if (data.new_quest) {
          set({ activeQuests: [...get().activeQuests, data.new_quest] });
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  claimQuestReward: async (questId) => {
    const { token, isMockMode, character, inventory } = get();
    
    if (isMockMode || !token) {
      // Process offline claim
      const quest = get().activeQuests.find(q => q.id === questId);
      if (quest && character) {
        const newGold = character.gold + quest.gold_reward;
        const newXp = character.experience + quest.xp_reward;
        let newLevel = character.level;
        let finalXp = newXp;
        
        if (finalXp >= newLevel * 1000) {
          finalXp -= newLevel * 1000;
          newLevel += 1;
        }
        
        const updatedChar = {
          ...character,
          gold: newGold,
          experience: finalXp,
          level: newLevel
        };
        
        set({
          character: updatedChar,
          activeQuests: get().activeQuests.filter(q => q.id !== questId)
        });
      }
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/quests/claim/${questId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        await get().fetchActiveCharacter();
      }
    } catch (e) {
      console.error(e);
    }
  },

  triggerCombat: (enemyName, maxHp) => {
    set({
      enemyHp: maxHp,
      enemyMaxHp: maxHp,
      enemyName: enemyName,
      combatLogs: [`A feral ${enemyName} leaps from the fog! Engage!`],
      combatRewards: null
    });
  },

  submitCombatTurn: async (attackType) => {
    const { token, isMockMode, character, enemyHp, enemyMaxHp, enemyName } = get();
    if (!character) return;
    
    if (isMockMode || !token) {
      // Offline mock turn calculations
      let pDmg = attackType === 'heavy' ? random.randint(20, 35) : attackType === 'skill' ? 45 : random.randint(12, 18);
      let eDmg = attackType === 'dodge' ? 0 : random.randint(8, 15);
      
      const newEnemyHp = Math.max(0, enemyHp - pDmg);
      const newPlayerHp = Math.max(0, character.health - eDmg);
      
      let victory = newEnemyHp <= 0;
      let defeat = newPlayerHp <= 0 && !victory;
      
      let logs = [...get().combatLogs];
      logs.push(`Striking with ${attackType.toUpperCase()}! Dealt ${pDmg} damage.`);
      if (eDmg > 0) logs.push(`The ${enemyName} claws you for ${eDmg} physical damage.`);
      else logs.push(`You successfully dodged the monster's swipe!`);
      
      let rewards = null;
      if (victory) {
        rewards = { gold: 30, xp: 80 };
        logs.push(`VICTORY! Defeated the ${enemyName}! Obtained 30 Gold and 80 XP.`);
        
        // Update kill progress
        const updatedQuests = get().activeQuests.map(q => {
          if (q.quest_type === 'Kill' && q.target_name === enemyName) {
            const nextAmount = q.current_amount + 1;
            return {
              ...q,
              current_amount: nextAmount,
              status: nextAmount >= q.target_amount ? 'completed' as const : 'active' as const
            };
          }
          return q;
        });
        
        set({ activeQuests: updatedQuests });
      }
      
      set({
        enemyHp: newEnemyHp,
        combatLogs: logs,
        character: { ...character, health: newPlayerHp },
        combatRewards: rewards
      });
      
      if (victory) set({ currentScreen: 'SUCCESS' });
      else if (defeat) set({ currentScreen: 'FAILURE' });
      
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/combat/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          enemy_name: enemyName,
          attack_type: attackType,
          enemy_hp: enemyHp,
          player_hp: character.health
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        
        let logs = [...get().combatLogs, data.combat_log];
        
        set({
          enemyHp: data.enemy_hp_remaining,
          combatLogs: logs,
          character: { ...character, health: data.player_hp_remaining },
          combatRewards: data.rewards
        });
        
        if (data.victory) {
          await get().fetchActiveCharacter(); // Refresh gold, quest progress, XP
          set({ currentScreen: 'SUCCESS' });
        } else if (data.defeat) {
          set({ currentScreen: 'FAILURE' });
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  usePotion: () => {
    const { character, inventory } = get();
    if (!character) return;
    
    const pot = inventory.find(i => i.slot === 'potion' && i.quantity > 0);
    if (pot) {
      const updatedHealth = Math.min(character.max_health, character.health + 50);
      const updatedInventory = inventory.map(i => {
        if (i.id === pot.id) {
          return { ...i, quantity: i.quantity - 1 };
        }
        return i;
      }).filter(i => i.quantity > 0);
      
      set({
        character: { ...character, health: updatedHealth },
        inventory: updatedInventory,
        combatLogs: [...get().combatLogs, "Chugged a Red Health Potion! Restored +50 HP."]
      });
    }
  },

  hardResetGame: async () => {
    const { token, isMockMode } = get();
    if (isMockMode || !token) {
      set({ character: null, activeQuests: [], inventory: [], currentScreen: 'CHARACTER_CREATION' });
      return;
    }
    
    try {
      await fetch(`${API_URL}/api/game/reset`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      set({ character: null, activeQuests: [], inventory: [], currentScreen: 'CHARACTER_CREATION' });
    } catch (e) {
      console.error(e);
    }
  }
}));

// Simple utility helper for local offline randomizing
const random = {
  randint: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
};
