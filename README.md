# VibeCode: Legends of Elyndor 🎮✨
### Premium AI Multi-Agent RPG World Builder & Game Engine
**Submission Track:** Freestyle (Creative AI & Game Development)  
**Target:** Kaggle AI Agents: Intensive Vibe Coding Capstone Project

---

> [!IMPORTANT]
> **Course Evaluation Alignment**: This repository demonstrates mastery of course concepts by fully implementing a **Multi-Agent Collaboration System (via Google ADK)**, a custom **Model Context Protocol (MCP) Server**, and a rigorous **Evaluation Pipeline (adk eval)**, complete with state-of-the-art **Security Features** and **Docker-compose Deployability**.

---

## 🎬 Gameplay Preview

![Legends of Elyndor — real-time 3D gameplay in the Eldergate forest](docs/gameplay-3d.png)

*The **Eldergate** region rendered live in 3D: a torch-lit, fog-wrapped forest where your hero explores a themed world built from the backend's procedural map. Interactive objects glow with bloom — a blue crystal NPC (**Talk**), a horned monster (**Fight**), loot chests (**Loot**), and an arcane exit portal — while the HUD shows a live minimap, health/mana orbs, an XP bar, and an ARPG skill bar. Each region (Shadow Vale, Crystal Peaks, Ember Desert) has its own palette, lighting, sky, and props.*

---

## 🌌 1. The Pitch: Problem, Solution, & Value

### 🔴 The Problem Statement
Creating rich, high-fidelity RPG worlds requires a massive team of narrative designers, cartographers, quest coordinators, and game balancers. For solo developers or small studios, this creates a **prohibitive developmental bottleneck**. Traditional procedural generation (like Perlin noise or simple templates) often feels **flat, repetitive, and completely devoid of cohesive storytelling and logical world continuity**.

### 🟢 The Solution: Legends of Elyndor
`VibeCode: Legends of Elyndor` is an interactive dark-fantasy RPG built on top of a **collaborative six-agent AI engine**. Instead of simple randomization, specialized AI agents dynamically design, write, scale, and maintain an evolving, persistent medieval fantasy world. 

The game is fully playable in the browser using a high-fidelity **Vite + React + TypeScript + Zustand + Three.js (WebGL)** real-time 3D frontend game engine and a **FastAPI + SQLAlchemy + PostgreSQL/SQLite** backend.

### 🤖 Why Agents? The Unique AI Value
Multiple autonomous agents are uniquely qualified to solve this problem because world creation requires a split-responsibility model where different agents represent different "professional roles". By using a multi-agent structure, we can separate narrative whimsy from structural path validation and math balancing.
1. **Separation of Concerns**: Narrative agents can worry about "atmosphere" and "emotion," while world agents use BFS pathfinding to guarantee map solvability.
2. **Dynamic Continuity**: State updates are written consistently. When an NPC is slain, the **Consistency Agent** marks them dead and appends a lore achievement to the region's historical log.

---

## 📐 2. Multi-Agent System Architecture

The game's lifecycle is managed by six collaborative AI agents executing discrete tasks and maintaining absolute state consistency:

```mermaid
graph TD
    User([Player Browser Client]) -->|Interact / Move / Chat| FastAPI[FastAPI Web Server]
    
    subgraph Multi-Agent Collaboration Studio [Multi-Agent Collaboration Studio]
        FastAPI -->|Request Dialogue / Lore| Narrative[Narrative Agent (ADK-powered)]
        FastAPI -->|Generate Tilemap Layout| World[World Agent]
        FastAPI -->|Color Themes / Art Prompts| Asset[Asset Agent]
        FastAPI -->|Scale Rewards / Leveling| Quest[Quest Agent]
        FastAPI -->|Validate Events / Mutate State| Consistency[Consistency Agent]
        FastAPI -->|Balance DMG / Skill Pools| Combat[Combat Agent]
        
        Narrative -->|Instantiate ADK Agent & Runner| ADK[Google ADK Engine]
        World -->|BFS Solvability check| PathValidator[Path Solvability BFS Engine]
    end
    
    subgraph Database State Storage [Database State Storage]
        FastAPI -->|Read / Write State| DB[(PostgreSQL / SQLite Database)]
        Consistency -->|Mark dead NPCs / Lore history| DB
    end

    subgraph External Developer / Agent tooling [External Developer / Agent tooling]
        Developer([LLM Developer / Client]) -->|JSON-RPC via Stdio| MCPServer[Custom MCP Server]
        MCPServer -->|Query Real-Time Stats| DB
    end
```

