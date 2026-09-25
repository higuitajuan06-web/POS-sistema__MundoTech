# endpoints /api/appointments
# funciones CRUD de citas
from flask import Blueprint, jsonify, request
from ..db.conexion import obtener_conexion, login_requerido
from ..rutas.ventas import _procesar_venta_transaccional

citas_bp = Blueprint("citas", __name__)


@citas_bp.route("/api/appointments", methods=["GET"])
def listar_citas():
    """Devuelve citas con filtros opcionales de fecha, estado, cliente y anticipo."""
    fecha = request.args.get("date")
    fecha_desde = request.args.get("from")
    fecha_hasta = request.args.get("to")
    estado = request.args.get("status")
    customer_id = request.args.get("customer_id")
    con_anticipo = request.args.get("con_anticipo", "").lower() == "true"

    query = """
        SELECT a.id, a.customer_id, a.appointment_date, a.appointment_time,
               a.service_name, a.price, a.notes, a.status, a.created_at, a.updated_at,
               a.anticipo_monto, a.anticipo_payment_method_id, a.phone,
               c.name AS customer_name, c.phone AS customer_phone
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        WHERE 1=1
    """
    params = []

    if fecha:
        query += " AND a.appointment_date = %s"
        params.append(fecha)
    if fecha_desde:
        query += " AND a.appointment_date >= %s"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND a.appointment_date <= %s"
        params.append(fecha_hasta)
    if estado:
        query += " AND a.status = %s"
        params.append(estado)
    if customer_id:
        query += " AND a.customer_id = %s"
        params.append(customer_id)
    if con_anticipo:
        query += " AND a.status IN ('PENDIENTE', 'CONFIRMADA') AND a.anticipo_monto > 0"

    query += " ORDER BY a.appointment_date, a.appointment_time;"

    try:
        with obtener_conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                citas = cur.fetchall()

        # Convertir date/time a strings para JSON serializable
        citas_serializables = []
        for cita in citas:
            cita_dict = dict(cita)
            if cita_dict.get("appointment_date"):
                # Formato YYYY-MM-DD sin timezone - enviar como string plano
                cita_dict["appointment_date"] = str(cita_dict["appointment_date"])
            if cita_dict.get("appointment_time"):
                # Formato HH:MM para input type="time"
                cita_dict["appointment_time"] = str(cita_dict["appointment_time"])[:5]
            if cita_dict.get("created_at"):
                cita_dict["created_at"] = cita_dict["created_at"].isoformat()
            if cita_dict.get("updated_at"):
                cita_dict["updated_at"] = cita_dict["updated_at"].isoformat()
            # Convertir anticipo_monto a float para JSON
            if cita_dict.get("anticipo_monto"):
                cita_dict["anticipo_monto"] = float(cita_dict["anticipo_monto"])
            citas_serializables.append(cita_dict)

        return jsonify(citas_serializables)
    except Exception as e:
        return jsonify({"error": f"Error al obtener citas: {str(e)}"}), 500


@citas_bp.route("/api/appointments/<uuid:appointment_id>", methods=["GET"])
def obtener_cita(appointment_id):
    """Obtiene el detalle de una cita específica."""
    query = """
        SELECT a.id, a.customer_id, a.appointment_date, a.appointment_time,
               a.service_name, a.price, a.notes, a.status, a.created_at, a.updated_at,
               a.anticipo_monto, a.anticipo_payment_method_id, a.phone,
               c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        WHERE a.id = %s;
    """

    try:
        with obtener_conexion() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (str(appointment_id),))
                cita = cur.fetchone()

        if not cita:
            return jsonify({"error": "Cita no encontrada"}), 404

        # Convertir date/time a strings para JSON serializable
        cita_dict = dict(cita)
        if cita_dict.get("appointment_date"):
            # Formato YYYY-MM-DD sin timezone - enviar como string plano
            cita_dict["appointment_date"] = str(cita_dict["appointment_date"])
        if cita_dict.get("appointment_time"):
            # Formato HH:MM para input type="time"
            cita_dict["appointment_time"] = str(cita_dict["appointment_time"])[:5]
        if cita_dict.get("created_at"):
            cita_dict["created_at"] = cita_dict["created_at"].isoformat()
        if cita_dict.get("updated_at"):
            cita_dict["updated_at"] = cita_dict["updated_at"].isoformat()
        # Convertir anticipo_monto a float para JSON
        if cita_dict.get("anticipo_monto"):
            cita_dict["anticipo_monto"] = float(cita_dict["anticipo_monto"])

        return jsonify(cita_dict)
    except Exception as e:
        return jsonify({"error": f"Error al obtener cita: {str(e)}"}), 500


