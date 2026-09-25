// Citas - Gestión CRUD de citas
let citas = [];
let clientes = [];
let productos = [];
let citaEditando = null;
let citaConvertir = null;
let metodosPago = {};
let mapaMetodosPago = {};

// --- Referencias del DOM ---
const elTablaCitas = document.getElementById("tabla-citas-body");
const elFechaDesde = document.getElementById("fecha-desde");
const elFechaHasta = document.getElementById("fecha-hasta");
const elFiltroEstado = document.getElementById("filtro-estado");
const elBtnFiltrar = document.getElementById("btn-filtrar");
const elBtnAgregar = document.getElementById("btn-agregar-cita");
const elModalCita = document.getElementById("modal-cita");
const elModalCitaTitulo = document.getElementById("modal-cita-titulo");
const elFormCita = document.getElementById("form-cita");
const elCitaId = document.getElementById("cita-id");
const elCitaCliente = document.getElementById("cita-cliente");
const elCitaTelefono = document.getElementById("cita-telefono");
const elCitaFecha = document.getElementById("cita-fecha");
const elCitaHora = document.getElementById("cita-hora");
const elCitaServicio = document.getElementById("cita-servicio");
const elCitaPrecio = document.getElementById("cita-precio");
const elCitaAnticipo = document.getElementById("cita-anticipo");
const elCitaMetodoAnticipo = document.getElementById("cita-metodo-anticipo");
const elGrupoMetodoAnticipo = document.getElementById("grupo-metodo-anticipo");
const elCitaNotas = document.getElementById("cita-notas");
const elModalCitaClose = document.getElementById("modal-cita-close");
const elBtnCancelarCita = document.getElementById("btn-cancelar-cita");

// Modal convertir venta
const elModalConvertir = document.getElementById("modal-convertir-venta");
const elModalConvertirClose = document.getElementById("modal-convertir-close");
const elFormConvertir = document.getElementById("form-convertir-venta");
const elConvertirCitaId = document.getElementById("convertir-cita-id");
const elConvertirCliente = document.getElementById("convertir-cliente");
const elConvertirServicio = document.getElementById("convertir-servicio");
const elInfoAnticipo = document.getElementById("info-anticipo");
const elConvertirAnticipo = document.getElementById("convertir-anticipo");
const elConvertirProducto = document.getElementById("convertir-producto");
const elConvertirCantidad = document.getElementById("convertir-cantidad");
const elConvertirTotalProducto = document.getElementById("convertir-total-producto");
const elInfoSaldoPendiente = document.getElementById("info-saldo-pendiente");
const elConvertirSaldo = document.getElementById("convertir-saldo");
const elConvertirMetodoPago = document.getElementById("convertir-metodo-pago");
const elConvertirTelefono = document.getElementById("convertir-telefono");
const elBtnCancelarConvertir = document.getElementById("btn-cancelar-convertir");

// ===== Inicio =====
async function iniciar() {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    window.location.href = "login.html";
    return;
  }

  // NOTA: El sidebar y navegación se manejan en sidebar.js
  // No es necesario configurarlos aquí

  try {
    // Cargar clientes para el selector
    clientes = await obtenerClientes();
    cargarSelectorClientes();

    // Cargar productos para el selector de conversión
    productos = await obtenerProductos();
    cargarSelectorProductos();

    // Cargar métodos de pago para el anticipo
    await cargarMetodosPago();

    // Configurar filtros
    configurarFiltros();

    // Configurar evento de cambio en anticipo
    configurarEventoAnticipo();

    // Configurar eventos del modal de conversión
    configurarEventosConvertir();

    // Cargar todas las citas sin filtro por defecto
    cargarCitas();
  } catch (error) {
    elTablaCitas.innerHTML = `<tr><td colspan="9" class="carrito-vacio">No se pudo cargar las citas: ${error.message}</td></tr>`;
  }
}

