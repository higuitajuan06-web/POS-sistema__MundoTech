# Sistema de control de versiones - Mundo Tech POS
# Este archivo contiene la versión actual del sistema
# Actualiza este número manualmente cada vez que compiles una nueva versión

VERSION = "1.0.0"

import os

def obtener_changelog_reciente(lineas=10):
    """
    Lee las primeras líneas del CHANGELOG.md para mostrar el historial reciente.
    Devuelve un string con el contenido o un mensaje por defecto si no existe.
    """
    try:
        # Ruta al CHANGELOG.md (está en la raíz del proyecto)
        ruta_changelog = os.path.join(os.path.dirname(os.path.dirname(__file__)), "CHANGELOG.md")
        
        if not os.path.exists(ruta_changelog):
            return "No hay changelog disponible."
        
        with open(ruta_changelog, "r", encoding="utf-8") as f:
            contenido = f.read()
            # Dividir por líneas y tomar las primeras N
            lineas_contenido = contenido.split("\n")[:lineas]
            return "\n".join(lineas_contenido)
    except Exception as e:
        return f"Error al leer changelog: {str(e)}"

def obtener_info_version():
    """
    Devuelve información completa de la versión actual.
    """
    return {
        "version": VERSION,
        "changelog_reciente": obtener_changelog_reciente()
    }