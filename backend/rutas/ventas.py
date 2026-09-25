from flask import Blueprint, jsonify, request, session
from ..db.conexion import obtener_conexion, login_requerido
from datetime import datetime
import json

ventas_bp = Blueprint("ventas", __name__)


def _procesar_venta_transaccional(cur, customer_id, user_id, items, pagos, appointment_id=None):
    """
    Función interna compartida para procesar una venta transaccionalmente.
    Reutilizada por crear_venta() y convertir_cita_a_venta().
    """
    total_venta = 0
    items_procesados = []

    # --- 1. Verificar stock y calcular precios REALES de la base de datos ---
    for item in items:
        product_id = item.get("product_id")
        cantidad = item.get("quantity", 0)

        if cantidad <= 0:
            raise ValueError(f"Cantidad inválida para el producto {product_id}")

        cur.execute(
            "SELECT id, name, sale_price, stock, commission_percentage FROM products WHERE id = %s AND status = 'ACTIVE';",
            (product_id,)
        )
        producto = cur.fetchone()

        if not producto:
            raise ValueError(f"Producto {product_id} no existe o está inactivo")
        if producto["stock"] < cantidad:
            raise ValueError(f"Stock insuficiente para '{producto['name']}' (disponible: {producto['stock']})")

        subtotal = producto["sale_price"] * cantidad
        total_venta += subtotal
        items_procesados.append({
            "product_id": producto["id"],
            "product_name": producto["name"],
            "unit_price": producto["sale_price"],
            "commission_percentage": producto["commission_percentage"] or 0,
            "quantity": cantidad,
            "subtotal": subtotal
        })

    # --- 2. Verificar que los pagos cubran el total exacto ---
    total_pagado = sum(p.get("amount", 0) for p in pagos)
    if round(total_pagado, 2) != round(total_venta, 2):
        raise ValueError(f"Los pagos ({total_pagado}) no cubren el total de la venta ({total_venta})")

    # --- 3. Crear la venta (cabecera) ---
    if appointment_id:
        cur.execute("""
            INSERT INTO sales (customer_id, user_id, total, status, created_at, appointment_id)
            VALUES (%s, %s, %s, 'COMPLETED', NOW(), %s)
            RETURNING id;
        """, (customer_id, user_id, total_venta, appointment_id))
    else:
        cur.execute("""
            INSERT INTO sales (customer_id, user_id, total, status, created_at)
            VALUES (%s, %s, %s, 'COMPLETED', NOW())
            RETURNING id;
        """, (customer_id, user_id, total_venta))
    sale_id = cur.fetchone()["id"]

    # --- 4. Insertar items + descontar stock + registrar movimiento ---
    for item in items_procesados:
        cur.execute("""
            INSERT INTO sale_items
                (sale_id, product_id, product_name, unit_price, quantity, subtotal, commission_percentage)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """, (sale_id, item["product_id"], item["product_name"],
              item["unit_price"], item["quantity"], item["subtotal"],
              item["commission_percentage"]))

        cur.execute("""
            UPDATE products SET stock = stock - %s, updated_at = NOW()
            WHERE id = %s;
        """, (item["quantity"], item["product_id"]))

        cur.execute("""
            INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_id)
            VALUES (%s, %s, 'SALE', %s);
        """, (item["product_id"], -item["quantity"], sale_id))

    # --- 5. Insertar pagos ---
    for pago in pagos:
        cur.execute("""
            INSERT INTO sale_payments (sale_id, payment_method_id, amount)
            VALUES (%s, %s, %s);
        """, (sale_id, pago["payment_method_id"], pago["amount"]))

    return sale_id, total_venta, items_procesados

@ventas_bp.route("/api/sales", methods=["POST"])
@login_requerido
def crear_venta():
    """
    Registra una venta completa: items + pagos + descuento de inventario.
    TODO ocurre en UNA sola transacción: si algo falla, se revierte todo
    (no queda una venta 'a medias' ni stock descontado sin venta real).
    """
    datos = request.get_json()
    items = datos.get("items", [])          # [{product_id, quantity}, ...]
    pagos = datos.get("payments", [])        # [{payment_method_id, amount}, ...]
    customer_id = datos.get("customer_id")   # puede ser None
    user_id = datos.get("user_id")

    # --- Validaciones básicas antes de tocar la base de datos ---
    if not user_id:
        return jsonify({"error": "user_id es obligatorio"}), 400
    if not items:
        return jsonify({"error": "La venta debe tener al menos un producto"}), 400
    if not pagos:
        return jsonify({"error": "La venta debe tener al menos un método de pago"}), 400

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            sale_id, total_venta, items_procesados = _procesar_venta_transaccional(
                cur, customer_id, user_id, items, pagos
            )
            conn.commit()

        return jsonify({
            "id": sale_id,
            "total": total_venta,
            "items": items_procesados
        }), 201

    except ValueError as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Error interno al procesar la venta"}), 500
    finally:
        conn.close()