// ===== Configurar filtros de fecha =====
function configurarFiltros() {
  const btnFiltrar = document.getElementById("btn-filtrar");

  // NO establecer fecha por defecto - dejar campos vacíos para mostrar todas las citas
  elFechaDesde.value = "";
  elFechaHasta.value = "";
  elFiltroEstado.value = "";

  btnFiltrar.addEventListener("click", () => {
    cargarCitas();
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
  const hoy = new Date();

  switch (periodo) {
    case "hoy":
      elFechaDesde.value = obtenerFechaLocal();
      elFechaHasta.value = obtenerFechaLocal();
      break;
    case "ayer":
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      elFechaDesde.value = formatearFechaInput(ayer);
      elFechaHasta.value = formatearFechaInput(ayer);
      break;
    case "ultimos7":
      const hace7dias = new Date(hoy);
      hace7dias.setDate(hace7dias.getDate() - 6);
      elFechaDesde.value = formatearFechaInput(hace7dias);
      elFechaHasta.value = obtenerFechaLocal();
      break;
    case "este-mes":
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      elFechaDesde.value = formatearFechaInput(primerDiaMes);
      elFechaHasta.value = obtenerFechaLocal();
      break;
    case "limpiar":
      elFechaDesde.value = "";
      elFechaHasta.value = "";
      elFiltroEstado.value = "";
      break;
  }

  // Cargar citas con el nuevo filtro
  cargarCitas();
}

// ===== Cargar citas =====
async function cargarCitas(desde = null, hasta = null) {
  const fechaDesde = desde || elFechaDesde.value;
  const fechaHasta = hasta || elFechaHasta.value;

  const filtros = {};
  if (fechaDesde) filtros.from = fechaDesde;
  if (fechaHasta) filtros.to = fechaHasta;
  if (elFiltroEstado.value) filtros.status = elFiltroEstado.value;

  try {
    citas = await obtenerCitas(filtros);
    renderizarTablaCitas();
  } catch (error) {
    elTablaCitas.innerHTML = `<tr><td colspan="9" class="carrito-vacio">Error al cargar citas: ${error.message}</td></tr>`;
  }
}

// ===== Cargar selector de clientes =====
function cargarSelectorClientes() {
  // Mantener la opción por defecto
  elCitaCliente.innerHTML = '<option value="">Seleccionar cliente...</option>';

  clientes.forEach(cliente => {
    const option = document.createElement("option");
    option.value = cliente.id;
    option.textContent = cliente.name;
    option.dataset.phone = cliente.phone || "";
    elCitaCliente.appendChild(option);
  });

  // Evento para mostrar teléfono cuando se selecciona cliente
  elCitaCliente.addEventListener("change", () => {
    const selectedOption = elCitaCliente.options[elCitaCliente.selectedIndex];
    if (selectedOption && selectedOption.dataset.phone) {
      elCitaTelefono.value = selectedOption.dataset.phone;
    } else {
      elCitaTelefono.value = "";
    }
  });
}

// ===== Cargar selector de productos =====
function cargarSelectorProductos() {
  elConvertirProducto.innerHTML = '<option value="">Seleccionar producto...</option>';
  productos.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} - $${formatearNumero(p.sale_price)} (Stock: ${p.stock})`;
    option.dataset.price = p.sale_price;
    option.dataset.stock = p.stock;
    elConvertirProducto.appendChild(option);
  });
}

// ===== Cargar métodos de pago =====
async function cargarMetodosPago() {
  const res = await fetch(`${API_BASE}/payment_methods`, { credentials: "include" });
  metodosPago = await res.json();

  // Llenar selector de método de anticipo
  elCitaMetodoAnticipo.innerHTML = '<option value="">Seleccionar método...</option>';
  metodosPago.forEach(m => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.name;
    elCitaMetodoAnticipo.appendChild(option);
    // Crear mapa para referencia
    mapaMetodosPago[m.name] = m.id;
  });

  // Llenar selector de método de pago para conversión
  elConvertirMetodoPago.innerHTML = '<option value="">Seleccionar método...</option>';
  metodosPago.forEach(m => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.name;
    elConvertirMetodoPago.appendChild(option);
  });
}

// ===== Configurar evento de cambio en anticipo =====
function configurarEventoAnticipo() {
  elCitaAnticipo.addEventListener("input", () => {
    const anticipo = parseFloat(elCitaAnticipo.value) || 0;
    if (anticipo > 0) {
      elGrupoMetodoAnticipo.style.display = "block";
      elCitaMetodoAnticipo.required = true;
    } else {
      elGrupoMetodoAnticipo.style.display = "none";
      elCitaMetodoAnticipo.required = false;
      elCitaMetodoAnticipo.value = "";
    }
  });
}

// ===== Configurar eventos del modal de conversión =====
function configurarEventosConvertir() {
  elModalConvertirClose.addEventListener("click", cerrarModalConvertir);
  elBtnCancelarConvertir.addEventListener("click", cerrarModalConvertir);

  // Evento de cambio en producto
  elConvertirProducto.addEventListener("change", () => {
    calcularTotalesConversion();
  });

  // Evento de cambio en cantidad
  elConvertirCantidad.addEventListener("input", () => {
    calcularTotalesConversion();
  });

  // Evento de submit
  elFormConvertir.addEventListener("submit", async (e) => {
    e.preventDefault();
    await convertirCitaEnVenta();
  });
}

// ===== Calcular totales en conversión =====
function calcularTotalesConversion() {
  const productoId = elConvertirProducto.value;
  const cantidad = parseInt(elConvertirCantidad.value) || 1;

  if (!productoId) {
    elConvertirTotalProducto.value = "";
    elConvertirSaldo.value = "";
    return;
  }

  const producto = productos.find(p => p.id === productoId);
  if (!producto) return;

  const totalProducto = producto.sale_price * cantidad;
  elConvertirTotalProducto.value = totalProducto;

  // Calcular saldo pendiente si hay anticipo
  if (citaConvertir && citaConvertir.anticipo_monto && citaConvertir.anticipo_monto > 0) {
    const saldoPendiente = totalProducto - citaConvertir.anticipo_monto;
    elConvertirSaldo.value = saldoPendiente;
  } else {
    elConvertirSaldo.value = "";
  }
}

// ===== Abrir modal de conversión =====
function abrirModalConvertirVenta(cita) {
  citaConvertir = cita;
  elConvertirCitaId.value = cita.id;
  elConvertirCliente.value = cita.customer_name;
  elConvertirServicio.value = cita.service_name;
  elConvertirTelefono.value = cita.customer_phone || "No disponible";

  // Mostrar anticipo si existe
  if (cita.anticipo_monto && cita.anticipo_monto > 0) {
    elInfoAnticipo.style.display = "block";
    elConvertirAnticipo.value = `$${formatearNumero(cita.anticipo_monto)}`;
    elInfoSaldoPendiente.style.display = "block";
  } else {
    elInfoAnticipo.style.display = "none";
    elConvertirAnticipo.value = "";
    elInfoSaldoPendiente.style.display = "none";
  }

  // Resetear campos
  elConvertirProducto.value = "";
  elConvertirCantidad.value = 1;
  elConvertirTotalProducto.value = "";
  elConvertirSaldo.value = "";
  elConvertirMetodoPago.value = "";
  elConvertirTelefono.value = "";

  elModalConvertir.classList.add("active");
}

// ===== Cerrar modal de conversión =====
function cerrarModalConvertir() {
  elModalConvertir.classList.remove("active");
  citaConvertir = null;
  elFormConvertir.reset();
}

// ===== Convertir cita en venta =====
async function convertirCitaEnVenta() {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    window.location.href = "login.html";
    return;
  }

  const productoId = elConvertirProducto.value;
  const cantidad = parseInt(elConvertirCantidad.value) || 1;
  const metodoPagoId = elConvertirMetodoPago.value;
  const totalProducto = parseFloat(elConvertirTotalProducto.value) || 0;
  const saldoPendiente = parseFloat(elConvertirSaldo.value) || 0;

  if (!productoId) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Debes seleccionar un producto'
    });
    return;
  }

  if (!metodoPagoId) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Debes seleccionar un método de pago'
    });
    return;
  }

  if (totalProducto <= 0) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'El total del producto debe ser mayor a 0'
    });
    return;
  }

  // Calcular pagos basado en los valores editables
  const pagos = [];
  if (citaConvertir.anticipo_monto && citaConvertir.anticipo_monto > 0) {
    // Usar el saldo pendiente editable
    pagos.push({
      payment_method_id: metodoPagoId,
      amount: saldoPendiente
    });
  } else {
    // Si no hay anticipo, cobrar el total completo
    pagos.push({
      payment_method_id: metodoPagoId,
      amount: totalProducto
    });
  }

  const datos = {
    user_id: sesion.id,
    items: [{
      product_id: productoId,
      quantity: cantidad
    }],
    payments: pagos
  };

  try {
    const res = await fetch(`${API_BASE}/appointments/${citaConvertir.id}/convertir-a-venta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(datos)
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al convertir cita en venta');
    }

    const resultado = await res.json();

    Swal.fire({
      icon: 'success',
      title: 'Venta registrada',
      text: `Total: $${formatearNumero(resultado.total)}`
    });

    cerrarModalConvertir();
    await cargarCitas();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.message
    });
  }
}

