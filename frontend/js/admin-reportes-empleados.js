// Reportes de empleados - Mundo Tech POS (Solo ADMIN)

// ===== Estado global =====
let usuarioActual = null;
let reporteActual = null;

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", async () => {
  await verificarSesion();
  configurarFiltros();
  cargarReporteHoy();
});

// ===== Verificar sesión =====
async function verificarSesion() {
  try {
    usuarioActual = await obtenerSesionActual();
    if (!usuarioActual) {
      window.location.href = "login.html";
      return;
    }
    
    // NOTA: La verificación de rol y configuración del sidebar se manejan en sidebar.js
    // No es necesario configurarlos aquí
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

  // Establecer fecha de hoy por defecto
  const hoy = obtenerFechaLocal();
  fechaDesde.value = hoy;
  fechaHasta.value = hoy;

  btnFiltrar.addEventListener("click", () => {
    cargarReporte();
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

  // Cargar reporte con el nuevo filtro
  cargarReporte();
}

// ===== Cargar reporte de hoy (por defecto) =====
async function cargarReporteHoy() {
  const hoy = obtenerFechaLocal();
  await cargarReporte(hoy, hoy);
}

// ===== Cargar reporte con filtros =====
async function cargarReporte(desde = null, hasta = null) {
  const fechaDesde = desde || document.getElementById("fecha-desde").value;
  const fechaHasta = hasta || document.getElementById("fecha-hasta").value;

  try {
    // Si los campos están vacíos, pasar null para que el backend use hoy por defecto
    const desdeParam = fechaDesde || null;
    const hastaParam = fechaHasta || null;

    reporteActual = await obtenerReportesEmpleados(desdeParam, hastaParam);
    renderizarReporte(reporteActual);
    const comisiones = await obtenerComisionesEmpleados(desdeParam, hastaParam);
    renderizarComisiones(comisiones);
  } catch (error) {
    console.error("Error al cargar reporte:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar los reportes de empleados"
    });
  }

  function renderizarComisiones(reporte) {
    const formatoMoneda = amount => new Intl.NumberFormat("es-CO", {
      style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
    const total = document.getElementById("total-comisiones-texto");
    const grid = document.getElementById("comisiones-grid");
    const vacio = document.getElementById("mensaje-comisiones-vacio");
    total.textContent = `Total de comisiones: ${formatoMoneda(reporte.total_general)}`;
    grid.innerHTML = "";

    if (!reporte.empleados || reporte.empleados.length === 0) {
      vacio.style.display = "block";
      return;
    }
    vacio.style.display = "none";
    reporte.empleados.forEach(empleado => {
      const tarjeta = document.createElement("div");
      tarjeta.className = "empleado-card";
      tarjeta.innerHTML = `
        <div class="empleado-header">
          <i class="bi bi-person-circle"></i>
          <h3>${empleado.username}</h3>
        </div>
        <div class="empleado-total">
          <p>Total comisión</p>
          <p class="monto-grande">${formatoMoneda(empleado.total_comision)}</p>
        </div>
        <div class="empleado-desglose">
          <h4>Desglose por producto</h4>
          ${empleado.desglose.filter(item => item.comision_generada > 0).map(item => `
            <div class="desglose-item">
              <span>${item.product_name} (${item.cantidad_vendida})</span>
              <span>${formatoMoneda(item.comision_generada)}</span>
            </div>
          `).join("")}
        </div>
      `;
      grid.appendChild(tarjeta);
    });
  }
}

// ===== Renderizar reporte =====
function renderizarReporte(reporte) {
  const totalGeneralTexto = document.getElementById("total-general-texto");
  const empleadosGrid = document.getElementById("empleados-grid");
  const mensajeVacio = document.getElementById("mensaje-vacio");

  // Actualizar total general
  const formatoMoneda = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatoFechaHora = (fechaIso) => {
    if (!fechaIso) return "Sin fecha";
    const fecha = new Date(fechaIso);
    return fecha.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  totalGeneralTexto.textContent = `Total del período: ${formatoMoneda(reporte.total_general)} (${reporte.total_cierres} cierre${reporte.total_cierres !== 1 ? 's' : ''})`;

  // Limpiar grid
  empleadosGrid.innerHTML = "";

  if (!reporte.cierres || reporte.cierres.length === 0) {
    mensajeVacio.style.display = "block";
    return;
  }

  mensajeVacio.style.display = "none";

  // Crear tarjeta por cada cierre individual
  reporte.cierres.forEach(cierre => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "empleado-card";
    tarjeta.innerHTML = `
      <div class="empleado-header">
        <i class="bi bi-person-circle"></i>
        <h3>${cierre.username}</h3>
        <span class="cierre-fecha">${formatoFechaHora(cierre.closed_at)}</span>
      </div>
      <div class="empleado-total">
        <p>Total del cierre</p>
        <p class="monto-grande">${formatoMoneda(cierre.total_ventas)}</p>
      </div>
      <div class="empleado-transacciones">
        <p><strong>${cierre.cantidad_transacciones}</strong> transacción${cierre.cantidad_transacciones !== 1 ? 'es' : ''}</p>
      </div>
      <div class="empleado-desglose">
        <h4>Desglose por método de pago</h4>
        <div class="desglose-item">
          <i class="bi bi-cash-stack"></i>
          <span>Efectivo:</span>
          <span>${formatoMoneda(cierre.desglose_pagos.CASH)}</span>
        </div>
        <div class="desglose-item">
          <i class="bi bi-credit-card"></i>
          <span>Tarjeta:</span>
          <span>${formatoMoneda(cierre.desglose_pagos.CARD)}</span>
        </div>
        <div class="desglose-item">
          <i class="bi bi-bank"></i>
          <span>Transferencia:</span>
          <span>${formatoMoneda(cierre.desglose_pagos.TRANSFER)}</span>
        </div>
      </div>
    `;
    empleadosGrid.appendChild(tarjeta);
  });
}

// ===== Utilidades =====
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