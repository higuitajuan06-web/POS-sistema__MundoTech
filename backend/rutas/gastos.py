from datetime import date
from decimal import Decimal, InvalidOperation
from flask import Blueprint, jsonify, request, session

from ..db.conexion import login_requerido, obtener_conexion


gastos_bp = Blueprint("gastos", __name__)
ESTADOS_VALIDOS = {"PENDIENTE", "PAGADO"}


def _rol_admin():
    if session.get("role") != "ADMIN":
        return jsonify({"error": "Solo el administrador puede gestionar gastos"}), 403
    return None


def _validar_fecha(valor):
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def _datos_gasto():
    datos = request.get_json(silent=True) or {}
    concepto = (datos.get("concepto") or "").strip()
    if not concepto:
        return None, "El concepto es obligatorio"
    if len(concepto) > 150:
        return None, "El concepto no puede superar 150 caracteres"

    try:
        monto = Decimal(str(datos.get("monto")))
    except (InvalidOperation, TypeError, ValueError):
        return None, "El monto debe ser un número válido"
    if not monto.is_finite() or monto <= 0:
        return None, "El monto debe ser mayor que cero"

    fecha = datos.get("fecha")
    if fecha and not _validar_fecha(fecha):
        return None, "La fecha debe tener formato YYYY-MM-DD"
    estado = (datos.get("estado") or "PENDIENTE").upper()
    if estado not in ESTADOS_VALIDOS:
        return None, "El estado debe ser PENDIENTE o PAGADO"

    categoria = (datos.get("categoria") or "").strip() or None
    if categoria and len(categoria) > 50:
        return None, "La categoría no puede superar 50 caracteres"
    nota = (datos.get("nota") or "").strip() or None
    return {
        "concepto": concepto,
        "monto": monto,
        "fecha": fecha,
        "categoria": categoria,
        "nota": nota,
        "estado": estado,
    }, None


def _serializar(gasto):
    resultado = dict(gasto)
    resultado["id"] = str(resultado["id"])
    resultado["monto"] = float(resultado["monto"])
    if resultado.get("fecha"):
        resultado["fecha"] = resultado["fecha"].isoformat()
    if resultado.get("created_at"):
        resultado["created_at"] = resultado["created_at"].isoformat()
    if resultado.get("updated_at"):
        resultado["updated_at"] = resultado["updated_at"].isoformat()
    return resultado


@gastos_bp.route("/api/expenses", methods=["GET"])
@login_requerido
def listar_gastos():
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    filtros = []
    parametros = []
    fecha_desde = request.args.get("from")
    fecha_hasta = request.args.get("to")
    estado = (request.args.get("estado") or "").upper()

    if fecha_desde:
        if not _validar_fecha(fecha_desde):
            return jsonify({"error": "La fecha inicial no es válida"}), 400
        filtros.append("e.fecha >= %s")
        parametros.append(fecha_desde)
    if fecha_hasta:
        if not _validar_fecha(fecha_hasta):
            return jsonify({"error": "La fecha final no es válida"}), 400
        filtros.append("e.fecha <= %s")
        parametros.append(fecha_hasta)
    if estado:
        if estado not in ESTADOS_VALIDOS:
            return jsonify({"error": "El estado no es válido"}), 400
        filtros.append("e.estado = %s")
        parametros.append(estado)

    consulta = """
        SELECT e.id, e.concepto, e.monto, e.fecha, e.categoria, e.nota,
               e.estado, e.created_by, e.created_at, e.updated_at
        FROM expenses e
    """
    if filtros:
        consulta += " WHERE " + " AND ".join(filtros)
    consulta += " ORDER BY e.fecha DESC, e.created_at DESC"

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute(consulta, parametros)
            gastos = cur.fetchall()
    return jsonify([_serializar(gasto) for gasto in gastos])


@gastos_bp.route("/api/expenses", methods=["POST"])
@login_requerido
def crear_gasto():
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    datos, error = _datos_gasto()
    if error:
        return jsonify({"error": error}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO expenses (concepto, monto, fecha, categoria, nota, estado, created_by)
                VALUES (%s, %s, COALESCE(%s, CURRENT_DATE), %s, %s, %s, %s)
                RETURNING id, concepto, monto, fecha, categoria, nota, estado,
                          created_by, created_at, updated_at
            """, (datos["concepto"], datos["monto"], datos["fecha"], datos["categoria"],
                  datos["nota"], datos["estado"], session["user_id"]))
            gasto = cur.fetchone()
        conn.commit()
    return jsonify(_serializar(gasto)), 201


@gastos_bp.route("/api/expenses/<uuid:gasto_id>", methods=["PUT"])
@login_requerido
def editar_gasto(gasto_id):
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    datos, error = _datos_gasto()
    if error:
        return jsonify({"error": error}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE expenses
                SET concepto = %s, monto = %s, fecha = COALESCE(%s, fecha),
                    categoria = %s, nota = %s, estado = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id, concepto, monto, fecha, categoria, nota, estado,
                          created_by, created_at, updated_at
            """, (datos["concepto"], datos["monto"], datos["fecha"], datos["categoria"],
                  datos["nota"], datos["estado"], gasto_id))
            gasto = cur.fetchone()
        if not gasto:
            return jsonify({"error": "Gasto no encontrado"}), 404
        conn.commit()
    return jsonify(_serializar(gasto))


@gastos_bp.route("/api/expenses/<uuid:gasto_id>", methods=["DELETE"])
@login_requerido
def eliminar_gasto(gasto_id):
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM expenses WHERE id = %s RETURNING id", (gasto_id,))
            eliminado = cur.fetchone()
        if not eliminado:
            return jsonify({"error": "Gasto no encontrado"}), 404
        conn.commit()
    return jsonify({"message": "Gasto eliminado"})


@gastos_bp.route("/api/expenses/resumen", methods=["GET"])
@login_requerido
def resumen_gastos():
    error_rol = _rol_admin()
    if error_rol:
        return error_rol
    fecha = request.args.get("fecha") or date.today().isoformat()
    if not _validar_fecha(fecha):
        return jsonify({"error": "La fecha no es válida"}), 400

    with obtener_conexion() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                  COALESCE((SELECT SUM(total) FROM sales
                            WHERE status = 'COMPLETED'
                              AND created_at >= %s::date AT TIME ZONE 'America/Bogota'
                              AND created_at < (%s::date + INTERVAL '1 day') AT TIME ZONE 'America/Bogota'), 0) AS ventas,
                  COALESCE(SUM(monto) FILTER (WHERE estado = 'PAGADO'), 0) AS gastos_pagados,
                  COALESCE(SUM(monto) FILTER (WHERE estado = 'PENDIENTE'), 0) AS gastos_pendientes
                FROM expenses
                WHERE fecha = %s
            """, (fecha, fecha, fecha))
            resumen = cur.fetchone()
    ventas = float(resumen["ventas"])
    gastos_pagados = float(resumen["gastos_pagados"])
    return jsonify({
        "fecha": fecha,
        "total_ventas": ventas,
        "total_gastos_pagado": gastos_pagados,
        "neto": ventas - gastos_pagados,
        "total_gastos_pendiente": float(resumen["gastos_pendientes"]),
    })