@ventas_bp.route("/api/sales", methods=["GET"])
def listar_ventas():
    """Historial de ventas, filtrable por fecha (?from=YYYY-MM-DD&to=YYYY-MM-DD) y por vendedor (?user_id=UUID)."""
    fecha_desde = request.args.get("from")
    fecha_hasta = request.args.get("to")
    user_id = request.args.get("user_id")

    query = """
        SELECT s.id, s.total, s.status, s.created_at,
               c.name AS customer_name, u.username AS seller, u.id AS seller_id
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        JOIN users u ON s.user_id = u.id
        WHERE s.status = 'COMPLETED'
    """
    params = []

    if fecha_desde:
        # Con TIMESTAMPTZ, convertir fecha local a timestamp y PostgreSQL maneja la conversión automáticamente
        query += " AND s.created_at >= %s::timestamp AT TIME ZONE 'America/Bogota'"
        params.append(fecha_desde + ' 00:00:00')
    if fecha_hasta:
        # Incluir todo el día hasta las 23:59:59.999
        query += " AND s.created_at <= %s::timestamp AT TIME ZONE 'America/Bogota' + interval '1 day' - interval '1 second'"
        params.append(fecha_hasta + ' 00:00:00')
    if user_id:
        query += " AND s.user_id = %s"
        params.append(user_id)

    query += " ORDER BY s.created_at DESC;"

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            ventas = cur.fetchall()
    return jsonify(ventas)


@ventas_bp.route("/api/sales/<sale_id>", methods=["GET"])
def obtener_detalle_venta(sale_id):
    """Obtiene el detalle completo de una venta con sus items."""
    query = """
        SELECT s.id, s.total, s.status, s.created_at,
               c.name AS customer_name, c.id AS customer_id,
               u.username AS seller, u.id AS seller_id
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        JOIN users u ON s.user_id = u.id
        WHERE s.id = %s;
    """

    items_query = """
        SELECT si.product_name, si.unit_price, si.quantity, si.subtotal
        FROM sale_items si
        WHERE si.sale_id = %s
        ORDER BY si.id;
    """

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (sale_id,))
            venta = cur.fetchone()
            
            if not venta:
                return jsonify({"error": "Venta no encontrada"}), 404
            
            cur.execute(items_query, (sale_id,))
            items = cur.fetchall()

    return jsonify({
        "venta": venta,
        "items": items
    })


