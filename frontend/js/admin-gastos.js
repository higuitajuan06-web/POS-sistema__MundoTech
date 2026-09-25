let gastos = [];
const el = (id) => document.getElementById(id);

function fechaLocal() {
  return new Date().toLocaleDateString("en-CA");
}

function formatearMonto(valor) {
  return Number(valor).toLocaleString("es-CO", { minimumFractionDigits: 2 });
}

function escaparHtml(valor) {
  const div = document.createElement("div");
  div.textContent = valor == null ? "" : String(valor);
  return div.innerHTML;
}

async function iniciarGastos() {
  const sesion = await obtenerSesionActual();
  if (!sesion || sesion.role !== "ADMIN") {
    window.location.href = "index.html";
    return;
  }
  el("gasto-fecha").value = fechaLocal();
  configurarFiltros();
  await cargarGastos();
}

function configurarFiltros() {
  el("btn-filtrar").addEventListener("click", cargarGastos);
  document.querySelectorAll(".btn-rapido").forEach((boton) => {
    boton.addEventListener("click", () => aplicarPeriodoRapido(boton.dataset.periodo));
  });
  el("btn-agregar-gasto").addEventListener("click", () => abrirModal());
  el("modal-gasto-close").addEventListener("click", cerrarModal);
  el("btn-cancelar-gasto").addEventListener("click", cerrarModal);
  el("form-gasto").addEventListener("submit", guardarGasto);
}

function aplicarPeriodoRapido(periodo) {
  const hoy = new Date();
  const formato = (fecha) => fecha.toLocaleDateString("en-CA");
  if (periodo === "limpiar") {
    el("fecha-desde").value = "";
    el("fecha-hasta").value = "";
  } else if (periodo === "hoy") {
    el("fecha-desde").value = formato(hoy);
    el("fecha-hasta").value = formato(hoy);
  } else if (periodo === "ayer") {
    hoy.setDate(hoy.getDate() - 1);
    el("fecha-desde").value = formato(hoy);
    el("fecha-hasta").value = formato(hoy);
  } else if (periodo === "ultimos7") {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 6);
    el("fecha-desde").value = formato(inicio);
    el("fecha-hasta").value = formato(hoy);
  } else if (periodo === "este-mes") {
    el("fecha-desde").value = formato(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    el("fecha-hasta").value = formato(hoy);
  }
  cargarGastos();
}

async function cargarGastos() {
  const filtros = {
    from: el("fecha-desde").value,
    to: el("fecha-hasta").value,
    estado: el("filtro-estado").value
  };
  try {
    gastos = await obtenerGastos(filtros);
    renderizarGastos();
  } catch (error) {
    el("tabla-gastos-body").innerHTML =
      `<tr><td colspan="6" class="carrito-vacio">Error al cargar gastos: ${escaparHtml(error.message)}</td></tr>`;
  }
}

function renderizarGastos() {
  if (!gastos.length) {
    el("tabla-gastos-body").innerHTML =
      '<tr><td colspan="6" class="carrito-vacio">No hay gastos para los filtros seleccionados.</td></tr>';
    return;
  }
  el("tabla-gastos-body").innerHTML = gastos.map((gasto) => `
    <tr>
      <td>${escaparHtml(gasto.concepto)}${gasto.nota ? `<br><small>${escaparHtml(gasto.nota)}</small>` : ""}</td>
      <td>$${formatearMonto(gasto.monto)}</td>
      <td>${escaparHtml(gasto.fecha)}</td>
      <td>${escaparHtml(gasto.categoria || "-")}</td>
      <td><span class="estado-badge estado-${gasto.estado.toLowerCase()}">${gasto.estado === "PAGADO" ? "Pagado" : "Pendiente"}</span></td>
      <td>
        <button class="btn-accion editar" data-accion="editar" data-id="${gasto.id}"><i class="bi bi-pencil"></i> Editar</button>
        ${gasto.estado === "PENDIENTE" ? `<button class="btn-accion pagar" data-accion="pagar" data-id="${gasto.id}"><i class="bi bi-check2-circle"></i> Marcar pagado</button>` : ""}
        <button class="btn-accion eliminar" data-accion="eliminar" data-id="${gasto.id}"><i class="bi bi-trash"></i> Eliminar</button>
      </td>
    </tr>
  `).join("");
  el("tabla-gastos-body").querySelectorAll("button").forEach((boton) => {
    boton.addEventListener("click", () => ejecutarAccion(boton.dataset.accion, boton.dataset.id));
  });
}

function abrirModal(gasto = null) {
  el("modal-gasto-titulo").textContent = gasto ? "Editar gasto" : "Nuevo gasto";
  el("gasto-id").value = gasto ? gasto.id : "";
  el("gasto-concepto").value = gasto ? gasto.concepto : "";
  el("gasto-monto").value = gasto ? gasto.monto : "";
  el("gasto-fecha").value = gasto ? gasto.fecha : fechaLocal();
  el("gasto-categoria").value = gasto ? gasto.categoria || "" : "";
  el("gasto-estado").value = gasto ? gasto.estado : "PENDIENTE";
  el("gasto-nota").value = gasto ? gasto.nota || "" : "";
  el("modal-gasto").classList.add("active");
}

function cerrarModal() {
  el("modal-gasto").classList.remove("active");
}

async function guardarGasto(evento) {
  evento.preventDefault();
  const datos = {
    concepto: el("gasto-concepto").value,
    monto: el("gasto-monto").value,
    fecha: el("gasto-fecha").value,
    categoria: el("gasto-categoria").value,
    estado: el("gasto-estado").value,
    nota: el("gasto-nota").value
  };
  try {
    if (el("gasto-id").value) {
      await editarGasto(el("gasto-id").value, datos);
    } else {
      await crearGasto(datos);
    }
    cerrarModal();
    await cargarGastos();
    Swal.fire({ icon: "success", title: "Gasto guardado", timer: 1500, showConfirmButton: false });
  } catch (error) {
    Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message });
  }
}

async function ejecutarAccion(accion, id) {
  const gasto = gastos.find((item) => item.id === id);
  if (!gasto) return;
  if (accion === "editar") {
    abrirModal(gasto);
    return;
  }
  if (accion === "pagar") {
    const confirmacion = await Swal.fire({
      icon: "question",
      title: "¿Marcar gasto como pagado?",
      showCancelButton: true,
      confirmButtonText: "Sí, marcar pagado",
      cancelButtonText: "Cancelar"
    });
    if (!confirmacion.isConfirmed) return;
    try {
      await editarGasto(id, { ...gasto, estado: "PAGADO" });
      await cargarGastos();
    } catch (error) {
      Swal.fire({ icon: "error", title: "No se pudo actualizar", text: error.message });
    }
    return;
  }
  const confirmacion = await Swal.fire({
    icon: "warning",
    title: "¿Eliminar este gasto?",
    text: "Esta acción no se puede deshacer.",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });
  if (!confirmacion.isConfirmed) return;
  try {
    await eliminarGasto(id);
    await cargarGastos();
  } catch (error) {
    Swal.fire({ icon: "error", title: "No se pudo eliminar", text: error.message });
  }
}

iniciarGastos();
