import os
import json
import random
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from collections import deque
import urllib.request
import urllib.error

# Import Google Agent Development Kit (ADK) primitives
from google.adk.agents import Agent as AdkAgent
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types

# Dual-mode AI system: check for Gemini API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def run_adk_agent_sync(agent_name: str, instruction: str, prompt: str, json_mode: bool = False) -> str:
    """Helper to query the Google Gemini model using official Google ADK Agents and Runners.
    Ensures that conversation states and trace logging follow ADK standards.
    Provides robust fallback if the API key is missing or any exception occurs.
    """
    if not GEMINI_API_KEY:
        return ""

    # Build GenerateContentConfig using Google GenAI types
    if json_mode:
        config = genai_types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=800,
            response_mime_type="application/json"
        )
    else:
        config = genai_types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=800
        )

    try:
        # Create a real Google ADK Agent
        adk_agent = AdkAgent(
            name=agent_name,
            model="gemini-1.5-flash",  # Official recommended model
            instruction=instruction,
            generate_content_config=config
        )

        # Initialize the ADK InMemoryRunner to manage the session/turn lifecycle
        runner = InMemoryRunner(agent=adk_agent, app_name="app")

        async def _execute():
            # Create a fresh ADK Session for this turn
            session = await runner.session_service.create_session_async(user_id="player")
            
            # Run the agent turn asynchronously
            events = []
            async for event in runner.run_async(user_id="player", session_id=session.id, text=prompt):
                events.append(event)
            
            # Extract content from the model response events
            response_text = ""
            for ev in events:
                if ev.author == agent_name and ev.content:
                    for part in ev.content.parts:
                        if part.text:
                            response_text += part.text
            return response_text.strip()

        # Handle event loops when running in synchronous threads or inside FastAPI
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, _execute())
                return future.result()
        else:
            return loop.run_until_complete(_execute())

    except Exception as e:
        print(f"ADK Agent '{agent_name}' error: {e}. Falling back to procedural engine.")
        return ""

# Keep call_gemini for any other references, routed directly through the ADK helper
def call_gemini(prompt: str, json_mode: bool = False) -> str:
    return run_adk_agent_sync(
        agent_name="GeminiFallbackAgent",
        instruction="You are a general assistant helping with procedural content generation.",
        prompt=prompt,
        json_mode=json_mode
    )

