# conexion a postgresSQL
import os
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row
from functools import wraps
from flask import session, jsonify

load_dotenv()

def login_requerido(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Debes iniciar sesión"}), 401
        return f(*args, **kwargs)
    return decorador

def obtener_conexion():
    """
    Crea y retorna una nueva conexión a PostgreSQL.
    row_factory=dict_row hace que los resultados vengan como diccionarios
    (ej: fila["name"]) en vez de tuplas (fila[0]) — más legible.
    """
    conn = psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        row_factory=dict_row
    )
    # NO establecer zona horaria para evitar problemas con columnas DATE/TIME
    # Las columnas TIMESTAMPTZ (created_at, updated_at) se manejan correctamente sin esto
    return conn


def probar_conexion():
    """Función simple para verificar que todo esté bien conectado."""
    try:
        with obtener_conexion() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                resultado = cur.fetchone()
                print("✅ Conexión exitosa a PostgreSQL")
                print(resultado["version"])
    except Exception as e:
        print("❌ Error de conexión:", e)


if __name__ == "__main__":
    probar_conexion()