from flask import Blueprint, jsonify, render_template_string


api_bp = Blueprint("api", __name__)


@api_bp.get("/api/data")
def get_sample_data():
    return jsonify(
        {
            "data": [
                {"id": 1, "name": "Sample Item 1", "value": 100},
                {"id": 2, "name": "Sample Item 2", "value": 200},
                {"id": 3, "name": "Sample Item 3", "value": 300},
            ],
            "total": 3,
            "timestamp": "2024-01-01T00:00:00Z",
        }
    )


@api_bp.get("/api/items/<int:item_id>")
def get_item(item_id: int):
    return jsonify(
        {
            "item": {
                "id": item_id,
                "name": f"Sample Item {item_id}",
                "value": item_id * 100,
            },
            "timestamp": "2024-01-01T00:00:00Z",
        }
    )


# HTMX Endpoints
@api_bp.get("/api/demo")
def demo():
    """Endpoint HTMX pour afficher une démo interactive"""
    html = """
    <div class="space-y-4">
        <div class="bg-slate-700/50 rounded-lg p-4">
            <h3 class="text-lg font-semibold mb-3">Conteneur Interactif</h3>
            <button hx-post="/api/counter" hx-target="#counter-display" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition">
                Incrémenter le compteur
            </button>
            <div id="counter-display" class="mt-4 text-center text-2xl font-bold text-cyan-400">0</div>
        </div>
        
        <div class="bg-slate-700/50 rounded-lg p-4">
            <h3 class="text-lg font-semibold mb-3">Éléments Dynamiques</h3>
            <button hx-get="/api/items-list" hx-target="#items-list" class="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded transition">
                Charger les éléments
            </button>
            <div id="items-list" class="mt-4"></div>
        </div>
    </div>
    """
    return render_template_string(html)


@api_bp.post("/api/counter")
def counter():
    """Endpoint pour incrémenter le compteur"""
    import random
    count = random.randint(1, 100)
    return f"<div class='text-2xl font-bold text-cyan-400'>{count}</div>"


@api_bp.get("/api/items-list")
def items_list():
    """Endpoint HTMX pour afficher une liste d'éléments"""
    html = """
    <div class="space-y-2">
        <div class="bg-slate-600/50 p-3 rounded hover:bg-slate-600 transition cursor-pointer">
            <span class="font-semibold">Élément 1</span> - <span class="text-slate-300">Valeur: 100</span>
        </div>
        <div class="bg-slate-600/50 p-3 rounded hover:bg-slate-600 transition cursor-pointer">
            <span class="font-semibold">Élément 2</span> - <span class="text-slate-300">Valeur: 200</span>
        </div>
        <div class="bg-slate-600/50 p-3 rounded hover:bg-slate-600 transition cursor-pointer">
            <span class="font-semibold">Élément 3</span> - <span class="text-slate-300">Valeur: 300</span>
        </div>
    </div>
    """
    return render_template_string(html)


@api_bp.get("/api/greeting")
def greeting():
    """Endpoint HTMX pour afficher un message de salutation"""
    html = """
    <div class="bg-slate-700/50 border border-cyan-500/50 rounded-lg p-6 text-center">
        <p class="text-xl font-semibold text-cyan-400 mb-2">Bienvenue! 👋</p>
        <p class="text-slate-300">Vous avez réussi à utiliser HTMX pour charger du contenu dynamiquement!</p>
    </div>
    """
    return render_template_string(html)


@api_bp.get("/api/activity")
def activity():
    """Endpoint HTMX pour afficher l'activité récente"""
    html = """
    <div class="space-y-3">
        <div class="flex items-center gap-3 p-3 bg-slate-700/30 rounded hover:bg-slate-700/50 transition cursor-pointer">
            <div class="w-2 h-2 bg-green-400 rounded-full"></div>
            <span class="text-sm">Nouvel utilisateur inscrit</span>
            <span class="text-xs text-slate-400 ml-auto">il y a 5 min</span>
        </div>
        <div class="flex items-center gap-3 p-3 bg-slate-700/30 rounded hover:bg-slate-700/50 transition cursor-pointer">
            <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span class="text-sm">Requête API effectuée</span>
            <span class="text-xs text-slate-400 ml-auto">il y a 12 min</span>
        </div>
        <div class="flex items-center gap-3 p-3 bg-slate-700/30 rounded hover:bg-slate-700/50 transition cursor-pointer">
            <div class="w-2 h-2 bg-cyan-400 rounded-full"></div>
            <span class="text-sm">Mise à jour du système</span>
            <span class="text-xs text-slate-400 ml-auto">il y a 1 heure</span>
        </div>
    </div>
    """
    return render_template_string(html)