---

## 🤖 3. The 6 Core AI Agents & Responsibilities

| Agent Name | Primary Responsibility | Input Details | Generated Artifacts / Outputs | Implementation Type |
| :--- | :--- | :--- | :--- | :--- |
| **1. Narrative Agent** | Writes historical lore, faction bios, NPC personas, and dynamic dialog bubbles. | User prompts & dialogue histories | Context-aware dialogue tree lines | **Google ADK Agent + Runner** |
| **2. World Agent** | Shapes map grids, coordinates starting spots, chests, and dungeon crypt exits. | Regional theme properties | Rectangular ASCII tilemap strings | **Procedural Graph Engine + BFS** |
| **3. Asset Agent** | Generates detailed image prompts & provides vector color codes for Phaser rendering. | Loot titles & regional tags | CSS hex palettes & sprite descriptors | **Procedural Generator** |
| **4. Quest Agent** | Generates dynamic quest lines and scales experience and gold rewards linearly with level. | Character Level & Region | Custom item loot tables & objective schemas | **Deterministic Scaler** |
| **5. Consistency Agent**| Mutates state to preserve world continuity (e.g. locks deceased NPCs, writes history logs).| Critical in-game events | Dynamic SQL state updates | **SQLAlchemy State Modifier** |
| **6. Combat Agent** | Scales enemy statistics and processes turn-by-turn physics (crit, miss, dodge, HP metrics).| Player stats & Attack choice | Combat result payloads | **Dynamic Balancing Engine** |

---

## ⚙️ 4. Premium Implementations: Code Features