@ventas_bp.route("/api/sales/cierre-caja", methods=["GET"])
@login_requerido
def cierre_caja():
    """
    Devuelve el resumen de ventas del usuario logueado desde su último cierre
    (o desde su primera venta si nunca ha cerrado) hasta ahora.
    Es una vista previa antes de confirmar el cierre.
    """
    user_id = session.get("user_id")
    username = session.get("username", "desconocido")
    
    if not user_id:
        return jsonify({"error": "No hay sesión activa"}), 401
    
    fecha_hora_actual = datetime.now()
    
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Obtener el último cierre de caja del usuario
            cur.execute("""
                SELECT closed_at, period_to
                FROM cash_closures
                WHERE user_id = %s
                ORDER BY closed_at DESC
                LIMIT 1;
            """, (user_id,))
            ultimo_cierre = cur.fetchone()
            
            # Determinar el período de cálculo
            if ultimo_cierre:
                # Desde el final del último cierre hasta ahora
                period_from = ultimo_cierre["period_to"]
            else:
                # Desde la primera venta del usuario hasta ahora
                cur.execute("""
                    SELECT MIN(created_at) as primera_venta
                    FROM sales
                    WHERE user_id = %s AND status = 'COMPLETED';
                """, (user_id,))
                primera_venta = cur.fetchone()
                if primera_venta and primera_venta["primera_venta"]:
                    period_from = primera_venta["primera_venta"]
                else:
                    # Si no hay ventas, no hay nada que cerrar
                    return jsonify({
                        "fecha": fecha_hora_actual.strftime("%Y-%m-%d %H:%M:%S"),
                        "vendedor": username,
                        "total_ventas": 0.0,
                        "cantidad_transacciones": 0,
                        "desglose_pagos": {"CASH": 0.0, "CARD": 0.0, "TRANSFER": 0.0},
                        "mensaje": "No hay ventas pendientes de cierre"
                    })
            
            period_to = fecha_hora_actual
            
            # Calcular total de ventas y cantidad de transacciones para el período
            query_total = """
                SELECT COUNT(s.id) as cantidad_transacciones, COALESCE(SUM(s.total), 0) as total_ventas
                FROM sales s
                WHERE s.user_id = %s
                  AND s.status = 'COMPLETED'
                  AND s.created_at >= %s
                  AND s.created_at <= %s;
            """
            cur.execute(query_total, (user_id, period_from, period_to))
            resultado_total = cur.fetchone()
            
            cantidad_transacciones = int(resultado_total["cantidad_transacciones"]) if resultado_total["cantidad_transacciones"] else 0
            total_ventas = float(resultado_total["total_ventas"]) if resultado_total["total_ventas"] else 0.0
            
            # Calcular desglose por método de pago
            query_desglose = """
                SELECT pm.name as metodo, COALESCE(SUM(sp.amount), 0) as total
                FROM sales s
                LEFT JOIN sale_payments sp ON s.id = sp.sale_id
                LEFT JOIN payment_methods pm ON sp.payment_method_id = pm.id
                WHERE s.user_id = %s
                  AND s.status = 'COMPLETED'
                  AND s.created_at >= %s
                  AND s.created_at <= %s
                GROUP BY pm.name
                ORDER BY pm.name;
            """
            cur.execute(query_desglose, (user_id, period_from, period_to))
            resultados_desglose = cur.fetchall()
            
            # Construir diccionario de desglose con los 3 métodos
            desglose_pagos = {
                "CASH": 0.0,
                "CARD": 0.0,
                "TRANSFER": 0.0
            }
            
            for fila in resultados_desglose:
                metodo = fila["metodo"]
                total = float(fila["total"]) if fila["total"] else 0.0
                if metodo in desglose_pagos:
                    desglose_pagos[metodo] = total
            
            return jsonify({
                "fecha": fecha_hora_actual.strftime("%Y-%m-%d %H:%M:%S"),
                "vendedor": username,
                "period_from": period_from.isoformat(),
                "period_to": period_to.isoformat(),
                "total_ventas": total_ventas,
                "cantidad_transacciones": cantidad_transacciones,
                "desglose_pagos": desglose_pagos
            })
            
    except Exception as e:
        return jsonify({"error": f"Error al obtener cierre de caja: {str(e)}"}), 500
    finally:
        conn.close()


