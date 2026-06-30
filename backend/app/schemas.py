from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4)

class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=16)
    character_class: str = Field(..., description="Warrior, Mage, or Ranger")
    starting_region: str = Field("Eldergate", description="Region to start the journey")

class ItemResponse(BaseModel):
    id: int
    name: str
    slot: str
    value: int
    stat_modifier: str
    quantity: int
    is_equipped: bool
    
    class Config:
        from_attributes = True

class QuestResponse(BaseModel):
    id: int
    title: str
    description: str
    quest_type: str
    target_name: str
    target_amount: int
    current_amount: int
    gold_reward: int
    xp_reward: int
    item_reward_name: Optional[str] = None
    item_reward_slot: Optional[str] = None
    status: str
    
    class Config:
        from_attributes = True

class NPCResponse(BaseModel):
    id: int
    name: str
    personality: str
    description: str
    greeting: str
    current_region: str
    is_alive: bool
    portrait_prompt: Optional[str] = None
    
    class Config:
        from_attributes = True

class NPCInteractionHistory(BaseModel):
    role: str # "player" or "npc"
    text: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    history: List[NPCInteractionHistory]
    new_quest: Optional[QuestResponse] = None

class CharacterResponse(BaseModel):
    id: int
    name: str
    character_class: str
    level: int
    experience: int
    gold: int
    strength: int
    dexterity: int
    intelligence: int
    vitality: int
    health: int
    max_health: int
    mana: int
    max_mana: int
    current_region: str
    
    class Config:
        from_attributes = True

class CharacterFullResponse(BaseModel):
    profile: CharacterResponse
    inventory: List[ItemResponse]
    active_quests: List[QuestResponse]
    
    class Config:
        from_attributes = True

class CombatActionRequest(BaseModel):
    enemy_name: str
    attack_type: str # "light", "heavy", "skill", "dodge"
    enemy_hp: int
    player_hp: int

class CombatActionResponse(BaseModel):
    player_damage_dealt: int
    enemy_damage_dealt: int
    combat_log: str
    player_hp_remaining: int
    enemy_hp_remaining: int
    player_dodged: bool
    victory: bool
    defeat: bool
    rewards: Optional[Dict[str, Any]] = None # gold, xp, item

class WorldRegionResponse(BaseModel):
    id: int
    name: str
    description: str
    terrain_ascii: str
    is_unlocked: bool
    lore: Optional[str] = None
    difficulty_level: int
    
    class Config:
        from_attributes = True

class DashboardSummaryResponse(BaseModel):
    character: CharacterResponse
    recent_activity: List[str]
    active_quest_count: int
    completed_quest_count: int
    inventory_count: int
    world_progress_percentage: int