// ===== Renderizar tabla de citas =====
function renderizarTablaCitas() {
  if (citas.length === 0) {
    elTablaCitas.innerHTML = `<tr><td colspan="9" class="carrito-vacio">No hay citas para los filtros seleccionados</td></tr>`;
    return;
  }

  elTablaCitas.innerHTML = citas.map(c => `
    <tr data-id="${c.id}">
      <td>${formatearFecha(c.appointment_date)}</td>
      <td>${formatearHora(c.appointment_time)}</td>
      <td>${c.customer_name}</td>
      <td>${c.phone || c.customer_phone || '-'}</td>
      <td>${c.service_name}</td>
      <td>${c.price ? '$' + formatearNumero(c.price) : '-'}</td>
      <td>
        ${c.anticipo_monto && c.anticipo_monto > 0
          ? `<span style="color: #16a34a; font-weight: bold;">$${formatearNumero(c.anticipo_monto)} ✓</span>`
          : '-'}
      </td>
      <td><span class="estado-badge estado-${c.status.toLowerCase()}">${c.status}</span></td>
      <td>
        <button class="btn-accion editar" data-id="${c.id}">
          <i class="bi bi-pencil"></i>
        </button>
        ${(c.status === 'PENDIENTE' || c.status === 'CONFIRMADA') ? `
        <button class="btn-accion convertir" data-id="${c.id}">
          <i class="bi bi-cash-coin"></i>
        </button>
        ` : ''}
        <button class="btn-accion estado" data-id="${c.id}">
          <i class="bi bi-arrow-repeat"></i>
        </button>
        <button class="btn-accion eliminar" data-id="${c.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");

  // Evento editar
  elTablaCitas.querySelectorAll(".editar").forEach(btn => {
    btn.addEventListener("click", () => {
      const cita = citas.find(c => c.id === btn.dataset.id);
      abrirModalEditar(cita);
    });
  });

  // Evento convertir en venta
  elTablaCitas.querySelectorAll(".convertir").forEach(btn => {
    btn.addEventListener("click", () => {
      const cita = citas.find(c => c.id === btn.dataset.id);
      abrirModalConvertirVenta(cita);
    });
  });

  // Evento cambiar estado
  elTablaCitas.querySelectorAll(".estado").forEach(btn => {
    btn.addEventListener("click", () => {
      const cita = citas.find(c => c.id === btn.dataset.id);
      mostrarMenuEstado(cita);
    });
  });

  // Evento eliminar
  elTablaCitas.querySelectorAll(".eliminar").forEach(btn => {
    btn.addEventListener("click", () => {
      const cita = citas.find(c => c.id === btn.dataset.id);
      Swal.fire({
        title: '¿Eliminar cita?',
        text: `¿Seguro que deseas eliminar la cita de "${cita.customer_name}"? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await eliminarCita(cita.id);
            Swal.fire({
              icon: 'success',
              title: 'Cita eliminada',
              text: 'Cita eliminada correctamente'
            });
            await cargarCitas();
          } catch (error) {
            if (error.status === 409) {
              Swal.fire({
                icon: 'warning',
                title: 'No se puede eliminar',
                text: error.message
              });
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Error: ${error.message}`
              });
            }
          }
        }
      });
    });
  });
}



// ===== Modal agregar/editar =====
function abrirModalCrear() {
  citaEditando = null;
  elModalCitaTitulo.textContent = "Nueva cita";
  elFormCita.reset();
  elCitaId.value = "";

  // Establecer fecha de hoy por defecto (usando fecha local, no UTC)
  const hoy = obtenerFechaLocal();
  // Usar valueAsDate con objeto Date local a mediodía para evitar conversión UTC
  const fechaLocal = new Date(hoy + 'T12:00:00');
  elCitaFecha.valueAsDate = fechaLocal;

  // Resetear campos de anticipo
  elGrupoMetodoAnticipo.style.display = "none";
  elCitaMetodoAnticipo.required = false;

  elModalCita.classList.add("active");
}

function abrirModalEditar(cita) {
  citaEditando = cita;
  elModalCitaTitulo.textContent = "Editar cita";
  elCitaId.value = cita.id;
  elCitaCliente.value = cita.customer_id;
  elCitaTelefono.value = cita.phone || cita.customer_phone || "";

  // Asegurar formato exacto YYYY-MM-DD para el input type="date"
  const fechaBackend = cita.appointment_date;
  // Si ya es string, usarlo directamente; si es date, convertirlo
  const fechaInput = typeof fechaBackend === 'string' ? fechaBackend : fechaBackend.toISOString().split('T')[0];
  // Usar valueAsDate con objeto Date local a mediodía para evitar conversión UTC
  const fechaLocal = new Date(fechaInput + 'T12:00:00');
  elCitaFecha.valueAsDate = fechaLocal;

  elCitaHora.value = cita.appointment_time;
  elCitaServicio.value = cita.service_name;
  elCitaPrecio.value = cita.price || "";
  elCitaAnticipo.value = cita.anticipo_monto || "";
  elCitaMetodoAnticipo.value = cita.anticipo_payment_method_id || "";
  elCitaNotas.value = cita.notes || "";

  // Mostrar método de anticipo si hay anticipo
  if (cita.anticipo_monto && cita.anticipo_monto > 0) {
    elGrupoMetodoAnticipo.style.display = "block";
    elCitaMetodoAnticipo.required = true;
  } else {
    elGrupoMetodoAnticipo.style.display = "none";
    elCitaMetodoAnticipo.required = false;
  }

  elModalCita.classList.add("active");
}

function cerrarModalCita() {
  elModalCita.classList.remove("active");
  citaEditando = null;
  elFormCita.reset();
  // Resetear campos de anticipo
  elGrupoMetodoAnticipo.style.display = "none";
  elCitaMetodoAnticipo.required = false;
}

elBtnAgregar.addEventListener("click", abrirModalCrear);
elModalCitaClose.addEventListener("click", cerrarModalCita);
elBtnCancelarCita.addEventListener("click", cerrarModalCita);

elFormCita.addEventListener("submit", async (e) => {
  e.preventDefault();

  const datos = {
    customer_id: elCitaCliente.value,
    appointment_date: elCitaFecha.value, // Enviar exactamente como viene del input, sin transformaciones
    appointment_time: elCitaHora.value,
    service_name: elCitaServicio.value.trim(),
    price: elCitaPrecio.value ? parseFloat(elCitaPrecio.value) : null,
    notes: elCitaNotas.value.trim(),
    phone: elCitaTelefono.value.trim(),
    anticipo_monto: elCitaAnticipo.value ? parseFloat(elCitaAnticipo.value) : 0,
    anticipo_payment_method_id: elCitaAnticipo.value && parseFloat(elCitaAnticipo.value) > 0 ? elCitaMetodoAnticipo.value : null
  };

  try {
    if (citaEditando) {
      await editarCita(citaEditando.id, datos);
      Swal.fire({
        icon: 'success',
        title: 'Cita actualizada',
        text: 'Cita actualizada correctamente'
      });
      // MANTENER el filtro actual después de editar para consistencia
      // Solo limpiar el filtro si la fecha cambió y el filtro estaba activo
      if (elFechaDesde.value && citaEditando.appointment_date !== datos.appointment_date) {
        elFechaDesde.value = ""; // Limpiar filtro si la fecha cambió
        elFechaHasta.value = "";
      }
    } else {
      await crearCita(datos);
      Swal.fire({
        icon: 'success',
        title: 'Cita creada',
        text: 'Cita creada correctamente'
      });
    }

    cerrarModalCita();
    await cargarCitas();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error: ${error.message}`
    });
  }
});

