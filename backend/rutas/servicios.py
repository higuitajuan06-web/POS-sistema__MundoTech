# enpoints /api/servicios
# funciones CRUD de servicios
from flask import Blueprint, jsonify, request
from ..db.conexion import obtener_conexion, login_requerido
import os
import uuid
from werkzeug.utils import secure_filename

servicios_bp = Blueprint("servicios", __name__)


@servicios_bp.route("/api/products", methods=["GET"])
def listar_productos():
    """Devuelve todos los productos activos, con el nombre de su categoría."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.name, p.sku, p.barcode, p.sale_price,
                       p.stock, p.min_stock, p.status, p.category_id, c.name AS category_name,
                       p.image_url, p.commission_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.status = 'ACTIVE'
                ORDER BY p.name;
            """)
            productos = cur.fetchall()
    for producto in productos:
        producto["commission_percentage"] = float(producto["commission_percentage"] or 0)
    return jsonify(productos)


@servicios_bp.route("/api/products", methods=["POST"])
@login_requerido
def crear_producto():
    """Crea un nuevo producto."""
    datos = request.get_json()
    nombre = datos.get("name")
    precio = datos.get("sale_price")
    porcentaje_comision = datos.get("commission_percentage", 0)

    if not nombre or precio is None:
        return jsonify({"error": "Nombre y precio son obligatorios"}), 400

    try:
        porcentaje_comision = float(porcentaje_comision)
    except (ValueError, TypeError):
        return jsonify({"error": "commission_percentage debe ser un número entre 0 y 100"}), 400

    if not 0 <= porcentaje_comision <= 100:
        return jsonify({"error": "commission_percentage debe estar entre 0 y 100"}), 400

    try:
        with obtener_conexion() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products
                        (name, sku, barcode, category_id, cost_price, sale_price, stock, min_stock, image_url, commission_percentage)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, name, sale_price, stock, image_url, commission_percentage;
                """, (
                    nombre,
                    datos.get("sku"),
                    datos.get("barcode"),
                    datos.get("category_id"),
                    datos.get("cost_price", 0),
                    precio,
                    datos.get("stock", 0),
                    datos.get("min_stock", 0),
                    datos.get("image_url"),
                    porcentaje_comision
                ))
                nuevo_producto = cur.fetchone()
                conn.commit()

        nuevo_producto["commission_percentage"] = float(nuevo_producto["commission_percentage"] or 0)
        return jsonify(nuevo_producto), 201
    except Exception as e:
        if "sku" in str(e).lower() and "unique" in str(e).lower():
            return jsonify({"error": "El SKU ya existe. Usa otro código."}), 400
        return jsonify({"error": str(e)}), 500


@servicios_bp.route("/api/products/<uuid:product_id>", methods=["PUT"])
@login_requerido
def editar_producto(product_id):
    """Edita un producto existente."""
    datos = request.get_json()
    porcentaje_comision = datos.get("commission_percentage", 0)

    try:
        porcentaje_comision = float(porcentaje_comision)
    except (ValueError, TypeError):
        return jsonify({"error": "commission_percentage debe ser un número entre 0 y 100"}), 400

    if not 0 <= porcentaje_comision <= 100:
        return jsonify({"error": "commission_percentage debe estar entre 0 y 100"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            # Construir query dinámicamente basado en si se proporciona image_url
            if "image_url" in datos:
                cur.execute("""
                    UPDATE products
                    SET name = %s, sku = %s, sale_price = %s, stock = %s, min_stock = %s, category_id = %s, image_url = %s, commission_percentage = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, name, sku, sale_price, stock, min_stock, category_id, image_url, commission_percentage;
                """, (
                    datos.get("name"),
                    datos.get("sku"),
                    datos.get("sale_price"),
                    datos.get("stock"),
                    datos.get("min_stock"),
                    datos.get("category_id"),
                    datos.get("image_url"),
                    porcentaje_comision,
                    str(product_id)
                ))
            else:
                cur.execute("""
                    UPDATE products
                    SET name = %s, sku = %s, sale_price = %s, stock = %s, min_stock = %s, category_id = %s, commission_percentage = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, name, sku, sale_price, stock, min_stock, category_id, image_url, commission_percentage;
                """, (
                    datos.get("name"),
                    datos.get("sku"),
                    datos.get("sale_price"),
                    datos.get("stock"),
                    datos.get("min_stock"),
                    datos.get("category_id"),
                    porcentaje_comision,
                    str(product_id)
                ))
            producto = cur.fetchone()
            conn.commit()

    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404
    producto["commission_percentage"] = float(producto["commission_percentage"] or 0)
    return jsonify(producto)


@servicios_bp.route("/api/products/<uuid:product_id>", methods=["DELETE"])
@login_requerido
def eliminar_producto(product_id):
    """Elimina un producto (borrado lógico: lo marca como INACTIVE, no lo borra físicamente)."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE products SET status = 'INACTIVE', updated_at = NOW()
                WHERE id = %s RETURNING id;
            """, (str(product_id),))
            resultado = cur.fetchone()
            conn.commit()

    if not resultado:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify({"message": "Producto eliminado"}), 200


@servicios_bp.route("/api/products/upload-image", methods=["POST"])
@login_requerido
def subir_imagen_producto():
    """Sube una imagen de producto y devuelve la URL."""
    if "imagen" not in request.files:
        return jsonify({"error": "No se envió ningún archivo"}), 400
    
    archivo = request.files["imagen"]
    if archivo.filename == "":
        return jsonify({"error": "No se seleccionó ningún archivo"}), 400
    
    # Validar que sea una imagen
    extensiones_permitidas = {".jpg", ".jpeg", ".png", ".webp"}
    nombre_archivo = secure_filename(archivo.filename)
    extension = os.path.splitext(nombre_archivo)[1].lower()
    
    if extension not in extensiones_permitidas:
        return jsonify({"error": "Solo se permiten imágenes (jpg, jpeg, png, webp)"}), 400
    
    # Crear directorio de uploads si no existe
    directorio_uploads = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "uploads", "productos")
    os.makedirs(directorio_uploads, exist_ok=True)
    
    # Generar nombre único con UUID
    nombre_unico = f"{uuid.uuid4()}{extension}"
    ruta_archivo = os.path.join(directorio_uploads, nombre_unico)
    
    # Guardar archivo
    archivo.save(ruta_archivo)
    
    # Devolver URL relativa
    image_url = f"/uploads/productos/{nombre_unico}"
    return jsonify({"image_url": image_url}), 200


@servicios_bp.route("/api/products/<uuid:product_id>/stock", methods=["PATCH"])
@login_requerido
def agregar_stock_producto(product_id):
    """Agrega stock a un producto (suma al stock existente, no lo reemplaza)."""
    datos = request.get_json()
    cantidad_agregar = datos.get("cantidad_agregar")

    if cantidad_agregar is None:
        return jsonify({"error": "cantidad_agregar es obligatorio"}), 400

    try:
        cantidad_agregar = int(cantidad_agregar)
    except (ValueError, TypeError):
        return jsonify({"error": "cantidad_agregar debe ser un entero"}), 400

    if cantidad_agregar <= 0:
        return jsonify({"error": "cantidad_agregar debe ser mayor a 0"}), 400

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Actualizar stock sumando la cantidad
            cur.execute("""
                UPDATE products 
                SET stock = stock + %s, updated_at = NOW()
                WHERE id = %s 
                RETURNING id, name, stock;
            """, (cantidad_agregar, str(product_id)))
            producto = cur.fetchone()

            if not producto:
                conn.rollback()
                return jsonify({"error": "Producto no encontrado"}), 404

            # Registrar movimiento de inventario
            cur.execute("""
                INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_id)
                VALUES (%s, %s, 'PURCHASE', %s);
            """, (str(product_id), cantidad_agregar, str(product_id)))

            conn.commit()

        return jsonify(producto), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@servicios_bp.route("/api/products/buscar-por-codigo/<codigo>", methods=["GET"])
def buscar_producto_por_codigo(codigo):
    """Busca un producto por SKU o barcode."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.name, p.sku, p.barcode, p.sale_price,
                       p.stock, p.min_stock, p.status, p.category_id, c.name AS category_name, p.image_url
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE (p.sku = %s OR p.barcode = %s) AND p.status = 'ACTIVE';
            """, (codigo, codigo))
            producto = cur.fetchone()

    if not producto:
        return jsonify({"error": "Producto no encontrado", "codigo": codigo}), 404

    return jsonify(producto), 200


@servicios_bp.route("/api/products/bodega", methods=["GET"])
@login_requerido
def obtener_bodega():
    """Devuelve todos los productos activos agrupados por categoría con resumen de stock."""
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            # Obtener todos los productos activos con su categoría
            cur.execute("""
                SELECT p.id, p.name, p.sku, p.barcode, p.sale_price,
                       p.stock, p.min_stock, p.status, p.category_id, c.name AS category_name, p.image_url
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.status = 'ACTIVE'
                ORDER BY c.name, p.name;
            """)
            productos = cur.fetchall()

    # Calcular el resumen
    total_productos = len(productos)
    productos_stock_bajo = sum(1 for p in productos if p["stock"] <= p["min_stock"])
    valor_total_inventario = sum(float(p["sale_price"]) * p["stock"] for p in productos)

    # Agrupar por categoría
    categorias_dict = {}
    for producto in productos:
        categoria_nombre = producto["category_name"] or "Sin categoría"
        if categoria_nombre not in categorias_dict:
            categorias_dict[categoria_nombre] = []
        
        # Agregar campo calculado stock_bajo
        producto_con_stock_bajo = dict(producto)
        producto_con_stock_bajo["stock_bajo"] = producto["stock"] <= producto["min_stock"]
        categorias_dict[categoria_nombre].append(producto_con_stock_bajo)

    # Convertir a lista de categorías
    categorias_lista = [
        {
            "categoria": cat_nombre,
            "productos": productos_cat
        }
        for cat_nombre, productos_cat in categorias_dict.items()
    ]

    return jsonify({
        "resumen": {
            "total_productos": total_productos,
            "productos_stock_bajo": productos_stock_bajo,
            "valor_total_inventario": valor_total_inventario
        },
        "categorias": categorias_lista
    })