class NarrativeAgent:
    """Agent 1: Narrative Agent (ADK-powered)
    Responsibilities: Generates immersive elven & dark-fantasy lore, factions, NPC personalities, and dialogues.
    Uses Google ADK to invoke LLM-based narrative generation, maintaining absolute state.
    """
    def __init__(self):
        self.personalities = ["mysterious", "cynical", "warm", "rebellious", "weary", "noble", "eccentric"]
        self.factions = ["Wardens of Eldergate", "Shadow Vale Cultists", "Aether Weaver Circle", "Ember Drake Vanguard"]

    def generate_npc_profile(self, name: str, region: str) -> Dict[str, Any]:
        personality = random.choice(self.personalities)
        faction = random.choice(self.factions)

        instruction = (
            "You are a master RPG writer and narrative director. "
            "Your task is to generate high-fidelity, highly immersive NPC profiles "
            "for a dark-fantasy elven role-playing game. Always return a valid JSON object."
        )

        prompt = (
            f"Generate an exquisite fantasy NPC profile for '{name}' who lives in '{region}'. "
            f"Personality archetype: '{personality}'. Affiliated faction: '{faction}'. "
            "Your output must be JSON with exactly these fields: "
            "'personality' (short description), 'backstory' (atmospheric paragraph), "
            "'greeting' (immersive welcoming sentence in-character), 'description' (visual features)."
        )

        adk_res = run_adk_agent_sync(
            agent_name="NarrativeNPCGenerator",
            instruction=instruction,
            prompt=prompt,
            json_mode=True
        )

        if adk_res:
            try:
                return json.loads(adk_res)
            except Exception:
                pass

        # Robust procedural fallback in case of connection failure or missing API key
        backstories = [
            f"An outcast from the {faction} who discovered a terrifying truth in the deep crypts of {region}.",
            f"A seasoned tracker who has guarded the borders of {region} for decades, witness to rising dark magic.",
            f"An eccentric collector of ancient aether crystals, speaking in cryptical riddles about Elyndor's doom.",
            f"A quiet survivor of the Great Siege, hiding ancient forbidden spellscrolls from the inquisitors."
        ]
        greetings = [
            f"Halt, traveler. The winds of {region} whisper of your coming. Speak your business quickly.",
            f"Greetings. I didn't expect to find anyone sane still walking these corrupted lands.",
            f"Ah, another soul drawn to the shimmering ruins. Have you come to seek power or redemption?",
            f"Watch your step. The shadows have eyes here, and they do not welcome strangers."
        ]
        descriptions = [
            f"A tall elf clad in rugged leather armor bearing the sigil of {faction}. Their eyes glow with ancient aether.",
            f"A hooded figure shrouded in heavy charcoal-colored robes, holding a staff that hums with dynamic magical energy.",
            f"An armor-clad soldier leaning heavily against their broadsword, looking weary from relentless combat.",
            f"A mysterious trader surrounded by trinkets, wearing a mask crafted from an ember dragon's scale."
        ]

        return {
            "personality": personality,
            "backstory": random.choice(backstories),
            "greeting": random.choice(greetings),
            "description": random.choice(descriptions)
        }

    def generate_dialogue_response(self, npc_name: str, personality: str, history: List[Dict[str, str]], message: str) -> str:
        history_str = "\n".join([f"{h['role'].upper()}: {h['text']}" for h in history[-5:]])
        
        instruction = (
            f"You are the NPC '{npc_name}' with a '{personality}' personality in Elyndor, a dark elven fantasy RPG. "
            "Write highly atmospheric, concise, and lore-rich dialogue replies. Stay fully in character. "
            "Do NOT speak as an AI assistant. Limit replies to a maximum of 3 sentences."
        )

        prompt = (
            f"Conversation History:\n{history_str}\n"
            f"PLAYER says: '{message}'\n"
            "Generate your atmospheric in-character response:"
        )

        adk_res = run_adk_agent_sync(
            agent_name="NarrativeDialogueAgent",
            instruction=instruction,
            prompt=prompt,
            json_mode=False
        )

        if adk_res:
            return adk_res

        # Procedural dialogue engine
        replies = [
            f"That name brings back dark memories... The shadow in Elyndor is growing stronger, whether we speak of it or not.",
            "You ask of things best left buried beneath the ancient peaks. But I admire your courage.",
            "There are forces at play here far older than your kingdoms. Be careful who you trust, stranger.",
            f"Perhaps our goals align. But first, you must prove you have the strength to survive {npc_name}'s tasks.",
            "The ancient aether pathways are shifting. If you truly wish to help, listen closely."
        ]
        return random.choice(replies)



