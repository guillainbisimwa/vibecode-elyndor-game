import os
import json
from mcp.server.fastmcp import FastMCP
from sqlalchemy.orm import Session
from app.database import SessionLocal, Character, Quest, WorldRegion, NPC, NPCInteraction

# Initialize the FastMCP server for Legends of Elyndor
mcp = FastMCP("Legends of Elyndor Game Server")

def get_db_session() -> Session:
    """Helper to create a fresh database session."""
    return SessionLocal()

@mcp.tool()
def get_active_character_stats(character_name: str = None) -> str:
    """
    Query the database to retrieve the active character's statistics, level, gold, items, and attributes.
    If character_name is omitted, retrieves the first active character found in the system.
    """
    db = get_db_session()
    try:
        query = db.query(Character)
        if character_name:
            char = query.filter(Character.name == character_name).first()
        else:
            char = query.first()

        if not char:
            return "No active character found in the Legends of Elyndor database. Please register and create a character first."

        # Compile statistics
        stats = {
            "name": char.name,
            "class": char.character_class,
            "level": char.level,
            "experience": char.experience,
            "gold": char.gold,
            "hp": f"{char.health}/{char.max_health}",
            "mana": f"{char.mana}/{char.max_mana}",
            "current_region": char.current_region,
            "attributes": {
                "strength": char.strength,
                "dexterity": char.dexterity,
                "intelligence": char.intelligence,
                "vitality": char.vitality
            },
            "inventory_items": [{"name": item.name, "slot": item.slot, "equipped": item.is_equipped} for item in char.items]
        }
        return json.dumps(stats, indent=2)
    except Exception as e:
        return f"Error retrieving character stats: {str(e)}"
    finally:
        db.close()

@mcp.tool()
def get_quest_log() -> str:
    """
    Retrieves the quest log, including active, completed, and claimed quests, detailing gold and XP rewards.
    """
    db = get_db_session()
    try:
        quests = db.query(Quest).all()
        if not quests:
            return "Quest log is empty. No quests have been generated or accepted yet."

        quest_list = []
        for q in quests:
            quest_list.append({
                "id": q.id,
                "title": q.title,
                "description": q.description,
                "quest_type": q.quest_type,
                "objective": f"Progress: {q.current_amount}/{q.target_amount} of {q.target_name}",
                "rewards": {
                    "gold": q.gold_reward,
                    "xp": q.xp_reward,
                    "item": q.item_reward_name if q.item_reward_name else "None"
                },
                "status": q.status
            })
        return json.dumps(quest_list, indent=2)
    except Exception as e:
        return f"Error retrieving quest log: {str(e)}"
    finally:
        db.close()

@mcp.tool()
def get_world_regions_info() -> str:
    """
    Retrieves dynamic world data on Elyndor's regions, difficulty levels, lock status, and background lore.
    """
    db = get_db_session()
    try:
        regions = db.query(WorldRegion).all()
        if not regions:
            return "No regions found in the database."

        region_list = []
        for r in regions:
            region_list.append({
                "name": r.name,
                "description": r.description,
                "difficulty_level": r.difficulty_level,
                "is_unlocked": r.is_unlocked,
                "accumulated_lore": r.lore or "No lore achievements recorded yet."
            })
        return json.dumps(region_list, indent=2)
    except Exception as e:
        return f"Error retrieving world regions: {str(e)}"
    finally:
        db.close()

@mcp.tool()
def query_lore_history(region_name: str) -> str:
    """
    Retrieves the chronological lore log for a specific region.
    """
    db = get_db_session()
    try:
        region = db.query(WorldRegion).filter(WorldRegion.name == region_name).first()
        if not region:
            return f"Region '{region_name}' not found."
        
        return json.dumps({
            "region": region.name,
            "base_description": region.description,
            "lore_history": region.lore.split("\n") if region.lore else []
        }, indent=2)
    except Exception as e:
        return f"Error querying lore history: {str(e)}"
    finally:
        db.close()

if __name__ == "__main__":
    # When run directly, start the MCP server
    mcp.run()