@citas_bp.route("/api/appointments", methods=["POST"])
@login_requerido
def crear_cita():
    """Crea una nueva cita."""
    datos = request.get_json()
    customer_id = datos.get("customer_id")
    appointment_date = datos.get("appointment_date")
    appointment_time = datos.get("appointment_time")
    service_name = datos.get("service_name")

    # Validaciones básicas
    if not customer_id:
        return jsonify({"error": "El cliente es obligatorio"}), 400
    if not appointment_date:
        return jsonify({"error": "La fecha es obligatoria"}), 400
    if not appointment_time:
        return jsonify({"error": "La hora es obligatoria"}), 400
    if not service_name:
        return jsonify({"error": "El servicio/motivo es obligatorio"}), 400

    # Validar anticipo
    anticipo_monto = datos.get("anticipo_monto", 0)
    anticipo_payment_method_id = datos.get("anticipo_payment_method_id")

    if anticipo_monto and anticipo_monto > 0:
        if not anticipo_payment_method_id:
            return jsonify({"error": "Si hay anticipo, el método de pago es obligatorio"}), 400

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Verificar que el cliente existe
            cur.execute("SELECT id FROM customers WHERE id = %s;", (customer_id,))
            if not cur.fetchone():
                return jsonify({"error": "El cliente no existe"}), 404

            cur.execute("""
                INSERT INTO appointments (customer_id, appointment_date, appointment_time, service_name, price, notes, status, anticipo_monto, anticipo_payment_method_id, phone)
                VALUES (%s, %s, %s, %s, %s, %s, 'PENDIENTE', %s, %s, %s)
                RETURNING id, customer_id, appointment_date, appointment_time, service_name, price, notes, status, anticipo_monto, anticipo_payment_method_id, phone, created_at;
            """, (
                customer_id,
                appointment_date,
                appointment_time,
                service_name,
                datos.get("price"),
                datos.get("notes"),
                anticipo_monto,
                anticipo_payment_method_id,
                datos.get("phone")
            ))
            nueva_cita = cur.fetchone()
            conn.commit()

        # Convertir date/time a strings para JSON serializable
        cita_dict = dict(nueva_cita)
        if cita_dict.get("appointment_date"):
            # Formato YYYY-MM-DD sin timezone - enviar como string plano
            cita_dict["appointment_date"] = str(cita_dict["appointment_date"])
        if cita_dict.get("appointment_time"):
            # Formato HH:MM para input type="time"
            cita_dict["appointment_time"] = str(cita_dict["appointment_time"])[:5]
        if cita_dict.get("created_at"):
            cita_dict["created_at"] = cita_dict["created_at"].isoformat()
        # Convertir anticipo_monto a float para JSON
        if cita_dict.get("anticipo_monto"):
            cita_dict["anticipo_monto"] = float(cita_dict["anticipo_monto"])

        return jsonify(cita_dict), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al crear cita: {str(e)}"}), 500
    finally:
        conn.close()


