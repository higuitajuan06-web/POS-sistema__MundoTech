from flask import Blueprint, jsonify, request
from ..db.conexion import obtener_conexion, login_requerido

clientes_bp = Blueprint("clientes", __name__)


@clientes_bp.route("/api/customers", methods=["GET"])
def listar_clientes():
    """Devuelve todos los clientes. Soporta búsqueda opcional por nombre (?q=)."""
    busqueda = request.args.get("q", "").strip()

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            if busqueda:
                cur.execute("""
                    SELECT id, name, phone, email FROM customers
                    WHERE name ILIKE %s
                    ORDER BY name;
                """, (f"%{busqueda}%",))
            else:
                cur.execute("SELECT id, name, phone, email FROM customers ORDER BY name;")
            clientes = cur.fetchall()
    return jsonify(clientes)


@clientes_bp.route("/api/customers", methods=["POST"])
@login_requerido
def crear_cliente():
    """Crea un nuevo cliente."""
    datos = request.get_json()
    nombre = (datos.get("name") or "").strip()

    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO customers (name, phone, email)
                VALUES (%s, %s, %s)
                RETURNING id, name, phone, email;
            """, (nombre, datos.get("phone"), datos.get("email")))
            nuevo_cliente = cur.fetchone()
            conn.commit()

    return jsonify(nuevo_cliente), 201


@clientes_bp.route("/api/customers/<uuid:customer_id>", methods=["PUT"])
@login_requerido
def editar_cliente(customer_id):
    """Edita un cliente existente."""
    datos = request.get_json()
    nombre = (datos.get("name") or "").strip()

    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE customers
                SET name = %s, phone = %s, email = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id, name, phone, email;
            """, (nombre, datos.get("phone"), datos.get("email"), str(customer_id)))
            cliente = cur.fetchone()
            conn.commit()

    if not cliente:
        return jsonify({"error": "Cliente no encontrado"}), 404
    return jsonify(cliente)


@clientes_bp.route("/api/customers/<uuid:customer_id>", methods=["DELETE"])
@login_requerido
def eliminar_cliente(customer_id):
    """Elimina un cliente físicamente (a diferencia de products/sales, aquí sí aplica
    porque un cliente sin ventas asociadas no tiene historial que proteger)."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM sales WHERE customer_id = %s;", (str(customer_id),))
            tiene_ventas = cur.fetchone()["total"] > 0

            if tiene_ventas:
                return jsonify({"error": "No se puede eliminar: el cliente tiene ventas registradas"}), 409

            cur.execute("DELETE FROM customers WHERE id = %s RETURNING id;", (str(customer_id),))
            resultado = cur.fetchone()
            conn.commit()

    if not resultado:
        return jsonify({"error": "Cliente no encontrado"}), 404
    return jsonify({"message": "Cliente eliminado"}), 200