from flask import Blueprint, jsonify
from ..db.conexion import obtener_conexion

pagos_bp = Blueprint("pagos", __name__)


@pagos_bp.route("/api/payment_methods", methods=["GET"])
def listar_metodos_pago():
    """Devuelve los métodos de pago disponibles (CASH, CARD, TRANSFER)."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM payment_methods ORDER BY name;")
            metodos = cur.fetchall()
    return jsonify(metodos)