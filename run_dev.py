"""
Script para ejecutar el servidor en modo desarrollo.
Carga las variables de entorno de .env.development y ejecuta el servidor.
"""
import os
import sys
from pathlib import Path

# Cargar variables de entorno del archivo de desarrollo
env_file = Path(__file__).parent / ".env.development"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()
    print("[OK] Variables de entorno cargadas desde .env.development")
    print(f"[OK] MODO={os.getenv('MODO', 'no definido')}")
else:
    print("[WARNING] No se encontró .env.development, usando variables de entorno del sistema")

# Ejecutar el servidor Flask
if __name__ == "__main__":
    os.environ["PYTHONPATH"] = str(Path(__file__).parent)
    import backend.app
    backend.app.app.run(debug=True, port=5000)