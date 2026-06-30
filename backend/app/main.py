import os
import json
import random
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database import init_db, get_db, User, Character, Quest, Item, NPC, NPCInteraction, WorldRegion
from app.auth import get_current_user, verify_password, get_password_hash, create_access_token
from app.schemas import (
    UserCreate, UserResponse, Token, CharacterCreate, CharacterResponse,
    CharacterFullResponse, ItemResponse, QuestResponse, NPCResponse, ChatRequest,
    ChatResponse, CombatActionRequest, CombatActionResponse, WorldRegionResponse,
    DashboardSummaryResponse
)
from app.agents import NarrativeAgent, WorldAgent, AssetAgent, QuestAgent, ConsistencyAgent, CombatAgent

app = FastAPI(
    title="VibeCode: Legends of Elyndor API",
    description="Backend AI Multi-Agent engine for procedural RPG world building",
    version="1.0.0"
)

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agents
narrative_agent = NarrativeAgent()
world_agent = WorldAgent()
asset_agent = AssetAgent()
quest_agent = QuestAgent()
consistency_agent = ConsistencyAgent()
combat_agent = CombatAgent()

# Create tables and seed data on startup
@app.on_event("startup")
def on_startup():
    init_db()
    db = next(get_db())
    try:
        seed_database(db)
    finally:
        db.close()

def seed_database(db: Session):
    """Seed the database with initial world regions and NPCs if they do not exist."""
    # Seed Regions
    regions_to_seed = [
        {
            "name": "Eldergate",
            "description": "An ancient woodland kingdom surrounded by massive marble archways. The air is clean, and glowing weft-crystals light the dark forest pathways.",
            "difficulty_level": 1,
            "lore": "Eldergate was once the central trade nexus of Elyndor. Today, it stands as a fragile sanctuary against the spreading void."
        },
        {
            "name": "Shadow Vale",
            "description": "A dark, misty hollow blanketed in permanent eclipse. Twisted ash trees and whispers of corrupted, long-dead elven lords fill the fog.",
            "difficulty_level": 2,
            "lore": "The Vale fell during the Eclipse Incursion. Hidden deep within its purple fog lies the legendary obsidian tomb."
        },
        {
            "name": "Crystal Peaks",
            "description": "Towering mountain summits made of deep, frozen sapphire shards. Blizzards howl through narrow, glowing crystalline ice caverns.",
            "difficulty_level": 3,
            "lore": "The Peak is the birthplace of all elemental magic in Elyndor. Frost golems guard its ancient, high-altitude research shrines."
        },
        {
            "name": "Ember Desert",
            "description": "A scorching, ash-blown wasteland where lava geysers tear through red sands. Home to fire drakes and ruins of lost magma metalworks.",
            "difficulty_level": 4,
            "lore": "Legend says the desert was created when an ember dragon collapsed from the sky, its fiery heart fusing the dunes into glass."
        }
    ]
    
    for r in regions_to_seed:
        existing = db.query(WorldRegion).filter(WorldRegion.name == r["name"]).first()
        if not existing:
            # Generate Map Layout using WorldAgent
            ascii_layout = world_agent.generate_region_map(r["name"])
            new_reg = WorldRegion(
                name=r["name"],
                description=r["description"],
                difficulty_level=r["difficulty_level"],
                lore=r["lore"],
                terrain_ascii=ascii_layout,
                is_unlocked=True if r["difficulty_level"] == 1 else False
            )
            db.add(new_reg)
            
    # Seed NPCs
    npcs_to_seed = [
        {
            "name": "Aria the Rebel",
            "personality": "rebellious",
            "current_region": "Eldergate"
        },
        {
            "name": "Eldrin the Sage",
            "personality": "weary",
            "current_region": "Shadow Vale"
        },
        {
            "name": "Maron the Trader",
            "personality": "cynical",
            "current_region": "Crystal Peaks"
        },
        {
            "name": "Sariel the Weaver",
            "personality": "noble",
            "current_region": "Ember Desert"
        }
    ]
    
    for n in npcs_to_seed:
        existing = db.query(NPC).filter(NPC.name == n["name"]).first()
        if not existing:
            # Use NarrativeAgent to generate NPC details
            profile = narrative_agent.generate_npc_profile(n["name"], n["current_region"])
            # Generate Phaser style asset properties using AssetAgent
            asset_meta = asset_agent.generate_asset_metadata("character", n["name"])
            
            new_npc = NPC(
                name=n["name"],
                personality=profile["personality"],
                description=profile["description"],
                greeting=profile["greeting"],
                current_region=n["current_region"],
                is_alive=True,
                portrait_prompt=asset_meta["prompt"]
            )
            db.add(new_npc)
            
    db.commit()


