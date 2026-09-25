from flask import Blueprint, jsonify, request, session
from ..db.conexion import obtener_conexion, login_requerido

galeria_bp = Blueprint("galeria", __name__)


def _rol_admin():
    if session.get("role") != "ADMIN":
        return jsonify({"error": "Solo el administrador puede gestionar la galería"}), 403
    return None


def _datos_item(row):
    return dict(row)


@galeria_bp.route("/api/gallery", methods=["GET"])
def listar_galeria():
    category_id = request.args.get("category_id")
    query = """
        SELECT g.id, g.titulo, g.descripcion, g.image_url, g.category_id,
               g.product_id, c.name AS category_name,
               p.name AS product_name, p.sale_price
        FROM gallery_items g
        LEFT JOIN categories c ON c.id = g.category_id
        LEFT JOIN products p ON p.id = g.product_id AND p.status = 'ACTIVE'
        WHERE g.activo = TRUE
    """
    params = []
    if category_id:
        query += " AND g.category_id = %s"
        params.append(category_id)
    query += " ORDER BY g.created_at DESC"

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            items = cur.fetchall()
    return jsonify([_datos_item(item) for item in items])


@galeria_bp.route("/api/gallery", methods=["POST"])
@login_requerido
def crear_item():
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    datos = request.get_json() or {}
    titulo = (datos.get("titulo") or "").strip()
    image_url = (datos.get("image_url") or "").strip()
    if not titulo or not image_url:
        return jsonify({"error": "Título e imagen son obligatorios"}), 400
    if len(titulo) > 150:
        return jsonify({"error": "El título no puede superar 150 caracteres"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO gallery_items
                    (titulo, descripcion, image_url, category_id, product_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, titulo, descripcion, image_url, category_id, product_id,
                          activo, created_at;
            """, (titulo, datos.get("descripcion"), image_url,
                  datos.get("category_id") or None, datos.get("product_id") or None))
            item = cur.fetchone()
            conn.commit()
    return jsonify(_datos_item(item)), 201


@galeria_bp.route("/api/gallery/<uuid:item_id>", methods=["PUT"])
@login_requerido
def editar_item(item_id):
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    datos = request.get_json() or {}
    titulo = (datos.get("titulo") or "").strip()
    image_url = (datos.get("image_url") or "").strip()
    if not titulo or not image_url:
        return jsonify({"error": "Título e imagen son obligatorios"}), 400
    if len(titulo) > 150:
        return jsonify({"error": "El título no puede superar 150 caracteres"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE gallery_items
                SET titulo = %s, descripcion = %s, image_url = %s,
                    category_id = %s, product_id = %s
                WHERE id = %s AND activo = TRUE
                RETURNING id, titulo, descripcion, image_url, category_id, product_id,
                          activo, created_at;
            """, (titulo, datos.get("descripcion"), image_url,
                  datos.get("category_id") or None, datos.get("product_id") or None,
                  str(item_id)))
            item = cur.fetchone()
            conn.commit()
    if not item:
        return jsonify({"error": "Diseño no encontrado"}), 404
    return jsonify(_datos_item(item))


@galeria_bp.route("/api/gallery/<uuid:item_id>", methods=["DELETE"])
@login_requerido
def eliminar_item(item_id):
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE gallery_items SET activo = FALSE
                WHERE id = %s AND activo = TRUE
                RETURNING id;
            """, (str(item_id),))
            item = cur.fetchone()
            conn.commit()
    if not item:
        return jsonify({"error": "Diseño no encontrado"}), 404
    return jsonify({"message": "Diseño eliminado"})