@citas_bp.route("/api/appointments/<uuid:appointment_id>", methods=["PUT"])
@login_requerido
def editar_cita(appointment_id):
    """Edita una cita existente."""
    datos = request.get_json()
    customer_id = datos.get("customer_id")
    appointment_date = datos.get("appointment_date")
    appointment_time = datos.get("appointment_time")
    service_name = datos.get("service_name")

    # Validaciones básicas
    if not customer_id:
        return jsonify({"error": "El cliente es obligatorio"}), 400
    if not appointment_date:
        return jsonify({"error": "La fecha es obligatoria"}), 400
    if not appointment_time:
        return jsonify({"error": "La hora es obligatoria"}), 400
    if not service_name:
        return jsonify({"error": "El servicio/motivo es obligatorio"}), 400

    # Validar anticipo
    anticipo_monto = datos.get("anticipo_monto", 0)
    anticipo_payment_method_id = datos.get("anticipo_payment_method_id")

    if anticipo_monto and anticipo_monto > 0:
        if not anticipo_payment_method_id:
            return jsonify({"error": "Si hay anticipo, el método de pago es obligatorio"}), 400

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Verificar que el cliente existe
            cur.execute("SELECT id FROM customers WHERE id = %s;", (customer_id,))
            if not cur.fetchone():
                return jsonify({"error": "El cliente no existe"}), 404

            # Primero verificar que la cita existe
            cur.execute("SELECT id FROM appointments WHERE id = %s;", (str(appointment_id),))
            if not cur.fetchone():
                return jsonify({"error": "Cita no encontrada"}), 404

            cur.execute("""
                UPDATE appointments
                SET customer_id = %s, appointment_date = %s, appointment_time = %s,
                    service_name = %s, price = %s, notes = %s, updated_at = NOW(),
                    anticipo_monto = %s, anticipo_payment_method_id = %s, phone = %s
                WHERE id = %s
                RETURNING id, customer_id, appointment_date, appointment_time, service_name, price, notes, status, anticipo_monto, anticipo_payment_method_id, phone, updated_at;
            """, (
                customer_id,
                appointment_date,
                appointment_time,
                service_name,
                datos.get("price"),
                datos.get("notes"),
                anticipo_monto,
                anticipo_payment_method_id,
                datos.get("phone"),
                str(appointment_id)
            ))
            cita = cur.fetchone()
            conn.commit()

        if not cita:
            return jsonify({"error": "Cita no encontrada después del update"}), 404

        # Convertir date/time a strings para JSON serializable
        cita_dict = dict(cita)
        if cita_dict.get("appointment_date"):
            # Formato YYYY-MM-DD sin timezone - enviar como string plano
            cita_dict["appointment_date"] = str(cita_dict["appointment_date"])
        if cita_dict.get("appointment_time"):
            # Formato HH:MM para input type="time"
            cita_dict["appointment_time"] = str(cita_dict["appointment_time"])[:5]
        if cita_dict.get("updated_at"):
            cita_dict["updated_at"] = cita_dict["updated_at"].isoformat()
        # Convertir anticipo_monto a float para JSON
        if cita_dict.get("anticipo_monto"):
            cita_dict["anticipo_monto"] = float(cita_dict["anticipo_monto"])

        return jsonify(cita_dict)
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al editar cita: {str(e)}"}), 500
    finally:
        conn.close()


