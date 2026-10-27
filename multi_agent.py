"""
Mini système multi-agents : orchestrateur + explorer / implementer / reviewer.

Usage:
    pip install anthropic
    export ANTHROPIC_API_KEY=...
    export REPO=/chemin/vers/un/petit/repo      # défaut : dossier courant
    export TEST_CMD="pytest -q"                 # défaut
    python multi_agent.py "Ajoute une fonction slugify() dans utils.py avec des tests"

Conseil : travaille sur un repo git propre (ou une copie) pour pouvoir `git diff` / revert.
"""
import os
import subprocess
import sys
from pathlib import Path

import anthropic

MODEL = os.environ.get("MODEL", "claude-sonnet-5-5")
ROOT = Path(os.environ.get("REPO", ".")).resolve()
TEST_CMD = os.environ.get("TEST_CMD", "pytest -q")
MAX_TURNS = 15          # garde-fou par agent
MAX_DELEGATIONS = 8     # garde-fou pour l'orchestrateur
MAX_OUTPUT = 8000       # on tronque les sorties d'outils pour ne pas gonfler le contexte

client = anthropic.Anthropic()


# ---------------------------------------------------------------- outils (implémentations)
def _safe(path: str) -> Path:
    p = (ROOT / path).resolve()
    if ROOT not in p.parents and p != ROOT:
        raise ValueError(f"Chemin hors du repo : {path}")
    return p


def _trunc(s: str) -> str:
    return s if len(s) <= MAX_OUTPUT else s[:MAX_OUTPUT] + "\n...[tronqué]"


def list_files(inp):
    base = _safe(inp.get("path", "."))
    files = [
        str(p.relative_to(ROOT))
        for p in sorted(base.rglob("*"))
        if p.is_file() and ".git" not in p.parts and "node_modules" not in p.parts
        and "__pycache__" not in p.parts
    ]
    return _trunc("\n".join(files) or "(vide)")


def read_file(inp):
    return _trunc(_safe(inp["path"]).read_text(errors="replace"))


def grep(inp):
    r = subprocess.run(
        ["grep", "-rn", "--exclude-dir=.git", "--exclude-dir=node_modules", inp["pattern"], "."],
        cwd=ROOT, capture_output=True, text=True, timeout=30,
    )
    return _trunc(r.stdout or "(aucun résultat)")


def write_file(inp):
    p = _safe(inp["path"])
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(inp["content"])
    return f"OK : {inp['path']} écrit ({len(inp['content'])} caractères)"


def run_tests(inp):
    try:
        r = subprocess.run(TEST_CMD, shell=True, cwd=ROOT, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return "Timeout (120s)"
    return _trunc(f"exit code {r.returncode}\n{r.stdout}\n{r.stderr}")


HANDLERS = {
    "list_files": list_files,
    "read_file": read_file,
    "grep": grep,
    "write_file": write_file,
    "run_tests": run_tests,
}

# ---------------------------------------------------------------- outils (schémas pour le LLM)
SCHEMAS = {
    "list_files": {
        "name": "list_files",
        "description": "Liste les fichiers du repo (récursif) sous un dossier.",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string", "default": "."}}},
    },
    "read_file": {
        "name": "read_file",
        "description": "Lit un fichier du repo.",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
    },
    "grep": {
        "name": "grep",
        "description": "Recherche une regex dans le repo.",
        "input_schema": {"type": "object", "properties": {"pattern": {"type": "string"}}, "required": ["pattern"]},
    },
    "write_file": {
        "name": "write_file",
        "description": "Crée ou remplace un fichier (contenu complet).",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
            "required": ["path", "content"],
        },
    },
    "run_tests": {
        "name": "run_tests",
        "description": "Lance la suite de tests du projet.",
        "input_schema": {"type": "object", "properties": {}},
    },
    "delegate": {
        "name": "delegate",
        "description": (
            "Délègue une sous-tâche à un agent spécialisé. L'agent démarre SANS aucun contexte : "
            "le brief doit être autonome (objectif, fichiers concernés, contraintes, format de réponse attendu)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent": {"type": "string", "enum": ["explorer", "implementer", "reviewer"]},
                "brief": {"type": "string"},
            },
            "required": ["agent", "brief"],
        },
    },
}