class WorldAgent:
    """Agent 2: World Agent
    Responsibilities: Generates regions, 2D terrain grids (tile ASCII maps), and validates solvability using BFS.
    """
    def generate_region_map(self, region_name: str, width: int = 12, height: int = 12) -> str:
        """Generates a 2D rectangular grid representing the region or local dungeon.
        Characters:
        '#' = Wall/Mountain
        '.' = Path/Grass
        'S' = Starting Point (Player spawns here)
        'E' = Exit/Dungeon Crypt Entrance
        'T' = Town/Safe Zone
        'M' = Monster Spawn Point
        'G' = Gold Chest / Loot
        """
        # We must generate maps that are 100% solvable (playable path exists between 'S' and 'E')
        max_attempts = 15
        for attempt in range(max_attempts):
            grid = [['.' for _ in range(width)] for _ in range(height)]

            # Place borders (Walls)
            for r in range(height):
                grid[r][0] = '#'
                grid[r][width - 1] = '#'
            for c in range(width):
                grid[0][c] = '#'
                grid[height - 1][c] = '#'

            # Place random obstacles (Rocks/Mountains)
            obstacle_rate = 0.25 if "Peaks" in region_name else 0.18
            for r in range(1, height - 1):
                for c in range(1, width - 1):
                    if random.random() < obstacle_rate:
                        grid[r][c] = '#'

            # Place S and E
            start_r, start_c = 1, 1
            end_r, end_c = height - 2, width - 2

            grid[start_r][start_c] = 'S'
            grid[end_r][end_c] = 'E'

            # Place Town (T), Monster (M), Gold Chest (G)
            grid[1][width - 2] = 'T'
            grid[height - 2][1] = 'G'

            # Place some random monsters in paths
            for _ in range(random.randint(2, 4)):
                mr = random.randint(2, height - 3)
                mc = random.randint(2, width - 3)
                if grid[mr][mc] == '.':
                    grid[mr][mc] = 'M'

            # Mathematically verify path exists from S to E
            playable, path = self.validate_level_path(grid, (start_r, start_c), (end_r, end_c))
            if playable:
                # Format to a string
                return "\n".join(["".join(row) for grid_row in [grid] for row in grid_row])

        # If we failed to randomly generate a valid path, use a guaranteed open layout
        grid = [['#' if r in (0, height-1) or c in (0, width-1) else '.' for c in range(width)] for r in range(height)]
        grid[1][1] = 'S'
        grid[height-2][width-2] = 'E'
        grid[1][width-2] = 'T'
        grid[height-2][1] = 'G'
        grid[3][3] = 'M'
        grid[height-4][width-4] = 'M'
        return "\n".join(["".join(row) for row in grid])

    def validate_level_path(self, grid: List[List[str]], start: Tuple[int, int], end: Tuple[int, int]) -> Tuple[bool, List[Tuple[int, int]]]:
        """BFS pathfinder to guarantee level solvability (S can reach E, and walls do not block play).
        """
        height = len(grid)
        width = len(grid[0])

        queue = deque([[start]])
        visited = {start}

        while queue:
            path = queue.popleft()
            r, c = path[-1]

            if (r, c) == end:
                return True, path

            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < height and 0 <= nc < width:
                    if grid[nr][nc] != '#' and (nr, nc) not in visited:
                        visited.add((nr, nc))
                        queue.append(path + [(nr, nc)])

        return False, []


