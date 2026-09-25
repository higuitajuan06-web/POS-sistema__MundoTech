"""
Desktop Launcher para POS Mundo Tech.
Este archivo inicia el servidor Flask en un hilo y abre una ventana nativa con pywebview.
"""

import sys
import os
import threading
import time
import webview
from flask import Flask

# Configurar el directorio base para encontrar archivos
if getattr(sys, 'frozen', False):
    # Ejecutando desde PyInstaller
    BASE_DIR = sys._MEIPASS
    WORKING_DIR = os.path.dirname(sys.executable)
else:
    # Ejecutando desde desarrollo
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    WORKING_DIR = BASE_DIR

sys.path.insert(0, BASE_DIR)
os.chdir(WORKING_DIR)

# Importar módulos del backend
from backend.licencia import verificar_licencia
from backend.app import app

# Configurar el directorio base para encontrar archivos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)


def run_flask_server():
    """Ejecuta el servidor Flask en el hilo actual."""
    # Cambiar al directorio base para asegurar que Flask encuentre los archivos
    os.chdir(BASE_DIR)
    
    # Ejecutar Flask sin debug para evitar conflicto con pywebview
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)


def verificar_licencia_valida():
    """Verifica si la licencia es válida antes de iniciar el sistema."""
    es_valida, mensaje, dias_restantes = verificar_licencia()
    
    if not es_valida:
        print(f"[ERROR] Licencia invalida: {mensaje}")
        return False, mensaje
    
    print(f"[OK] Licencia valida. Dias restantes: {dias_restantes}")
    return True, mensaje


def main():
    """Función principal que inicia el sistema."""
    print("[INFO] Iniciando Mundo Tech POS...")
    
    # Paso 1: Verificar licencia ANTES de iniciar el servidor Flask
    es_valida, mensaje = verificar_licencia_valida()
    
    # Paso 2: Iniciar servidor Flask en un hilo separado (daemon para que termine al cerrar)
    # Iniciamos el servidor de todos modos porque necesitamos servir las páginas HTML
    # El propio Flask ya tiene la lógica de bloqueo implementada en before_request
    flask_thread = threading.Thread(target=run_flask_server, daemon=True)
    flask_thread.start()
    
    # Esperar a que el servidor Flask esté listo
    print("[INFO] Esperando que el servidor Flask inicie...")
    time.sleep(3)  # Dar tiempo al servidor para iniciar completamente
    
    # Paso 3: Determinar la URL inicial según el estado de la licencia
    if es_valida:
        initial_url = "http://127.0.0.1:5000/login.html"
    else:
        initial_url = "http://127.0.0.1:5000/licencia-invalida.html"
    
    print(f"[INFO] Abriendo ventana en: {initial_url}")
    
    # Paso 4: Crear y mostrar la ventana pywebview
    window = webview.create_window(
        title='Mundo Tech POS',
        url=initial_url,
        width=1200,
        height=800,
        resizable=True,
        min_size=(800, 600)
    )
    
    # Configurar para cerrar limpiamente
    try:
        webview.start(debug=False, http_server=False)
    except KeyboardInterrupt:
        pass
    finally:
        print("[INFO] Cerrando Mundo Tech POS...")
        # El hilo daemon de Flask terminará automáticamente cuando termine el proceso principal


if __name__ == "__main__":
    main()