import bcrypt
from flask import Blueprint, jsonify, request, session
from ..db.conexion import obtener_conexion
from ..licencia import verificar_licencia

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    datos = request.get_json()
    username = (datos.get("username") or "").strip()
    password = datos.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Usuario y contraseña son obligatorios"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, u.password_hash, r.name AS role
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.username = %s AND u.is_active = TRUE;
            """, (username,))
            usuario = cur.fetchone()

    # Mensaje idéntico si el usuario no existe O la contraseña es incorrecta
    # (nunca revelar cuál de las dos falló — evita que alguien "adivine" usuarios válidos)
    if not usuario or not bcrypt.checkpw(password.encode("utf-8"), usuario["password_hash"].encode("utf-8")):
        return jsonify({"error": "Usuario o contraseña incorrectos"}), 401

    # Guarda la sesión (Flask la firma con una clave secreta, no se puede falsificar)
    session["user_id"] = str(usuario["id"])
    session["username"] = usuario["username"]
    session["role"] = usuario["role"]
    session.permanent = True

    # Verificar licencia para mostrar aviso de vencimiento próximo
    es_valida, mensaje, dias_restantes = verificar_licencia()
    aviso_licencia = None
    if es_valida and dias_restantes is not None and dias_restantes <= 7:
        aviso_licencia = f"Tu licencia vence en {dias_restantes} día{'s' if dias_restantes != 1 else ''}"

    return jsonify({
        "id": usuario["id"],
        "username": usuario["username"],
        "role": usuario["role"],
        "aviso_licencia": aviso_licencia
    })


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Sesión cerrada"})


@auth_bp.route("/api/auth/me", methods=["GET"])
def usuario_actual():
    """Le permite al frontend saber si hay sesión activa (para no mostrar el POS sin login)."""
    if "user_id" not in session:
        return jsonify({"error": "No hay sesión activa"}), 401

    return jsonify({
        "id": session["user_id"],
        "username": session["username"],
        "role": session["role"]
    })