class AssetAgent:
    """Agent 3: Asset Agent
    Responsibilities: Generates exquisite visual prompts, color styling palettes, and details
    on how the frontend should programmatically render pixel art character sprites, items, and environments.
    """
    def generate_asset_metadata(self, asset_type: str, name: str) -> Dict[str, Any]:
        """Provides dynamic color styling hex codes, shapes, and particle effects
        which the Phaser 3 frontend reads to dynamically draw gorgeous visuals.
        """
        if asset_type == "character":
            if "Warrior" in name or "warrior" in name:
                return {
                    "primary_color": "#8c1d1d", # Deep blood red
                    "secondary_color": "#d9b48f", # Steel gold
                    "accessory_color": "#2c2f33", # Charcoal iron
                    "glow_effect": "spark-particle",
                    "scale": 1.2,
                    "weapon_shape": "broadsword",
                    "sprite_frame_count": 4,
                    "prompt": f"A realistic 16-bit pixel-art character portrait of a dark fantasy Warrior named {name}, iron helmet, glowing crimson eyes, dramatic cinematic lighting, Diablo style."
                }
            elif "Mage" in name or "mage" in name:
                return {
                    "primary_color": "#2b569a", # Arcane sapphire
                    "secondary_color": "#ac6be6", # Void purple
                    "accessory_color": "#f1e5ff", # Mystic silver
                    "glow_effect": "arcane-glowing-ring",
                    "scale": 1.0,
                    "weapon_shape": "crystal-staff",
                    "sprite_frame_count": 6,
                    "prompt": f"A glorious dark fantasy portrait of an Arcane Mage named {name}, channeling purple void runes, wearing velvet hood, photorealistic details, high-contrast digital art."
                }
            else: # Ranger
                return {
                    "primary_color": "#1d5c2e", # Poison forest emerald
                    "secondary_color": "#cc913b", # Leather bronze
                    "accessory_color": "#d9e8d3", # Feather white
                    "glow_effect": "wind-gusts",
                    "scale": 1.1,
                    "weapon_shape": "recurve-bow",
                    "sprite_frame_count": 5,
                    "prompt": f"An exquisite fantasy Ranger portrait of {name}, wearing a green leaf-patterned cloak, wielding a glowing recurve bow, elven features, deep green background, detailed cinematic rendering."
                }

        elif asset_type == "item":
            # Weapon, Armor, Potion
            if "sword" in name.lower() or "blade" in name.lower() or "bow" in name.lower() or "staff" in name.lower():
                return {
                    "primary_color": "#e3f1ff", # Glowing steel
                    "secondary_color": "#b88a14", # Gilded hilt
                    "shape": "weapon_line",
                    "particle": "sparks",
                    "prompt": f"Cinematic loot icon of an epic sword called {name}, dark stone altar background, glowing blue runes, isometric angle, photorealistic digital painting."
                }
            elif "shield" in name.lower() or "chest" in name.lower() or "armor" in name.lower() or "plate" in name.lower():
                return {
                    "primary_color": "#a1a1a1", # Gunmetal grey
                    "secondary_color": "#7a0c0c", # Blood emblem
                    "shape": "shield_plate",
                    "particle": "glowing-shield",
                    "prompt": f"Dark-fantasy icon of reinforced steel plate armor called {name}, glowing runes, battle-worn scratches, epic lighting."
                }
            else: # Potions
                return {
                    "primary_color": "#e01616" if "health" in name.lower() else "#1088d6", # Elixir red/blue
                    "secondary_color": "#fce044", # Gilded cork stopper
                    "shape": "potion_bottle",
                    "particle": "bubbles",
                    "prompt": f"A shiny glass bottle containing a swirling red elixir of {name}, tiny glowing vapor bubbles escaping the cork, photorealistic."
                }

        else: # Environment/Terrain
            return {
                "background_color": "#121314",
                "fog_color": "#202528",
                "sky_color": "#0d0a14",
                "prompt": f"Atmospheric background illustration of the region {name}, dark ruins, volumetric fog, moonlight casting sharp shadows, Diablo IV aesthetic."
            }


