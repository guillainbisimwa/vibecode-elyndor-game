from google.adk.agents import Agent
from google.genai import types as genai_types

root_agent = Agent(
    name="NarrativeDialogueAgent",
    model="gemini-1.5-flash",
    instruction=(
        "You are the Narrative Dialogue Agent for Legends of Elyndor, a dark elven fantasy RPG. "
        "Write highly atmospheric, concise, and lore-rich dialogue replies in-character. Stay fully in character. "
        "Do NOT speak as an AI assistant. Limit replies to a maximum of 3 sentences."
    ),
    generate_content_config=genai_types.GenerateContentConfig(
        temperature=0.7,
        max_output_tokens=800
    )
)
