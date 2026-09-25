from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from .rutas.categories import categories_bp
from .rutas.servicios import servicios_bp
from .rutas.clientes import clientes_bp
from .rutas.ventas import ventas_bp
from .rutas.pagos import pagos_bp
from .rutas.auth import auth_bp
from .rutas.citas import citas_bp
from .rutas.gastos import gastos_bp
from .rutas.galeria import galeria_bp
from .rutas.sistema import sistema_bp
from .licencia import verificar_licencia, obtener_info_licencia
from datetime import timedelta
import os

app = Flask(__name__, static_folder="../frontend", static_url_path="")
app.secret_key = os.getenv("SECRET_KEY", "clave-temporal-cambiar-en-produccion")
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
CORS(app, supports_credentials=True)  # ya no hace falta restringir origins

app.register_blueprint(categories_bp)
app.register_blueprint(servicios_bp)
app.register_blueprint(clientes_bp)
app.register_blueprint(ventas_bp)
app.register_blueprint(pagos_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(citas_bp)
app.register_blueprint(gastos_bp)
app.register_blueprint(galeria_bp)
app.register_blueprint(sistema_bp)


@app.before_request
def bloquear_sistema_sin_licencia():
    """Impide usar APIs o páginas directas cuando la licencia no es válida."""
    if request.endpoint in {"licencia_info", "home", "sistema.obtener_version"}:
        return None
    if request.endpoint == "static":
        # Los recursos visuales deben poder cargar la pantalla de bloqueo,
        # pero no se deben poder abrir páginas del POS directamente.
        if request.path == "/licencia-invalida.html" or not request.path.endswith(".html"):
            return None

    if request.endpoint is None:
        return None

    es_valida, _, _ = verificar_licencia()
    if es_valida:
        return None

    if request.path.startswith("/api/"):
        return jsonify({
            "error": "Licencia vencida o inválida. Contacta a Mundo Tech para renovar."
        }), 403

    return send_from_directory(app.static_folder, "licencia-invalida.html")


@app.route("/")
def home():
    # Verificar licencia antes de mostrar la página de login
    es_valida, mensaje, dias_restantes = verificar_licencia()
    if not es_valida:
        return send_from_directory(app.static_folder, "licencia-invalida.html")
    return send_from_directory(app.static_folder, "login.html")


@app.route("/api/licencia/info")
def licencia_info():
    """Endpoint para obtener información de la licencia actual."""
    info = obtener_info_licencia()
    return jsonify(info)


if __name__ == "__main__":
    app.run(debug=True, port=5000)