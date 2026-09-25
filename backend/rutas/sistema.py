from flask import Blueprint, jsonify, request
from ..version import obtener_info_version
import requests

sistema_bp = Blueprint("sistema", __name__)

# URL del repositorio GitHub donde estará el archivo version.json
GITHUB_VERSION_URL = "https://raw.githubusercontent.com/higuitajuan06-web/POS-sistema__MundoTech/main/version.json"

@sistema_bp.route("/api/sistema/version", methods=["GET"])
def obtener_version():
    """
    Endpoint para obtener la versión actual del sistema y el changelog reciente.
    No requiere autenticación para facilitar la verificación de versiones.
    """
    info = obtener_info_version()
    return jsonify(info)

@sistema_bp.route("/api/sistema/verificar-actualizacion", methods=["GET"])
def verificar_actualizacion():
    """
    Endpoint para verificar si hay una nueva versión disponible en GitHub.
    Compara la versión local con la versión del repositorio.
    """
    try:
        # Obtener versión local
        info_local = obtener_info_version()
        version_local = info_local.get("version", "0.0.0")
        
        # Intentar obtener versión remota desde GitHub
        try:
            response = requests.get(GITHUB_VERSION_URL, timeout=5)
            if response.status_code == 200:
                version_remota = response.json()
                version_remota_str = version_remota.get("version", "0.0.0")
                notas_release = version_remota.get("notas", "")
                
                # Comparar versiones (simple string comparison para versiones semánticas)
                if version_remota_str > version_local:
                    return jsonify({
                        "hay_actualizacion": True,
                        "version_local": version_local,
                        "version_remota": version_remota_str,
                        "notas": notas_release,
                        "mensaje": f"Hay una actualización disponible: {version_remota_str}"
                    })
                else:
                    return jsonify({
                        "hay_actualizacion": False,
                        "version_local": version_local,
                        "version_remota": version_remota_str,
                        "mensaje": "Estás usando la versión más reciente"
                    })
            else:
                return jsonify({
                    "hay_actualizacion": False,
                    "error": "No se pudo conectar con GitHub",
                    "mensaje": "No se pudo verificar actualizaciones"
                }), 503
        except Exception as e:
            return jsonify({
                "hay_actualizacion": False,
                "error": str(e),
                "mensaje": "Error al verificar actualizaciones"
            }), 503
            
    except Exception as e:
        return jsonify({
            "hay_actualizacion": False,
            "error": str(e),
            "mensaje": "Error al verificar versión local"
        }), 500