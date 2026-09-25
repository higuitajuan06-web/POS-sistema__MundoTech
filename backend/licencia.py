"""
Módulo de verificación de licencias para POS Mundo Tech.
Este módulo se distribuye con el sistema del cliente para verificar licencias.
"""

import sys
import hmac
import hashlib
import json
import os
from datetime import date
from typing import Tuple, Optional

# CLAVE SECRETA: Este archivo SÍ debe tener la clave secreta
# porque el sistema del cliente necesita poder verificar licencias
LICENSE_SECRET_KEY = "cambia-esto-por-una-clave-larga-tuya-mundo-tech-pos-2024-super-secreta"


def generar_firma(cliente: str, expira: str) -> str:
    """
    Genera la firma HMAC-SHA256 usando la clave secreta.
    """
    mensaje = f"{cliente}|{expira}"
    firma = hmac.new(
        LICENSE_SECRET_KEY.encode("utf-8"),
        mensaje.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return firma


def verificar_firma(cliente: str, expira: str, firma: str) -> bool:
    """
    Verifica si la firma es válida para el cliente y fecha dados.
    """
    firma_calculada = generar_firma(cliente, expira)
    return hmac.compare_digest(firma_calculada, firma)


def leer_licencia() -> Optional[dict]:
    """
    Lee el archivo license.json de la raíz del proyecto.
    Retorna None si el archivo no existe o hay error.
    """
    # Si está empaquetado con PyInstaller, buscar en el directorio del ejecutable
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    license_path = os.path.join(base_dir, "license.json")

    if not os.path.exists(license_path):
        return None

    try:
        with open(license_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def es_modo_desarrollo() -> bool:
    """
    Verifica si el sistema está en modo de desarrollo.
    El modo de desarrollo se activa con la variable de entorno MODO=DESARROLLO
    """
    return os.getenv("MODO", "").upper() == "DESARROLLO"


def verificar_licencia() -> Tuple[bool, str, Optional[int]]:
    """
    Verifica la licencia del sistema.

    Retorna:
        (es_valida, mensaje, dias_restantes)
        - es_valida: True si la licencia es válida y vigente
        - mensaje: Mensaje descriptivo del estado
        - dias_restantes: Días restantes hasta la expiración (None si no aplica)
    """
    # Si está en modo desarrollo, siempre es válida (para el desarrollador)
    if es_modo_desarrollo():
        return True, "Modo desarrollo - Sin restricciones", None
    
    licencia = leer_licencia()

    if licencia is None:
        return False, "No se encontró el archivo license.json", None

    # Verificar que tenga los campos necesarios
    if not isinstance(licencia, dict) or not all(
        key in licencia for key in ["cliente", "expira", "firma"]
    ):
        return False, "El archivo license.json no tiene el formato correcto", None

    cliente = licencia["cliente"]
    expira_str = licencia["expira"]
    firma = licencia["firma"]

    if not all(isinstance(valor, str) for valor in (cliente, expira_str, firma)):
        return False, "El archivo license.json no tiene el formato correcto", None

    # Verificar firma
    if not verificar_firma(cliente, expira_str, firma):
        return False, "La firma de la licencia es inválida. El archivo fue modificado.", None

    # Verificar fecha de expiración
    try:
        expira = date.fromisoformat(expira_str)
    except ValueError:
        return False, "La fecha de expiración tiene un formato inválido", None

    hoy = date.today()

    if expira < hoy:
        dias_vencidos = (hoy - expira).days
        return False, f"Licencia vencida hace {dias_vencidos} días", None

    # Calcular días restantes
    dias_restantes = (expira - hoy).days

    return True, "Licencia válida", dias_restantes


def obtener_info_licencia() -> dict:
    """
    Retorna información sobre la licencia actual.
    """
    licencia = leer_licencia()
    if licencia is None:
        return {
            "existe": False,
            "cliente": None,
            "expira": None,
            "dias_restantes": None,
            "valida": False
        }

    es_valida, mensaje, dias_restantes = verificar_licencia()

    return {
        "existe": True,
        "cliente": licencia.get("cliente"),
        "expira": licencia.get("expira"),
        "dias_restantes": dias_restantes,
        "valida": es_valida,
        "mensaje": mensaje
    }
