// Capa central de conexión con el backend.
// Todas las pantallas usan estas funciones — nunca hacen fetch() directo.
const API_BASE = "http://127.0.0.1:5000/api";

async function manejarRespuesta(response) {
  const datos = await response.json();
  if (!response.ok) {
    // El backend siempre devuelve { error: "mensaje" } cuando algo falla
    const error = new Error(datos.error || "Error desconocido en el servidor");
    error.status = response.status;
    throw error;
  }
  return datos;
}

// --- Productos ---
async function obtenerProductos() {
  const res = await fetch(`${API_BASE}/products`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function crearProducto(datos) {
  const res = await fetch(`${API_BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function editarProducto(id, datos) {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function eliminarProducto(id) {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("imagen", file);
  
  const res = await fetch(`${API_BASE}/products/upload-image`, {
    method: "POST",
    body: formData,
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function obtenerGaleria(categoryId = "") {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
  const res = await fetch(`${API_BASE}/gallery${query}`);
  return manejarRespuesta(res);
}

async function crearGaleriaItem(datos) {
  const res = await fetch(`${API_BASE}/gallery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos), credentials: "include"
  });
  return manejarRespuesta(res);
}

async function editarGaleriaItem(id, datos) {
  const res = await fetch(`${API_BASE}/gallery/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos), credentials: "include"
  });
  return manejarRespuesta(res);
}

async function eliminarGaleriaItem(id) {
  const res = await fetch(`${API_BASE}/gallery/${id}`, {
    method: "DELETE", credentials: "include"
  });
  return manejarRespuesta(res);
}

async function buscarProductoPorCodigo(codigo) {
  const res = await fetch(`${API_BASE}/products/buscar-por-codigo/${encodeURIComponent(codigo)}`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function agregarStock(id, cantidad) {
  const res = await fetch(`${API_BASE}/products/${id}/stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cantidad_agregar: cantidad }),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

// --- Categorías ---
async function obtenerCategorias() {
  const res = await fetch(`${API_BASE}/categories`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function crearCategoria(datos) {
  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function editarCategoria(id, datos) {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function eliminarCategoria(id) {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

// --- Clientes ---
async function obtenerClientes(busqueda = "") {
  const url = busqueda
    ? `${API_BASE}/customers?q=${encodeURIComponent(busqueda)}`
    : `${API_BASE}/customers`;
  const res = await fetch(url, { credentials: "include" });
  return manejarRespuesta(res);
}

async function crearCliente(datos) {
  const res = await fetch(`${API_BASE}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function editarCliente(id, datos) {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function eliminarCliente(id) {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

// --- Ventas ---
async function registrarVenta(venta) {
  const res = await fetch(`${API_BASE}/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(venta),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function obtenerVentas(desde = null, hasta = null, user_id = null) {
  let url = `${API_BASE}/sales`;
  const params = new URLSearchParams();
  if (desde && desde.trim() !== "") params.append("from", desde);
  if (hasta && hasta.trim() !== "") params.append("to", hasta);
  if (user_id) params.append("user_id", user_id);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url, { credentials: "include" });
  return manejarRespuesta(res);
}

async function obtenerDetalleVenta(sale_id) {
  const res = await fetch(`${API_BASE}/sales/${sale_id}`, { credentials: "include" });
  return manejarRespuesta(res);
}

// --- Autenticación ---
async function iniciarSesion(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function obtenerSesionActual() {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  if (res.status === 401) {
    return null;
  }
  return manejarRespuesta(res);
}

async function obtenerCierreCaja() {
  const res = await fetch(`${API_BASE}/sales/cierre-caja`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function confirmarCierreCaja() {
  const res = await fetch(`${API_BASE}/sales/cierre-caja`, {
    method: "POST",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function obtenerReportesEmpleados(desde = null, hasta = null) {
  let url = `${API_BASE}/sales/reportes-empleados`;
  const params = new URLSearchParams();
  if (desde && desde.trim() !== "") params.append("from", desde);
  if (hasta && hasta.trim() !== "") params.append("to", hasta);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url, { credentials: "include" });
  return manejarRespuesta(res);
}

async function obtenerComisionesEmpleados(desde = null, hasta = null) {
  let url = `${API_BASE}/sales/comisiones-empleados`;
  const params = new URLSearchParams();
  if (desde && desde.trim() !== "") params.append("from", desde);
  if (hasta && hasta.trim() !== "") params.append("to", hasta);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url, { credentials: "include" });
  return manejarRespuesta(res);
}

async function obtenerBodega() {
  const res = await fetch(`${API_BASE}/products/bodega`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function cerrarSesion() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function obtenerDashboard() {
  const res = await fetch(`${API_BASE}/sales/dashboard`, { credentials: "include" });
  return manejarRespuesta(res);
}

// --- Gastos ---
async function obtenerGastos(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.from) params.append("from", filtros.from);
  if (filtros.to) params.append("to", filtros.to);
  if (filtros.estado) params.append("estado", filtros.estado);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/expenses${query}`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function crearGasto(datos) {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function editarGasto(id, datos) {
  const res = await fetch(`${API_BASE}/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function eliminarGasto(id) {
  const res = await fetch(`${API_BASE}/expenses/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function obtenerResumenGastos(fecha) {
  const res = await fetch(`${API_BASE}/expenses/resumen?fecha=${encodeURIComponent(fecha)}`, {
    credentials: "include"
  });
  return manejarRespuesta(res);
}

// --- Citas ---
async function obtenerCitas(filtros = {}) {
  let url = `${API_BASE}/appointments`;
  const params = new URLSearchParams();
  if (filtros.date) params.append("date", filtros.date);
  if (filtros.from) params.append("from", filtros.from);
  if (filtros.to) params.append("to", filtros.to);
  if (filtros.status) params.append("status", filtros.status);
  if (filtros.customer_id) params.append("customer_id", filtros.customer_id);
  if (filtros.con_anticipo) params.append("con_anticipo", "true");
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url, { credentials: "include" });
  return manejarRespuesta(res);
}

async function obtenerCita(id) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function crearCita(datos) {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function editarCita(id, datos) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function cambiarEstadoCita(id, estado) {
  const res = await fetch(`${API_BASE}/appointments/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: estado }),
    credentials: "include"
  });
  return manejarRespuesta(res);
}

async function eliminarCita(id) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  return manejarRespuesta(res);
}

// --- Sistema ---
async function obtenerVersionSistema() {
  const res = await fetch(`${API_BASE}/sistema/version`, { credentials: "include" });
  return manejarRespuesta(res);
}

async function verificarActualizacion() {
  const res = await fetch(`${API_BASE}/sistema/verificar-actualizacion`, { credentials: "include" });
  return manejarRespuesta(res);
}