@citas_bp.route("/api/appointments/<uuid:appointment_id>/status", methods=["PATCH"])
@login_requerido
def cambiar_estado_cita(appointment_id):
    """Cambia el estado de una cita."""
    datos = request.get_json()
    nuevo_estado = datos.get("status")

    if not nuevo_estado:
        return jsonify({"error": "El estado es obligatorio"}), 400

    # Validar que el estado sea válido
    estados_validos = ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO']
    if nuevo_estado not in estados_validos:
        return jsonify({"error": f"Estado no válido. Estados válidos: {', '.join(estados_validos)}"}), 400

    # REGLA DE NEGOCIO: El estado COMPLETADA solo se asigna automáticamente al convertir la cita en venta
    if nuevo_estado == 'COMPLETADA':
        return jsonify({"error": "El estado COMPLETADA solo se asigna automáticamente al convertir la cita en una venta pagada"}), 400

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE appointments
                SET status = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id, status, updated_at;
            """, (nuevo_estado, str(appointment_id)))
            cita = cur.fetchone()
            conn.commit()

        if not cita:
            return jsonify({"error": "Cita no encontrada"}), 404

        # Convertir updated_at a string para JSON serializable
        cita_dict = dict(cita)
        if cita_dict.get("updated_at"):
            cita_dict["updated_at"] = cita_dict["updated_at"].isoformat()

        return jsonify(cita_dict)
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al cambiar estado de cita: {str(e)}"}), 500
    finally:
        conn.close()


@citas_bp.route("/api/appointments/<uuid:appointment_id>", methods=["DELETE"])
@login_requerido
def eliminar_cita(appointment_id):
    """Elimina una cita."""
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM sales WHERE appointment_id = %s;", (str(appointment_id),))
            tiene_ventas = cur.fetchone()["total"] > 0

            if tiene_ventas:
                return jsonify({
                    "error": "No se puede eliminar: esta cita ya tiene una venta registrada. Si necesitas anularla, cambia su estado a CANCELADA en su lugar."
                }), 409

            cur.execute("DELETE FROM appointments WHERE id = %s RETURNING id;", (str(appointment_id),))
            resultado = cur.fetchone()
            conn.commit()

        if not resultado:
            return jsonify({"error": "Cita no encontrada"}), 404
        return jsonify({"message": "Cita eliminada"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al eliminar cita: {str(e)}"}), 500
    finally:
        conn.close()


@citas_bp.route("/api/appointments/<uuid:appointment_id>/convertir-a-venta", methods=["POST"])
@login_requerido
def convertir_cita_a_venta(appointment_id):
    """
    Convierte una cita en una venta, incluyendo el anticipo si existe.
    Reutiliza la lógica transaccional de ventas para mantener consistencia.
    """
    datos = request.get_json()
    items = datos.get("items", [])
    pagos = datos.get("payments", [])
    user_id = datos.get("user_id")

    # Validaciones básicas
    if not user_id:
        return jsonify({"error": "user_id es obligatorio"}), 400
    if not items:
        return jsonify({"error": "La venta debe tener al menos un producto"}), 400
    if not pagos:
        return jsonify({"error": "La venta debe tener al menos un método de pago"}), 400

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # --- 1. Obtener la cita ---
            cur.execute("""
                SELECT id, customer_id, status, anticipo_monto, anticipo_payment_method_id
                FROM appointments
                WHERE id = %s;
            """, (str(appointment_id),))
            cita = cur.fetchone()

            if not cita:
                return jsonify({"error": "Cita no encontrada"}), 404

            # --- 2. Verificar que la cita no esté ya completada ---
            if cita["status"] == "COMPLETADA":
                return jsonify({"error": "Esta cita ya fue convertida en venta"}), 409

            # --- 3. Si hay anticipo, agregarlo a los pagos ---
            if cita["anticipo_monto"] and cita["anticipo_monto"] > 0:
                if not cita["anticipo_payment_method_id"]:
                    return jsonify({"error": "La cita tiene anticipo pero sin método de pago"}), 400

                # Agregar el anticipo como un pago adicional
                pagos.append({
                    "payment_method_id": cita["anticipo_payment_method_id"],
                    "amount": float(cita["anticipo_monto"])
                })

            # --- 4. Procesar la venta usando la función compartida ---
            sale_id, total_venta, items_procesados = _procesar_venta_transaccional(
                cur, cita["customer_id"], user_id, items, pagos, appointment_id=str(appointment_id)
            )

            # --- 5. Actualizar estado de la cita a COMPLETADA ---
            cur.execute("""
                UPDATE appointments
                SET status = 'COMPLETADA', updated_at = NOW()
                WHERE id = %s;
            """, (str(appointment_id),))

            conn.commit()

        return jsonify({
            "id": sale_id,
            "total": total_venta,
            "items": items_procesados,
            "cita_id": str(appointment_id)
        }), 201

    except ValueError as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al convertir cita en venta: {str(e)}"}), 500
    finally:
        conn.close()
