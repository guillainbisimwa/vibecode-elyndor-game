import os
import json
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Determine Database URL - use SQLite by default for zero-config local play, PostgreSQL if specified in env
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./legends_of_elyndor.db")

# For SQLite, we need to allow multiple threads to access it
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    characters = relationship("Character", back_populates="user", cascade="all, delete-orphan")

class Character(Base):
    __tablename__ = "characters"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    character_class = Column(String, nullable=False) # "Warrior", "Mage", "Ranger"
    
    # Progression
    level = Column(Integer, default=1)
    experience = Column(Integer, default=0)
    gold = Column(Integer, default=100)
    
    # Base Stats
    strength = Column(Integer, default=10)
    dexterity = Column(Integer, default=10)
    intelligence = Column(Integer, default=10)
    vitality = Column(Integer, default=10)
    
    # State
    health = Column(Integer, default=100)
    max_health = Column(Integer, default=100)
    mana = Column(Integer, default=50)
    max_mana = Column(Integer, default=50)
    current_region = Column(String, default="Eldergate")
    
    user = relationship("User", back_populates="characters")
    quests = relationship("Quest", back_populates="character", cascade="all, delete-orphan")
    items = relationship("Item", back_populates="character", cascade="all, delete-orphan")
    interactions = relationship("NPCInteraction", back_populates="character", cascade="all, delete-orphan")

class Quest(Base):
    __tablename__ = "quests"
    
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    quest_type = Column(String, nullable=False) # "Kill", "Gather", "Explore", "Escort", "Story"
    
    # Objectives
    target_name = Column(String, nullable=False)
    target_amount = Column(Integer, default=1)
    current_amount = Column(Integer, default=0)
    
    # Rewards
    gold_reward = Column(Integer, default=50)
    xp_reward = Column(Integer, default=100)
    item_reward_name = Column(String, nullable=True)
    item_reward_slot = Column(String, nullable=True) # "weapon", "armor", "potion"
    
    # Status: "active", "completed", "claimed"
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    character = relationship("Character", back_populates="quests")

class Item(Base):
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    name = Column(String, nullable=False)
    slot = Column(String, nullable=False) # "weapon", "armor", "potion", "quest"
    value = Column(Integer, default=10)
    stat_modifier = Column(String, default="{}") # JSON string containing stat mods e.g., '{"strength": 2}'
    quantity = Column(Integer, default=1)
    is_equipped = Column(Boolean, default=False)
    
    character = relationship("Character", back_populates="items")
    
    def get_modifiers(self) -> Dict[str, int]:
        try:
            return json.loads(self.stat_modifier)
        except Exception:
            return {}

class NPC(Base):
    __tablename__ = "npcs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    personality = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    greeting = Column(Text, nullable=False)
    current_region = Column(String, nullable=False)
    is_alive = Column(Boolean, default=True)
    portrait_prompt = Column(Text, nullable=True)

class NPCInteraction(Base):
    __tablename__ = "npc_interactions"
    
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    npc_id = Column(Integer, ForeignKey("npcs.id"), nullable=False)
    dialogue_history = Column(Text, default="[]") # JSON string of [ {"role": "player", "text": "..."}, {"role": "npc", "text": "..."} ]
    
    character = relationship("Character", back_populates="interactions")
    npc = relationship("NPC")
    
    def get_history(self) -> List[Dict[str, str]]:
        try:
            return json.loads(self.dialogue_history)
        except Exception:
            return []
            
    def set_history(self, history: List[Dict[str, str]]):
        self.dialogue_history = json.dumps(history)

class WorldRegion(Base):
    __tablename__ = "world_regions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # "Eldergate", "Shadow Vale", etc.
    description = Column(Text, nullable=False)
    terrain_ascii = Column(Text, nullable=False) # 2D layout representation
    is_unlocked = Column(Boolean, default=True)
    lore = Column(Text, nullable=True)
    difficulty_level = Column(Integer, default=1)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
