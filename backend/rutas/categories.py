from flask import Blueprint, jsonify, request
from ..db.conexion import obtener_conexion, login_requerido

categories_bp = Blueprint("categories", __name__)


@categories_bp.route("/api/categories", methods=["GET"])
def listar_categorias():
    """Devuelve todas las categorías."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, description FROM categories ORDER BY name;")
            categorias = cur.fetchall()
    return jsonify(categorias)


@categories_bp.route("/api/categories", methods=["POST"])
@login_requerido
def crear_categoria():
    """Crea una nueva categoría."""
    datos = request.get_json()
    nombre = datos.get("name")
    descripcion = datos.get("description", "")

    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO categories (name, description) VALUES (%s, %s) RETURNING id, name, description;",
                (nombre, descripcion)
            )
            nueva_categoria = cur.fetchone()
            conn.commit()

    return jsonify(nueva_categoria), 201


@categories_bp.route("/api/categories/<uuid:category_id>", methods=["PUT"])
@login_requerido
def editar_categoria(category_id):
    """Edita una categoría existente."""
    datos = request.get_json()
    nombre = datos.get("name")
    descripcion = datos.get("description", "")

    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE categories SET name = %s, description = %s, updated_at = NOW() WHERE id = %s RETURNING id, name, description;",
                (nombre, descripcion, str(category_id))
            )
            categoria = cur.fetchone()
            conn.commit()

    if not categoria:
        return jsonify({"error": "Categoría no encontrada"}), 404
    return jsonify(categoria)


@categories_bp.route("/api/categories/<uuid:category_id>", methods=["DELETE"])
@login_requerido
def eliminar_categoria(category_id):
    """Elimina una categoría verificando primero si hay productos asociados."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM products WHERE category_id = %s AND status = 'ACTIVE';", (str(category_id),))
            resultado_count = cur.fetchone()
            num_productos = resultado_count["total"]

            if num_productos > 0:
                return jsonify({"error": f"No se puede eliminar: hay {num_productos} productos en esta categoría"}), 409

            cur.execute("DELETE FROM categories WHERE id = %s RETURNING id;", (str(category_id),))
            resultado = cur.fetchone()
            conn.commit()

    if not resultado:
        return jsonify({"error": "Categoría no encontrada"}), 404
    return jsonify({"message": "Categoría eliminada"}), 200