class QuestAgent:
    """Agent 4: Quest Agent
    Responsibilities: Generates dynamically scaled quests, adjusts difficulty level, rewards, and objectives.
    """
    def generate_dynamic_quest(self, character_level: int, region: str) -> Dict[str, Any]:
        quest_types = ["Kill", "Gather", "Explore", "Escort"]
        chosen_type = random.choice(quest_types)

        # Difficulty scaling factors
        scale_factor = character_level
        gold_reward = 50 + (scale_factor * 45) + random.randint(0, 20)
        xp_reward = 100 + (scale_factor * 90)

        monsters = {
            "Eldergate": ["Fallen Ghoul", "Skeleton Warden", "Aether Bat"],
            "Shadow Vale": ["Void Specter", "Corrupted Elf", "Shadow Spider"],
            "Crystal Peaks": ["Frost Golem", "Ice Crystal Shard", "Peak Harpy"],
            "Ember Desert": ["Ember Drake", "Fire Scorpion", "Dust Wight"]
        }

        region_monsters = monsters.get(region, ["Ruins Crawler", "Corrupted Sentinel"])
        chosen_monster = random.choice(region_monsters)

        items_to_gather = ["Aether Crystal", "Glow-Cap Mushroom", "Dragon Scale", "Ancient Rune Tablet", "Lost locket"]
        chosen_item = random.choice(items_to_gather)

        landmarks = ["Sunken Altar", "Forgotten Crypt", "Echoing Obelisk", "Whispering Grove"]
        chosen_landmark = random.choice(landmarks)

        npcs_to_escort = ["Aria the Rebel", "Eldrin the Sage", "Maron the Trader", "Sariel the Weaver"]
        chosen_npc = random.choice(npcs_to_escort)

        if chosen_type == "Kill":
            amount = random.randint(3, 6) + (character_level // 2)
            title = f"Purge the {chosen_monster}s"
            description = f"The {chosen_monster}s are terrorizing the outer boundaries of {region}. Track down and slay {amount} of them to secure the area."
            target_name = chosen_monster
            target_amount = amount
        elif chosen_type == "Gather":
            amount = random.randint(2, 5)
            title = f"Reclaim the {chosen_item}s"
            description = f"The local artisans desperately need {amount} {chosen_item}s from the depths of {region} to weave protective warding charms."
            target_name = chosen_item
            target_amount = amount
        elif chosen_type == "Explore":
            title = f"Scout the {chosen_landmark}"
            description = f"Travel deep into {region} and scout the ruins surrounding the {chosen_landmark}. Report back if you find any void-corrupt portals."
            target_name = chosen_landmark
            target_amount = 1
        else: # Escort
            title = f"Guard {chosen_npc}"
            description = f"Provide safe passage to {chosen_npc} as they journey through the dangerous, enemy-infested paths of {region}."
            target_name = chosen_npc
            target_amount = 1

        # 40% chance of item reward
        item_reward = None
        if random.random() < 0.4:
            loot_suffixes = ["of the Fire", "of Arcane Might", "of Swiftness", "of Bloodshed"]
            reward_type = random.choice(["weapon", "armor", "potion"])
            if reward_type == "weapon":
                item_name = f"Vanguard Blade {random.choice(loot_suffixes)}"
            elif reward_type == "armor":
                item_name = f"Shadow Leather Plate"
            else:
                item_name = "Major Elixir of Rejuvenation"

            item_reward = {
                "name": item_name,
                "slot": reward_type
            }

        return {
            "title": title,
            "description": description,
            "quest_type": chosen_type,
            "target_name": target_name,
            "target_amount": target_amount,
            "gold_reward": gold_reward,
            "xp_reward": xp_reward,
            "item_reward_name": item_reward["name"] if item_reward else None,
            "item_reward_slot": item_reward["slot"] if item_reward else None
        }


class ConsistencyAgent:
    """Agent 5: Consistency Agent
    Responsibilities: Maintains logical consistency within Elyndor. If NPCs are killed,
    it records that; if dungeons are cleared, it alters descriptions; it records historical dialogue.
    """
    def record_npc_death(self, db_session: Any, npc_name: str) -> str:
        """Surgically marks NPC as deceased so future narrative generations bypass them.
        """
        from app.database import NPC
        npc = db_session.query(NPC).filter(NPC.name == npc_name).first()
        if npc:
            npc.is_alive = False
            npc.description += " (Deceased - slain during the Void Incursion)"
            db_session.commit()
            return f"Consistency Log: World updated. {npc_name} has died and will no longer offer quests."
        return "Consistency Log: NPC not found."

    def update_region_lore(self, db_session: Any, region_name: str, quest_title: str) -> str:
        """Mutates the visual descriptions and written lore of a region based on player accomplishments.
        """
        from app.database import WorldRegion
        region = db_session.query(WorldRegion).filter(WorldRegion.name == region_name).first()
        if region:
            current_lore = region.lore or ""
            region.lore = f"{current_lore}\n- Heroic achievement recorded: {quest_title} completed, purring the corruption."
            db_session.commit()
            return f"Consistency Log: Lore history updated for {region_name}."
        return "Consistency Log: Region not found."


class CombatAgent:
    """Agent 6: Combat Agent
    Responsibilities: Dynamic balancing of combat, dodge calculations, scaling HP/DMG,
    generating monster stats, and managing level ups.
    """
    def scale_enemy_stats(self, region_difficulty: int, base_hp: int = 50, base_dmg: int = 8) -> Dict[str, Any]:
        scaling = 1.0 + (region_difficulty * 0.45)
        return {
            "hp": int(base_hp * scaling),
            "max_hp": int(base_hp * scaling),
            "damage": int(base_dmg * scaling),
            "critical_chance": 0.05 + (region_difficulty * 0.02)
        }

    def process_turn(self, action: str, player_stats: Dict[str, Any], enemy_stats: Dict[str, Any]) -> Dict[str, Any]:
        """Runs the deterministic/probabilistic turn calculation loop.
        Actions: "light", "heavy", "skill", "dodge"
        """
        p_dmg = 0
        e_dmg = 0
        log_msgs = []
        p_dodged = False

        # Calculate Player's action
        if action == "dodge":
            p_dodged = random.random() < (0.45 + (player_stats["dexterity"] * 0.02))
            log_msgs.append("Player prepares to dodge, stepping into the shadows!")
        elif action == "light":
            base_dmg = 10 + (player_stats["strength"] if player_stats["class"] == "Warrior" else player_stats["dexterity"])
            p_dmg = int(base_dmg * random.uniform(0.9, 1.2))
            log_msgs.append(f"Player performs a swift Light Attack dealing {p_dmg} damage!")
        elif action == "heavy":
            base_dmg = 18 + (player_stats["strength"] * 1.5 if player_stats["class"] == "Warrior" else player_stats["dexterity"] * 1.5)
            # Heavy has a minor miss chance
            if random.random() < 0.15:
                p_dmg = 0
                log_msgs.append("Player swings with a Heavy Attack but MISSES!")
            else:
                p_dmg = int(base_dmg * random.uniform(1.0, 1.4))
                log_msgs.append(f"Player strikes with a heavy crushing attack dealing {p_dmg} damage!")
        elif action == "skill":
            if player_stats["mana"] >= 15:
                base_dmg = 25 + (player_stats["intelligence"] * 2.2)
                p_dmg = int(base_dmg)
                log_msgs.append(f"Player channels internal magical aether! Spell strike deals {p_dmg} fire damage!")
                player_stats["mana"] -= 15
            else:
                p_dmg = 5
                log_msgs.append("Out of Mana! Player weakly hits enemy dealing 5 damage.")

        # Calculate Enemy's action
        if not p_dodged:
            e_dmg = int(enemy_stats["damage"] * random.uniform(0.8, 1.2))
            # Crit check
            if random.random() < enemy_stats.get("critical_chance", 0.05):
                e_dmg = int(e_dmg * 1.5)
                log_msgs.append(f"CRITICAL STRIKE! Enemy claws back ferociously, dealing {e_dmg} damage!")
            else:
                log_msgs.append(f"The enemy counterattacks, dealing {e_dmg} damage.")
        else:
            log_msgs.append("Slick! Player flawlessly dodges the incoming swipe.")

        # Update HPs
        enemy_hp_remaining = max(0, enemy_stats["hp"] - p_dmg)
        player_hp_remaining = max(0, player_stats["hp"] - e_dmg)

        victory = enemy_hp_remaining <= 0
        defeat = player_hp_remaining <= 0 and not victory

        return {
            "player_damage_dealt": p_dmg,
            "enemy_damage_dealt": e_dmg if not p_dodged else 0,
            "combat_log": "\n".join(log_msgs),
            "player_hp_remaining": player_hp_remaining,
            "enemy_hp_remaining": enemy_hp_remaining,
            "player_dodged": p_dodged,
            "victory": victory,
            "defeat": defeat
        }
