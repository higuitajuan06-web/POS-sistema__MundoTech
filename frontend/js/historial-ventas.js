// Historial de ventas - Mundo Tech POS

// ===== Estado global =====
let usuarioActual = null;
let ventasActuales = [];

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSesion();
  configurarFiltros();
  cargarVentasHoy();
});

// ===== Verificar sesión =====
async function verificarSesion() {
  try {
    usuarioActual = await obtenerSesionActual();
    if (!usuarioActual) {
      window.location.href = "login.html";
      return;
    }
    
    // NOTA: La configuración del sidebar según rol se maneja en sidebar.js
    // No es necesario configurarlo aquí
  } catch (error) {
    console.error("Error al verificar sesión:", error);
    window.location.href = "login.html";
  }
}

// ===== Configurar filtros de fecha =====
function configurarFiltros() {
  const fechaDesde = document.getElementById("fecha-desde");
  const fechaHasta = document.getElementById("fecha-hasta");
  const btnFiltrar = document.getElementById("btn-filtrar");

  // Establecer fecha de hoy por defecto (usando fecha local, no UTC)
  const hoy = obtenerFechaLocal();
  fechaDesde.value = hoy;
  fechaHasta.value = hoy;

  btnFiltrar.addEventListener("click", () => {
    cargarVentas();
  });

  // Configurar botones de acceso rápido
  document.querySelectorAll(".btn-rapido").forEach(btn => {
    btn.addEventListener("click", () => {
      const periodo = btn.dataset.periodo;
      aplicarPeriodoRapido(periodo);
    });
  });
}

// ===== Aplicar período rápido =====
function aplicarPeriodoRapido(periodo) {
  const fechaDesde = document.getElementById("fecha-desde");
  const fechaHasta = document.getElementById("fecha-hasta");
  const hoy = new Date();

  switch (periodo) {
    case "hoy":
      fechaDesde.value = obtenerFechaLocal();
      fechaHasta.value = obtenerFechaLocal();
      break;
    case "ayer":
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      fechaDesde.value = formatearFechaInput(ayer);
      fechaHasta.value = formatearFechaInput(ayer);
      break;
    case "ultimos7":
      const hace7dias = new Date(hoy);
      hace7dias.setDate(hace7dias.getDate() - 6);
      fechaDesde.value = formatearFechaInput(hace7dias);
      fechaHasta.value = obtenerFechaLocal();
      break;
    case "este-mes":
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fechaDesde.value = formatearFechaInput(primerDiaMes);
      fechaHasta.value = obtenerFechaLocal();
      break;
    case "limpiar":
      fechaDesde.value = "";
      fechaHasta.value = "";
      break;
  }

  // Cargar ventas con el nuevo filtro
  cargarVentas();
}

// ===== Cargar ventas de hoy (por defecto) =====
async function cargarVentasHoy() {
  const hoy = obtenerFechaLocal();
  await cargarVentas(hoy, hoy);
}

// ===== Cargar ventas con filtros =====
async function cargarVentas(desde = null, hasta = null) {
  const fechaDesde = desde || document.getElementById("fecha-desde").value;
  const fechaHasta = hasta || document.getElementById("fecha-hasta").value;

  try {
    // Si es CASHIER, filtrar por su propio user_id
    const userIdFiltro = usuarioActual.role === "CASHIER" ? usuarioActual.id : null;

    // Si los campos están vacíos, pasar null para que el backend no filtre por fecha
    const desdeParam = fechaDesde || null;
    const hastaParam = fechaHasta || null;

    ventasActuales = await obtenerVentas(desdeParam, hastaParam, userIdFiltro);
    renderizarTabla(ventasActuales);
    actualizarResumen(ventasActuales);
  } catch (error) {
    console.error("Error al cargar ventas:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar las ventas"
    });
  }
}

// ===== Renderizar tabla de ventas =====
function renderizarTabla(ventas) {
  const tbody = document.getElementById("tabla-ventas-body");
  const mensajeVacio = document.getElementById("mensaje-vacio");

  tbody.innerHTML = "";

  if (!ventas || ventas.length === 0) {
    mensajeVacio.style.display = "block";
    return;
  }

  mensajeVacio.style.display = "none";

  ventas.forEach(venta => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${formatearFechaHora(venta.created_at)}</td>
      <td>${venta.seller}</td>
      <td>${venta.customer_name || "Sin cliente"}</td>
      <td>$${formatearNumero(venta.total)}</td>
      <td><span class="estado-badge estado-${venta.status.toLowerCase()}">${venta.status}</span></td>
      <td>
        <button class="btn-ver-detalle" data-sale-id="${venta.id}">
          <i class="bi bi-eye"></i>
          Ver detalle
        </button>
      </td>
    `;
    tbody.appendChild(fila);
  });

  // Agregar event listeners a los botones de detalle
  document.querySelectorAll(".btn-ver-detalle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const saleId = e.currentTarget.dataset.saleId;
      mostrarDetalleVenta(saleId);
    });
  });
}

// ===== Mostrar detalle de venta =====
async function mostrarDetalleVenta(saleId) {
  try {
    const detalle = await obtenerDetalleVenta(saleId);
    const venta = detalle.venta;
    const items = detalle.items;

    let itemsHtml = items.map(item => `
      <div class="detalle-item">
        <span class="item-nombre">${item.product_name}</span>
        <span class="item-cantidad">x${item.quantity}</span>
        <span class="item-precio">$${formatearNumero(item.unit_price)}</span>
        <span class="item-subtotal">$${formatearNumero(item.subtotal)}</span>
      </div>
    `).join("");

    Swal.fire({
      title: `Detalle de Venta #${venta.id}`,
      html: `
        <div class="detalle-venta">
          <div class="detalle-info">
            <p><strong>Fecha:</strong> ${formatearFechaHora(venta.created_at)}</p>
            <p><strong>Vendedor:</strong> ${venta.seller}</p>
            <p><strong>Cliente:</strong> ${venta.customer_name || "Sin cliente"}</p>
            <p><strong>Estado:</strong> ${venta.status}</p>
          </div>
          <div class="detalle-items">
            <h4>Items:</h4>
            ${itemsHtml}
          </div>
          <div class="detalle-total">
            <strong>Total: $${formatearNumero(venta.total)}</strong>
          </div>
        </div>
      `,
      width: "600px",
      customClass: {
        popup: "swal-popup-detalle"
      }
    });
  } catch (error) {
    console.error("Error al cargar detalle:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo cargar el detalle de la venta"
    });
  }
}

// ===== Actualizar resumen de ventas =====
function actualizarResumen(ventas) {
  const resumenTexto = document.getElementById("resumen-texto");
  
  if (!ventas || ventas.length === 0) {
    resumenTexto.textContent = "0 ventas — Total: $0";
    return;
  }

  const totalVentas = ventas.reduce((sum, venta) => sum + parseFloat(venta.total), 0);
  const conteo = ventas.length;
  
  resumenTexto.textContent = `${conteo} venta${conteo !== 1 ? 's' : ''} — Total: $${formatearNumero(totalVentas)}`;
}

// ===== Utilidades =====
function formatearNumero(valor) {
  return Number(valor).toLocaleString("es-CO");
}

function formatearFechaHora(fechaIso) {
  if (!fechaIso) {
    return "Sin fecha";
  }
  
  const fecha = new Date(fechaIso);
  
  if (isNaN(fecha.getTime())) {
    return "Fecha inválida";
  }
  
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function obtenerFechaLocal() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatearFechaInput(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