# --- AUTHENTICATION ENDPOINTS ---

@app.post("/api/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
        
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


# --- CHARACTER ENDPOINTS ---

@app.post("/api/character/create", response_model=CharacterResponse)
def create_character(char: CharacterCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Limit to 1 character per user for simplicity
    existing = db.query(Character).filter(Character.user_id == current_user.id).first()
    if existing:
        # Delete existing character to make fresh ones easy to test
        db.delete(existing)
        db.commit()
        
    # Class Base Stats
    stats = {
        "Warrior": {"str": 15, "dex": 10, "int": 8, "vit": 14, "hp": 150, "mp": 30},
        "Mage": {"str": 6, "dex": 11, "int": 16, "vit": 8, "hp": 80, "mp": 100},
        "Ranger": {"str": 10, "dex": 16, "int": 10, "vit": 11, "hp": 110, "mp": 50}
    }.get(char.character_class, {"str": 10, "dex": 10, "int": 10, "vit": 10, "hp": 100, "mp": 50})
    
    new_char = Character(
        user_id=current_user.id,
        name=char.name,
        character_class=char.character_class,
        strength=stats["str"],
        dexterity=stats["dex"],
        intelligence=stats["int"],
        vitality=stats["vit"],
        health=stats["hp"],
        max_health=stats["hp"],
        mana=stats["mp"],
        max_mana=stats["mp"],
        current_region=char.starting_region,
        gold=150,
        experience=0,
        level=1
    )
    db.add(new_char)
    db.commit()
    db.refresh(new_char)
    
    # Add Starting Weapons/Armor
    starting_items = [
        Item(character_id=new_char.id, name=f"Recruit's {char.character_class} Weapon", slot="weapon", value=15, is_equipped=True, stat_modifier='{"strength": 2}' if char.character_class == "Warrior" else '{"dexterity": 2}' if char.character_class == "Ranger" else '{"intelligence": 2}'),
        Item(character_id=new_char.id, name="Rusty Chainmail" if char.character_class == "Warrior" else "Scout Cloak", slot="armor", value=20, is_equipped=True, stat_modifier='{"vitality": 3}'),
        Item(character_id=new_char.id, name="Health Potion", slot="potion", value=5, quantity=3)
    ]
    db.add_all(starting_items)
    db.commit()
    
    return new_char

@app.get("/api/character/active", response_model=CharacterFullResponse)
def get_active_character(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.user_id == current_user.id).first()
    if not char:
        raise HTTPException(status_code=404, detail="No character found. Create one first.")
        
    return {
        "profile": char,
        "inventory": char.items,
        "active_quests": [q for q in char.quests if q.status == "active"]
    }

@app.get("/api/character/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.user_id == current_user.id).first()
    if not char:
        raise HTTPException(status_code=404, detail="No character found")
        
    # Compile dashboard data
    active_quests = db.query(Quest).filter(Quest.character_id == char.id, Quest.status == "active").all()
    completed_quests = db.query(Quest).filter(Quest.character_id == char.id, Quest.status == "completed").all()
    inventory_count = db.query(Item).filter(Item.character_id == char.id).count()
    
    # World progress based on how many regions are unlocked
    total_regions = db.query(WorldRegion).count()
    unlocked_regions = db.query(WorldRegion).filter(WorldRegion.is_unlocked == True).count()
    progress_percentage = int((unlocked_regions / total_regions) * 100) if total_regions > 0 else 0
    
    # Create logs/recent activities
    activities = [
        f"Character {char.name} the {char.character_class} initialized.",
        f"Explored the safe boundaries of {char.current_region}."
    ]
    if completed_quests:
        for q in completed_quests[-2:]:
            activities.append(f"Completed Quest: '{q.title}' and received gold.")
            
    return {
        "character": char,
        "recent_activity": list(reversed(activities)),
        "active_quest_count": len(active_quests),
        "completed_quest_count": len(completed_quests),
        "inventory_count": inventory_count,
        "world_progress_percentage": progress_percentage
    }


# --- REGIONS ENDPOINTS ---

@app.get("/api/regions", response_model=List[WorldRegionResponse])
def get_regions(db: Session = Depends(get_db)):
    return db.query(WorldRegion).all()


# --- NPC INTERACTION & DIALOGUE MULTI-AGENT ENDPOINT ---

@app.post("/api/npc/chat/{npc_id}", response_model=ChatResponse)
def chat_with_npc(npc_id: int, request: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.user_id == current_user.id).first()
    npc = db.query(NPC).filter(NPC.id == npc_id).first()
    
    if not char or not npc:
        raise HTTPException(status_code=404, detail="Character or NPC not found")
        
    if not npc.is_alive:
        raise HTTPException(status_code=400, detail="This NPC is deceased and cannot speak.")
        
    # Check/Create Interaction History
    interaction = db.query(NPCInteraction).filter(
        NPCInteraction.character_id == char.id,
        NPCInteraction.npc_id == npc.id
    ).first()
    
    if not interaction:
        interaction = NPCInteraction(character_id=char.id, npc_id=npc.id, dialogue_history="[]")
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        
    history = interaction.get_history()
    
    # Narrative Agent: Generate Response
    reply_text = narrative_agent.generate_dialogue_response(npc.name, npc.personality, history, request.message)
    
    # Update History
    history.append({"role": "player", "text": request.message})
    history.append({"role": "npc", "text": reply_text})
    interaction.set_history(history)
    db.commit()
    
    # Quest Agent: Trigger a quest generation if the conversation is starting or player asks for tasks
    new_quest = None
    trigger_words = ["quest", "job", "help", "work", "task", "slay", "find", "retrieve", "journey", "ready"]
    user_asks_for_quest = any(w in request.message.lower() for w in trigger_words)
    
    # Only offer a quest if they don't already have too many active ones
    active_quests_count = db.query(Quest).filter(Quest.character_id == char.id, Quest.status == "active").count()
    
    if user_asks_for_quest and active_quests_count < 2:
        # Generate custom scaled quest
        q_data = quest_agent.generate_dynamic_quest(char.level, char.current_region)
        
        # Add to database
        new_quest = Quest(
            character_id=char.id,
            title=q_data["title"],
            description=q_data["description"],
            quest_type=q_data["quest_type"],
            target_name=q_data["target_name"],
            target_amount=q_data["target_amount"],
            current_amount=0,
            gold_reward=q_data["gold_reward"],
            xp_reward=q_data["xp_reward"],
            item_reward_name=q_data["item_reward_name"],
            item_reward_slot=q_data["item_reward_slot"],
            status="active"
        )
        db.add(new_quest)
        db.commit()
        db.refresh(new_quest)
        
        # Narrative Agent appends an explanation
        reply_text += f"\n\n[New Quest Received: {new_quest.title}! Check your quest log!]"
        history[-1]["text"] = reply_text
        interaction.set_history(history)
        db.commit()
        
    return {
        "reply": reply_text,
        "history": [NPCInteractionHistory(role=h["role"], text=h["text"]) for h in history],
        "new_quest": new_quest
    }


# --- QUEST REWARD CLAIMING ENDPOINT ---

@app.post("/api/quests/claim/{quest_id}", response_model=CharacterResponse)
def claim_quest_reward(quest_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.user_id == current_user.id).first()
    quest = db.query(Quest).filter(Quest.id == quest_id, Quest.character_id == char.id).first()
    
    if not char or not quest:
        raise HTTPException(status_code=404, detail="Character or Quest not found")
        
    if quest.status != "completed":
        raise HTTPException(status_code=400, detail="Quest is not yet completed")
        
    # Claim gold & experience
    char.gold += quest.gold_reward
    char.experience += quest.xp_reward
    quest.status = "claimed"
    
    # Process Item Reward if present
    if quest.item_reward_name:
        # Generate item visual metadata using Asset Agent
        asset_meta = asset_agent.generate_asset_metadata("item", quest.item_reward_name)
        
        new_item = Item(
            character_id=char.id,
            name=quest.item_reward_name,
            slot=quest.item_reward_slot,
            value=int(quest.gold_reward * 0.4),
            stat_modifier=json.dumps(asset_meta.get("stat_modifier", {})),
            quantity=1,
            is_equipped=False
        )
        db.add(new_item)
        
    # Level Up Calculation (1000 XP per level simple scaling)
    next_level_xp = char.level * 1000
    if char.experience >= next_level_xp:
        char.level += 1
        char.experience -= next_level_xp
        # Scale stats on level-up
        char.strength += 2
        char.dexterity += 2
        char.intelligence += 2
        char.vitality += 2
        char.max_health += 25
        char.health = char.max_health
        char.max_mana += 10
        char.mana = char.max_mana
        
        # Unlock next region based on level
        if char.level == 2:
            reg = db.query(WorldRegion).filter(WorldRegion.name == "Shadow Vale").first()
            if reg: reg.is_unlocked = True
        elif char.level == 3:
            reg = db.query(WorldRegion).filter(WorldRegion.name == "Crystal Peaks").first()
            if reg: reg.is_unlocked = True
        elif char.level >= 4:
            reg = db.query(WorldRegion).filter(WorldRegion.name == "Ember Desert").first()
            if reg: reg.is_unlocked = True
            
    # Consistency Agent: Record Lore updates
    consistency_agent.update_region_lore(db, char.current_region, quest.title)
    
    db.commit()
    db.refresh(char)
    return char


# --- REAL-TIME COMBAT SIMULATION ENDPOINT ---

@app.post("/api/combat/action", response_model=CombatActionResponse)
def process_combat_turn(req: CombatActionRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.user_id == current_user.id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    # Compile stats
    player_stats = {
        "class": char.character_class,
        "strength": char.strength,
        "dexterity": char.dexterity,
        "intelligence": char.intelligence,
        "vitality": char.vitality,
        "hp": req.player_hp,
        "mana": char.mana
    }
    
    # Scale enemy difficulty using CombatAgent
    region = db.query(WorldRegion).filter(WorldRegion.name == char.current_region).first()
    diff = region.difficulty_level if region else 1
    
    base_enemy_stats = combat_agent.scale_enemy_stats(diff)
    enemy_stats = {
        "hp": req.enemy_hp,
        "damage": base_enemy_stats["damage"],
        "critical_chance": base_enemy_stats["critical_chance"]
    }
    
    # Process turn
    result = combat_agent.process_turn(req.attack_type, player_stats, enemy_stats)
    
    # Manage Mana depletion on spell cast
    if req.attack_type == "skill" and char.mana >= 15:
        char.mana -= 15
        
    # Generate Rewards on Victory
    rewards = None
    if result["victory"]:
        gold_reward = 15 + (diff * 10) + random.randint(1, 10)
        xp_reward = 35 + (diff * 20)
        
        char.gold += gold_reward
        char.experience += xp_reward
        
        # Check active kill quests and advance completion counters
        active_kill_quests = db.query(Quest).filter(
            Quest.character_id == char.id,
            Quest.status == "active",
            Quest.quest_type == "Kill"
        ).all()
        
        for q in active_kill_quests:
            # Check if target name matches or can be matched
            q.current_amount += 1
            if q.current_amount >= q.target_amount:
                q.status = "completed"
                
        # Check level up
        next_level_xp = char.level * 1000
        if char.experience >= next_level_xp:
            char.level += 1
            char.experience -= next_level_xp
            char.strength += 2
            char.dexterity += 2
            char.intelligence += 2
            char.vitality += 2
            char.max_health += 25
            char.health = char.max_health
            char.max_mana += 10
            char.mana = char.max_mana
            
            if char.level == 2:
                reg = db.query(WorldRegion).filter(WorldRegion.name == "Shadow Vale").first()
                if reg: reg.is_unlocked = True
            elif char.level == 3:
                reg = db.query(WorldRegion).filter(WorldRegion.name == "Crystal Peaks").first()
                if reg: reg.is_unlocked = True
            elif char.level >= 4:
                reg = db.query(WorldRegion).filter(WorldRegion.name == "Ember Desert").first()
                if reg: reg.is_unlocked = True
                
        rewards = {"gold": gold_reward, "xp": xp_reward}
        
    db.commit()
    
    return CombatActionResponse(
        player_damage_dealt=result["player_damage_dealt"],
        enemy_damage_dealt=result["enemy_damage_dealt"],
        combat_log=result["combat_log"],
        player_hp_remaining=result["player_hp_remaining"],
        enemy_hp_remaining=result["enemy_hp_remaining"],
        player_dodged=result["player_dodged"],
        victory=result["victory"],
        defeat=result["defeat"],
        rewards=rewards
    )


# --- GENERAL GAME CONTROL ENDPOINTS ---

@app.post("/api/game/reset")
def hard_reset_game(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.user_id == current_user.id).first()
    if char:
        db.delete(char)
        db.commit()
    return {"status": "success", "message": "Character and active states deleted. Ready for new character creation."}