# ---------------------------------------------------------------- définition des agents
AGENTS = {
    "explorer": {
        "system": (
            "Tu es un agent d'exploration en LECTURE SEULE. Tu cartographies le code pertinent pour la tâche. "
            "Réponds par une synthèse courte (max ~30 lignes) : fichiers clés, conventions, points d'attention. "
            "Pas de code complet, pas de blabla."
        ),
        "tools": ["list_files", "read_file", "grep"],
    },
    "implementer": {
        "system": (
            "Tu es un développeur. Tu implémentes exactement ce que demande le brief, en respectant les "
            "conventions existantes. Lis le code avant d'écrire. Termine par la liste des fichiers modifiés "
            "et un résumé en 3-5 lignes."
        ),
        "tools": ["list_files", "read_file", "grep", "write_file"],
    },
    "reviewer": {
        "system": (
            "Tu es un reviewer/testeur strict. Tu NE modifies PAS le code. Lis les fichiers indiqués, lance les "
            "tests, cherche bugs, cas limites oubliés et écarts avec la demande. Réponds par : "
            "VERDICT: OK ou VERDICT: KO, puis la liste précise des problèmes (fichier, ligne, pourquoi)."
        ),
        "tools": ["list_files", "read_file", "grep", "run_tests"],
    },
}

ORCHESTRATOR_SYSTEM = """Tu es l'orchestrateur d'une petite équipe d'agents : explorer, implementer, reviewer.
Tu n'écris pas de code toi-même ; tu planifies et délègues avec l'outil `delegate`.

Méthode :
1. Si le code est inconnu, délègue d'abord à `explorer`.
2. Délègue l'implémentation à `implementer` avec un brief précis (rappelle-lui ce que l'explorer a trouvé :
   il n'a aucune mémoire des autres agents).
3. Fais valider par `reviewer`. S'il répond KO, renvoie les problèmes à `implementer`, puis re-review.
4. Arrête-toi quand le reviewer répond OK (max 2-3 itérations) et donne un compte rendu final concis.
"""


# ---------------------------------------------------------------- la boucle agent
def run_agent(name, system, tool_names, handlers, brief, depth=0, max_turns=MAX_TURNS):
    indent = "  " * depth
    tools = [SCHEMAS[t] for t in tool_names]
    messages = [{"role": "user", "content": brief}]
    print(f"{indent}▶ [{name}] démarre — brief : {brief[:120].replace(chr(10), ' ')}...")

    for _ in range(max_turns):
        resp = client.messages.create(
            model=MODEL, max_tokens=4096, system=system, tools=tools, messages=messages
        )
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            text = "".join(b.text for b in resp.content if b.type == "text")
            print(f"{indent}■ [{name}] terminé ({resp.usage.input_tokens} in / {resp.usage.output_tokens} out last turn)")
            return text

        results = []
        for block in resp.content:
            if block.type != "tool_use":
                continue
            print(f"{indent}  ⚙ {name} → {block.name}({str(block.input)[:80]})")
            try:
                out = handlers[block.name](block.input)
                is_error = False
            except Exception as e:  # on renvoie l'erreur au modèle : il peut se corriger
                out, is_error = f"Erreur : {e}", True
            results.append(
                {"type": "tool_result", "tool_use_id": block.id, "content": out, "is_error": is_error}
            )
        messages.append({"role": "user", "content": results})

    return f"[{name}] arrêté : max_turns ({max_turns}) atteint."


def run_orchestrator(task):
    delegations = 0

    def delegate(inp):
        nonlocal delegations
        delegations += 1
        if delegations > MAX_DELEGATIONS:
            return "Limite de délégations atteinte : conclus maintenant."
        cfg = AGENTS[inp["agent"]]
        return run_agent(
            inp["agent"], cfg["system"], cfg["tools"], HANDLERS, inp["brief"], depth=1
        )

    return run_agent(
        "orchestrator", ORCHESTRATOR_SYSTEM, ["delegate"], {"delegate": delegate}, task,
        depth=0, max_turns=25,
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit('Usage : python multi_agent.py "<tâche>"')
    print(f"Repo : {ROOT}\nModèle : {MODEL}\n")
    print("\n=== RÉSULTAT FINAL ===\n" + run_orchestrator(sys.argv[1]))