// ===== Cambiar estado =====
function mostrarMenuEstado(cita) {
  const estados = [
    { value: 'PENDIENTE', label: 'Pendiente', color: '#d97706' },
    { value: 'CONFIRMADA', label: 'Confirmada', color: '#2563eb' },
    // COMPLETADA solo se asigna automáticamente al convertir la cita en venta
    { value: 'CANCELADA', label: 'Cancelada', color: '#dc2626' },
    { value: 'NO_ASISTIO', label: 'No asistió', color: '#9333ea' }
  ];

  const html = estados.map(e => 
    `<button class="swal2-styled" style="background-color: ${e.color}; margin: 4px;" onclick="cambiarEstado('${cita.id}', '${e.value}')">${e.label}</button>`
  ).join('');

  Swal.fire({
    title: 'Cambiar estado de cita',
    html: `<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">${html}</div>`,
    showConfirmButton: false,
    showCloseButton: true
  });
}

// Función global para ser llamada desde el HTML del modal
window.cambiarEstado = async function(citaId, nuevoEstado) {
  Swal.close();
  
  try {
    await cambiarEstadoCita(citaId, nuevoEstado);
    Swal.fire({
      icon: 'success',
      title: 'Estado actualizado',
      text: `Cita cambiada a ${nuevoEstado}`
    });
    await cargarCitas();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error: ${error.message}`
    });
  }
};

// ===== Utilidades =====
function formatearNumero(valor) {
  return Number(valor).toLocaleString("es-CO");
}

function formatearFecha(fecha) {
  if (!fecha) return '-';
  // Forzar interpretación local agregando T00:00:00 para evitar conversión UTC
  const date = new Date(fecha + 'T00:00:00');
  return date.toLocaleDateString("es-CO", { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatearHora(hora) {
  if (!hora) return '-';
  const [hours, minutes] = hora.split(':');
  const hourNum = parseInt(hours, 10);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const hour12 = hourNum % 12 || 12; // Convert 0 to 12 for midnight
  return `${hour12}:${minutes} ${ampm}`;
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

iniciar();