@ventas_bp.route("/api/sales/cierre-caja", methods=["POST"])
@login_requerido
def confirmar_cierre_caja():
    """
    Confirma y guarda el cierre de caja en la base de datos.
    Calcula el período desde el último cierre del usuario (o desde su primera venta)
    hasta ahora, y guarda el snapshot en cash_closures.
    """
    user_id = session.get("user_id")
    username = session.get("username", "desconocido")
    
    if not user_id:
        return jsonify({"error": "No hay sesión activa"}), 401
    
    fecha_hora_actual = datetime.now()
    
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Obtener el último cierre de caja del usuario
            cur.execute("""
                SELECT closed_at, period_to
                FROM cash_closures
                WHERE user_id = %s
                ORDER BY closed_at DESC
                LIMIT 1;
            """, (user_id,))
            ultimo_cierre = cur.fetchone()
            
            # Determinar el período de cierre
            if ultimo_cierre:
                # Desde el final del último cierre hasta ahora
                period_from = ultimo_cierre["period_to"]
            else:
                # Desde la primera venta del usuario hasta ahora
                cur.execute("""
                    SELECT MIN(created_at) as primera_venta
                    FROM sales
                    WHERE user_id = %s AND status = 'COMPLETED';
                """, (user_id,))
                primera_venta = cur.fetchone()
                if primera_venta and primera_venta["primera_venta"]:
                    period_from = primera_venta["primera_venta"]
                else:
                    # Si no hay ventas, cerrar desde ahora mismo
                    period_from = fecha_hora_actual
            
            period_to = fecha_hora_actual
            
            # Calcular el resumen de ventas para este período
            query_total = """
                SELECT COUNT(s.id) as cantidad_transacciones, COALESCE(SUM(s.total), 0) as total_ventas
                FROM sales s
                WHERE s.user_id = %s
                  AND s.status = 'COMPLETED'
                  AND s.created_at >= %s
                  AND s.created_at <= %s;
            """
            cur.execute(query_total, (user_id, period_from, period_to))
            resultado_total = cur.fetchone()
            
            cantidad_transacciones = int(resultado_total["cantidad_transacciones"]) if resultado_total["cantidad_transacciones"] else 0
            total_ventas = float(resultado_total["total_ventas"]) if resultado_total["total_ventas"] else 0.0
            
            # Calcular desglose por método de pago
            query_desglose = """
                SELECT pm.name as metodo, COALESCE(SUM(sp.amount), 0) as total
                FROM sales s
                LEFT JOIN sale_payments sp ON s.id = sp.sale_id
                LEFT JOIN payment_methods pm ON sp.payment_method_id = pm.id
                WHERE s.user_id = %s
                  AND s.status = 'COMPLETED'
                  AND s.created_at >= %s
                  AND s.created_at <= %s
                GROUP BY pm.name
                ORDER BY pm.name;
            """
            cur.execute(query_desglose, (user_id, period_from, period_to))
            resultados_desglose = cur.fetchall()
            
            # Construir diccionario de desglose con los 3 métodos
            desglose_pagos = {
                "CASH": 0.0,
                "CARD": 0.0,
                "TRANSFER": 0.0
            }
            
            for fila in resultados_desglose:
                metodo = fila["metodo"]
                total = float(fila["total"]) if fila["total"] else 0.0
                if metodo in desglose_pagos:
                    desglose_pagos[metodo] = total
            
            # Guardar el cierre de caja en la base de datos
            cur.execute("""
                INSERT INTO cash_closures (user_id, closed_at, period_from, period_to, total_ventas, cantidad_transacciones, desglose_pagos)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, closed_at, period_from, period_to, total_ventas, cantidad_transacciones, desglose_pagos;
            """, (user_id, fecha_hora_actual, period_from, period_to, total_ventas, cantidad_transacciones, json.dumps(desglose_pagos)))
            
            cierre_guardado = cur.fetchone()
            conn.commit()
            
            return jsonify({
                "id": str(cierre_guardado["id"]),
                "user_id": user_id,
                "username": username,
                "closed_at": cierre_guardado["closed_at"].isoformat(),
                "period_from": cierre_guardado["period_from"].isoformat(),
                "period_to": cierre_guardado["period_to"].isoformat(),
                "total_ventas": float(cierre_guardado["total_ventas"]),
                "cantidad_transacciones": int(cierre_guardado["cantidad_transacciones"]),
                "desglose_pagos": cierre_guardado["desglose_pagos"]
            }), 201
            
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al confirmar cierre de caja: {str(e)}"}), 500
    finally:
        conn.close()


