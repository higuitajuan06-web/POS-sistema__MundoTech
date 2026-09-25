#!/usr/bin/env python3
"""
Script generador de licencias para POS Mundo Tech.
Este script es de uso exclusivo del desarrollador (TUYA) y NO se distribuye a los clientes.
"""

import hmac
import hashlib
import json
from datetime import datetime, timedelta
import os

# CLAVE SECRETA: SOLO vive en este script (en tu PC de desarrollo)
# NUNCA se distribuye a los clientes
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


def main():
    import sys

    # Soporte para argumentos de línea de comandos (para pruebas automatizadas)
    if len(sys.argv) >= 3:
        cliente = sys.argv[1]
        opcion = sys.argv[2]
    else:
        print("=" * 60)
        print("GENERADOR DE LICENCIAS - MUNDO TECH POS")
        print("=" * 60)
        print()

        # Pedir nombre del cliente
        cliente = input("Nombre del cliente: ").strip()
        if not cliente:
            print("ERROR: El nombre del cliente es obligatorio")
            return

        # Pedir fecha de expiración
        print("\nOpciones de expiración:")
        print("1. 1 año desde hoy")
        print("2. 6 meses desde hoy")
        print("3. 30 días desde hoy")
        print("4. Fecha específica (formato YYYY-MM-DD)")
        print("5. Licencia ya vencida (para pruebas)")

        opcion = input("\nSelecciona una opción (1-5): ").strip()

    hoy = datetime.now()
    if opcion == "1":
        expira = hoy + timedelta(days=365)
    elif opcion == "2":
        expira = hoy + timedelta(days=180)
    elif opcion == "3":
        expira = hoy + timedelta(days=30)
    elif opcion == "4":
        if len(sys.argv) >= 4:
            fecha_str = sys.argv[3]
        else:
            fecha_str = input("Ingresa la fecha (YYYY-MM-DD): ").strip()
        try:
            expira = datetime.strptime(fecha_str, "%Y-%m-%d")
        except ValueError:
            print("ERROR: Formato de fecha invalido. Usa YYYY-MM-DD")
            return
    elif opcion == "5":
        # Licencia vencida para pruebas
        expira = hoy - timedelta(days=30)
    else:
        print("ERROR: Opcion invalida")
        return

    expira_str = expira.strftime("%Y-%m-%d")

    # Generar firma
    firma = generar_firma(cliente, expira_str)

    # Crear diccionario de licencia
    licencia = {
        "cliente": cliente,
        "expira": expira_str,
        "firma": firma
    }

    # Guardar en license.json en la raíz del proyecto
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    license_path = os.path.join(project_root, "license.json")

    with open(license_path, "w", encoding="utf-8") as f:
        json.dump(licencia, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 60)
    print("LICENCIA GENERADA EXITOSAMENTE")
    print("=" * 60)
    print(f"Cliente: {cliente}")
    print(f"Expira: {expira_str}")
    print(f"Firma: {firma}")
    print(f"Archivo: {license_path}")
    print()
    print("IMPORTANTE: Este archivo debe colocarse en la raíz del proyecto")
    print("   del cliente, junto al archivo .env")
    print("=" * 60)


if __name__ == "__main__":
    main()