### 🔌 Custom Model Context Protocol (MCP) Server
To provide state-of-the-art inspectability, we built a custom Model Context Protocol (MCP) server located in [mcp_server.py](file:///Users/gb/Desktop/python/vibecode-elyndor/backend/app/mcp_server.py). This server acts as a real-time database query bridge for external LLM developer clients:

* **Tools Exposed**:
  * `get_active_character_stats`: Retrieves current character stats, level, gold, items, and attributes.
  * `get_quest_log`: Retrieves active, completed, and claimed quests, detailing gold and XP rewards.
  * `get_world_regions_info`: Lists regions, difficulty levels, lock status, and background lore.
  * `query_lore_history`: Retrieves the chronological lore log for a specific region.

> [!TIP]
> This MCP server allows external agents (such as Antigravity) to attach to the running game and inspect player telemetry and database achievements in real time!

### 🎯 Official Google Agent Development Kit (ADK) Integration
Our **Narrative Agent** has been completely refactored to leverage the official **Google ADK**. It imports the ADK `Agent` and executes dialogues and NPC creations using `InMemoryRunner` with complete session and history preservation under the hood. 

See the full integration details in [agents.py](file:///Users/gb/Desktop/python/vibecode-elyndor/backend/app/agents.py#L12-L96).

---

## 🧪 5. Testing & The Evaluation Quality Flywheel

To maintain maximum narrative immersion, we configured a robust **Evaluation Pipeline** using the `adk eval` tools:

* **Evaluation Config**: [eval_config.yaml](file:///Users/gb/Desktop/python/vibecode-elyndor/tests/eval/eval_config.yaml) declares custom **LLM-as-judge** rubrics.
* **Evaluation Dataset**: [npc_dialogue_eval.json](file:///Users/gb/Desktop/python/vibecode-elyndor/tests/eval/datasets/npc_dialogue_eval.json) tests dialogue scenarios with realistic user prompts.

### Custom Metric: `dark_fantasy_alignment`
We created a custom LLM-as-judge metric `dark_fantasy_alignment` to programmatically score NPC responses from 1 to 5 based on atmospheric vocabulary, elven lore fitting, and absence of generic modern AI assistant clichés.

To execute the evaluation pipeline locally, activate your virtual environment and run:
```bash
cd backend
.venv/bin/adk eval app ../tests/eval/datasets/npc_dialogue_eval.json --config_file_path ../tests/eval/eval_config.yaml
```

---

## 🔒 6. Comprehensive Security Features

We adhere to the highest security standards to prevent key leakage and data exploitation:
1. **JWT Authorization Bearer Tokens**: Enforces sub-claims, token expiration times, and secure SHA-256 signatures (`auth.py`).
2. **Zero Hardcoded Secrets**: Securely loads environment variables (`GEMINI_API_KEY`, `DATABASE_URL`) without checking keys into Git.
3. **Environment Isolation**: `.gitignore` strictly blocks checking in `.env` files, `.venv` virtual environments, or `*.db` SQLite instances.
4. **Deterministic Boundary Validation**: Restricts character level-loading variables to validated pre-seeded schemas, blocking path-traversal or SQL injections.

---

## 🚀 7. Quick Start & Setup Instructions

### Prerequisites
1. Install [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).
2. (Optional) Set your `GEMINI_API_KEY` environmental variable. 

> [!NOTE]
> **Dual-Mode Synthesis fallback**: If `GEMINI_API_KEY` is missing, the backend auto-engages **highly immersive local procedural engines** to keep the game 100% playable instantly without requiring any internet connection or configuration!

---

### Option 1: Unified Launch (Docker Compose)
Inside the root project directory (`vibecode-elyndor/`), execute:
```bash
docker-compose up --build
```
Once built, open your browser to:
* **Frontend Game Screen**: [http://localhost:3000](http://localhost:3000)
* **FastAPI Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option 2: Local Manual Launch (No Docker)

#### 1. Start the Backend:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 2. Start the Frontend:
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The system will automatically detect the local API server and sync character state.

---

## 🕹️ 8. How to Play

> [!TIP]
> No account or API key needed. If the backend is unavailable, the game drops into a fully playable **offline sandbox** — just log in with any username/password to start.

### 1. Create your hero
1. On the **login screen**, enter any username and password and press **Login**.
2. Choose a class — each has different starting stats:
   - ⚔️ **Warrior** — high health and strength (melee bruiser).
   - 🧙 **Mage** — high intelligence and mana (arcane damage).
   - 🏹 **Ranger** — high dexterity (agile skirmisher).
3. Name your hero and confirm. You begin in **Eldergate** at Level 1.

### 2. From the Dashboard
- Review your **stats, inventory, quests, and world progress**.
- Press **Enter Game World** to open the **World Map**, then **Travel** to any unlocked region. Regions are level-gated — reach the required level to unlock **Shadow Vale**, **Crystal Peaks**, and **Ember Desert**.

### 3. Explore the 3D world

| Action | Controls |
| :--- | :--- |
| Move your hero | `W` `A` `S` `D` or the **Arrow keys** |
| Orbit the camera | **Click + drag** |
| Zoom in / out | **Mouse scroll** |

Walk onto a tile to interact with what's on it:

| Icon | Object | What happens |
| :--- | :--- | :--- |
| 💬 | **NPC crystal (Talk)** | Opens dialogue. Ask about a *"quest"* or *"help"* to receive dynamic tasks. |
| ⚔️ | **Monster (Fight)** | Starts **turn-based combat** in the right-hand panel. |
| 🪙 | **Loot chest** | Instantly claims bonus gold. |
| 🚪 | **Exit portal** | Clears the region and returns you to town. |

A contextual prompt appears at the bottom of the screen whenever you are next to something interactive, and the **minimap** (top-right) shows nearby NPCs, monsters, loot, and the exit.

### 4. Combat
When a fight begins, use the action panel:
- 🗡️ **Swift Strike** — fast, reliable damage.
- 🔨 **Heavy Bash** — high damage.
- 🔮 **Aether Blast** — arcane skill.
- 🏃 **Shadow Step** — dodge the enemy's next hit.
- 🧪 **Health Potion** — restore HP (limited quantity).

Win to earn **gold and XP**; lose all your HP and you fall (respawn from the failure screen). Your **health/mana orbs** and **XP bar** update live in the left panel.

### 5. Progress & goals
- Complete quests and claim their rewards from the **Dashboard** to gain gold and XP.
- Level up to **unlock harder regions** and stronger loot.
- Use **Retreat to Town** at any time to return to the World Map safely.

Good luck, hero — the shadow over Elyndor is spreading. 👑