@ventas_bp.route("/api/sales/dashboard", methods=["GET"])
@login_requerido
def dashboard():
    """
    Devuelve métricas financieras clave para el dashboard del administrador.
    Solo accesible para usuarios con rol ADMIN.
    """
    # Verificar que sea ADMIN
    if session.get("role") != "ADMIN":
        return jsonify({"error": "Solo el administrador puede ver el dashboard"}), 403
    
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # --- HOY ---
            cur.execute("""
                SELECT COUNT(s.id) as transacciones, COALESCE(SUM(s.total), 0) as total
                FROM sales s
                WHERE s.status = 'COMPLETED'
                  AND s.created_at >= CURRENT_DATE AT TIME ZONE 'America/Bogota'
                  AND s.created_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Bogota';
            """)
            hoy_result = cur.fetchone()
            hoy = {
                "total": float(hoy_result["total"]) if hoy_result["total"] else 0.0,
                "transacciones": int(hoy_result["transacciones"]) if hoy_result["transacciones"] else 0
            }
            
            # --- SEMANA ACTUAL (lunes a domingo) ---
            cur.execute("""
                SELECT COUNT(s.id) as transacciones, COALESCE(SUM(s.total), 0) as total
                FROM sales s
                WHERE s.status = 'COMPLETED'
                  AND s.created_at >= date_trunc('week', CURRENT_DATE AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota'
                  AND s.created_at < (date_trunc('week', CURRENT_DATE AT TIME ZONE 'America/Bogota') + INTERVAL '1 week') AT TIME ZONE 'America/Bogota';
            """)
            semana_result = cur.fetchone()
            semana_actual = {
                "total": float(semana_result["total"]) if semana_result["total"] else 0.0,
                "transacciones": int(semana_result["transacciones"]) if semana_result["transacciones"] else 0
            }
            
            # --- MES ACTUAL ---
            cur.execute("""
                SELECT COUNT(s.id) as transacciones, COALESCE(SUM(s.total), 0) as total
                FROM sales s
                WHERE s.status = 'COMPLETED'
                  AND s.created_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota'
                  AND s.created_at < (date_trunc('month', CURRENT_DATE AT TIME ZONE 'America/Bogota') + INTERVAL '1 month') AT TIME ZONE 'America/Bogota';
            """)
            mes_result = cur.fetchone()
            mes_actual = {
                "total": float(mes_result["total"]) if mes_result["total"] else 0.0,
                "transacciones": int(mes_result["transacciones"]) if mes_result["transacciones"] else 0
            }
            
            # --- ÚLTIMOS 7 DÍAS (incluyendo días con $0) ---
            ultimos_7_dias = []
            cur.execute("""
                SELECT 
                    DATE(s.created_at AT TIME ZONE 'America/Bogota') as fecha,
                    COALESCE(SUM(s.total), 0) as total
                FROM sales s
                WHERE s.status = 'COMPLETED'
                  AND s.created_at >= (CURRENT_DATE - INTERVAL '6 days') AT TIME ZONE 'America/Bogota'
                  AND s.created_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Bogota'
                GROUP BY DATE(s.created_at AT TIME ZONE 'America/Bogota')
                ORDER BY fecha;
            """)
            ventas_por_dia = {row["fecha"].strftime("%Y-%m-%d"): float(row["total"]) for row in cur.fetchall()}
            
            # Generar los últimos 7 días completos (incluyendo hoy)
            from datetime import timedelta
            for i in range(6, -1, -1):
                fecha = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                ultimos_7_dias.append({
                    "fecha": fecha,
                    "total": ventas_por_dia.get(fecha, 0.0)
                })
            
            # --- PRODUCTO MÁS VENDIDO (últimos 30 días) ---
            cur.execute("""
                SELECT p.name as nombre, SUM(si.quantity) as cantidad_vendida
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                JOIN products p ON si.product_id = p.id
                WHERE s.status = 'COMPLETED'
                  AND s.created_at >= (CURRENT_DATE - INTERVAL '30 days') AT TIME ZONE 'America/Bogota'
                  AND s.created_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Bogota'
                GROUP BY p.name
                ORDER BY cantidad_vendida DESC
                LIMIT 1;
            """)
            producto_result = cur.fetchone()
            producto_mas_vendido = None
            if producto_result and producto_result["cantidad_vendida"]:
                producto_mas_vendido = {
                    "nombre": producto_result["nombre"],
                    "cantidad_vendida": int(producto_result["cantidad_vendida"])
                }

            cur.execute("""
                SELECT COALESCE(SUM(monto), 0) AS total
                FROM expenses
                WHERE estado = 'PENDIENTE'
            """)
            gastos_pendientes = float(cur.fetchone()["total"])
            
            return jsonify({
                "hoy": hoy,
                "semana_actual": semana_actual,
                "mes_actual": mes_actual,
                "ultimos_7_dias": ultimos_7_dias,
                "producto_mas_vendido": producto_mas_vendido,
                "gastos_pendientes": gastos_pendientes
            })
            
    except Exception as e:
        return jsonify({"error": f"Error al obtener dashboard: {str(e)}"}), 500
    finally:
        conn.close()


@ventas_bp.route("/api/sales/reportes-empleados", methods=["GET"])
@login_requerido
def reportes_empleados():
    """
    Devuelve el reporte de cierres de caja para el administrador.
    Muestra CADA cierre individual con su fecha/hora exacta, no sumas agregadas.
    Solo accesible para usuarios con rol ADMIN.
    """
    # Verificar que sea ADMIN
    if session.get("role") != "ADMIN":
        return jsonify({"error": "Solo el administrador puede ver este reporte"}), 403
    
    # Obtener parámetros de fecha opcionales
    fecha_desde = request.args.get("from")
    fecha_hasta = request.args.get("to")
    
    # Si no se envían fechas, usar el día de HOY por defecto
    if not fecha_desde or not fecha_hasta:
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        fecha_desde = fecha_desde or fecha_hoy
        fecha_hasta = fecha_hasta or fecha_hoy
    
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Query principal: obtener cierres individuales filtrando por closed_at
            query = """
                SELECT 
                    cc.id,
                    cc.user_id,
                    u.username,
                    cc.closed_at,
                    cc.period_from,
                    cc.period_to,
                    cc.total_ventas,
                    cc.cantidad_transacciones,
                    cc.desglose_pagos
                FROM cash_closures cc
                JOIN users u ON cc.user_id = u.id
                WHERE cc.closed_at >= %s::timestamp AT TIME ZONE 'America/Bogota'
                  AND cc.closed_at <= %s::timestamp AT TIME ZONE 'America/Bogota' + interval '1 day' - interval '1 second'
                ORDER BY cc.closed_at DESC, u.username;
            """
            
            cur.execute(query, (fecha_desde + ' 00:00:00', fecha_hasta + ' 00:00:00'))
            resultados = cur.fetchall()
            
            # Construir el array de cierres individuales
            cierres = []
            total_general = 0.0
            
            for fila in resultados:
                cierre = {
                    "id": str(fila["id"]),
                    "user_id": str(fila["user_id"]),
                    "username": fila["username"],
                    "closed_at": fila["closed_at"].isoformat(),
                    "period_from": fila["period_from"].isoformat(),
                    "period_to": fila["period_to"].isoformat(),
                    "total_ventas": float(fila["total_ventas"]) if fila["total_ventas"] else 0.0,
                    "cantidad_transacciones": int(fila["cantidad_transacciones"]),
                    "desglose_pagos": fila["desglose_pagos"]
                }
                cierres.append(cierre)
                total_general += cierre["total_ventas"]
            
            return jsonify({
                "periodo": {
                    "from": fecha_desde,
                    "to": fecha_hasta
                },
                "cierres": cierres,
                "total_cierres": len(cierres),
                "total_general": total_general
            })
            
    except Exception as e:
        return jsonify({"error": f"Error al obtener reportes de empleados: {str(e)}"}), 500
    finally:
        conn.close()  


@ventas_bp.route("/api/sales/comisiones-empleados", methods=["GET"])
@login_requerido
def comisiones_empleados():
    """Calcula la comisión por producto y empleado para un período."""
    if session.get("role") != "ADMIN":
        return jsonify({"error": "Solo el administrador puede ver este reporte"}), 403

    fecha_desde = request.args.get("from")
    fecha_hasta = request.args.get("to")
    if not fecha_desde or not fecha_hasta:
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        fecha_desde = fecha_desde or fecha_hoy
        fecha_hasta = fecha_hasta or fecha_hoy

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    s.user_id,
                    u.username,
                    si.product_id,
                    si.product_name,
                    si.commission_percentage,
                    SUM(si.quantity) AS quantity_sold,
                    SUM(si.subtotal * si.commission_percentage / 100) AS commission
                FROM sales s
                JOIN users u ON u.id = s.user_id
                JOIN sale_items si ON si.sale_id = s.id
                WHERE s.status = 'COMPLETED'
                  AND s.created_at >= %s::timestamp AT TIME ZONE 'America/Bogota'
                  AND s.created_at <= %s::timestamp AT TIME ZONE 'America/Bogota' + interval '1 day' - interval '1 second'
                GROUP BY s.user_id, u.username, si.product_id, si.product_name, si.commission_percentage
                HAVING si.commission_percentage > 0
                ORDER BY u.username, si.product_name;
            """, (fecha_desde + " 00:00:00", fecha_hasta + " 00:00:00"))
            filas = cur.fetchall()

        empleados = {}
        total_general = 0.0
        for fila in filas:
            user_id = str(fila["user_id"])
            empleado = empleados.setdefault(user_id, {
                "user_id": user_id,
                "username": fila["username"],
                "total_comision": 0.0,
                "desglose": []
            })
            comision = float(fila["commission"]) if fila["commission"] else 0.0
            empleado["total_comision"] += comision
            empleado["desglose"].append({
                "product_id": str(fila["product_id"]),
                "product_name": fila["product_name"],
                "cantidad_vendida": float(fila["quantity_sold"]) if fila["quantity_sold"] else 0.0,
                "comision_generada": comision
            })
            total_general += comision

        return jsonify({
            "periodo": {"from": fecha_desde, "to": fecha_hasta},
            "empleados": list(empleados.values()),
            "total_general": total_general
        })
    except Exception as e:
        return jsonify({"error": f"Error al obtener comisiones: {str(e)}"}), 500
    finally:
        conn.close()