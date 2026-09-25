// Admin Clientes - Gestión CRUD de clientes
let clientes = [];
let clienteEditando = null;

// --- Referencias del DOM ---
const elTablaClientes = document.getElementById("tabla-clientes-body");
const elBuscarCliente = document.getElementById("buscar-cliente");
const elBtnAgregar = document.getElementById("btn-agregar-cliente");
const elModalCliente = document.getElementById("modal-cliente");
const elModalClienteTitulo = document.getElementById("modal-cliente-titulo");
const elFormCliente = document.getElementById("form-cliente");
const elClienteId = document.getElementById("cliente-id");
const elClienteNombre = document.getElementById("cliente-nombre");
const elClienteTelefono = document.getElementById("cliente-telefono");
const elClienteEmail = document.getElementById("cliente-email");
const elModalClienteClose = document.getElementById("modal-cliente-close");
const elBtnCancelarCliente = document.getElementById("btn-cancelar-cliente");

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
    clientes = await obtenerClientes();
    renderizarTablaClientes();
  } catch (error) {
    elTablaClientes.innerHTML = `<tr><td colspan="4" class="carrito-vacio">No se pudo cargar los clientes: ${error.message}</td></tr>`;
  }
}

// ===== Renderizar tabla de clientes =====
function renderizarTablaClientes(clientesFiltrados = null) {
  const lista = clientesFiltrados || clientes;

  if (lista.length === 0) {
    elTablaClientes.innerHTML = `<tr><td colspan="4" class="carrito-vacio">No hay clientes</td></tr>`;
    return;
  }

  elTablaClientes.innerHTML = lista.map(c => `
    <tr data-id="${c.id}">
      <td>${c.name}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.email || '-'}</td>
      <td>
        <button class="btn-accion editar" data-id="${c.id}">
          <i class="bi bi-pencil"></i> Editar
        </button>
        <button class="btn-accion eliminar" data-id="${c.id}" data-nombre="${c.name}">
          <i class="bi bi-trash"></i> Eliminar
        </button>
      </td>
    </tr>
  `).join("");

  elTablaClientes.querySelectorAll(".editar").forEach(btn => {
    btn.addEventListener("click", () => {
      const cliente = clientes.find(c => c.id === btn.dataset.id);
      abrirModalEditar(cliente);
    });
  });

  elTablaClientes.querySelectorAll(".eliminar").forEach(btn => {
    btn.addEventListener("click", () => {
      const cliente = clientes.find(c => c.id === btn.dataset.id);
      Swal.fire({
        title: '¿Eliminar cliente?',
        text: `¿Seguro que deseas eliminar "${cliente.name}"? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await eliminarCliente(cliente.id);
            Swal.fire({
              icon: 'success',
              title: 'Cliente eliminado',
              text: 'Cliente eliminado correctamente'
            });
            clientes = await obtenerClientes();
            renderizarTablaClientes();
          } catch (error) {
            // Manejo específico del error 409
            if (error.message.includes("ventas registradas")) {
              Swal.fire({
                icon: 'warning',
                title: 'No se puede eliminar',
                text: 'El cliente tiene historial de compras asociadas. No se puede eliminar para mantener la integridad del historial de ventas.'
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

// ===== Búsqueda =====
elBuscarCliente.addEventListener("input", async () => {
  const termino = elBuscarCliente.value.trim();
  
  if (!termino) {
    clientes = await obtenerClientes();
    renderizarTablaClientes();
    return;
  }

  // Usar búsqueda del backend
  try {
    clientes = await obtenerClientes(termino);
    renderizarTablaClientes();
  } catch (error) {
    elTablaClientes.innerHTML = `<tr><td colspan="4" class="carrito-vacio">Error al buscar: ${error.message}</td></tr>`;
  }
});

// ===== Modal agregar/editar =====
function abrirModalCrear() {
  clienteEditando = null;
  elModalClienteTitulo.textContent = "Agregar cliente";
  elFormCliente.reset();
  elClienteId.value = "";
  elModalCliente.classList.add("active");
}

function abrirModalEditar(cliente) {
  clienteEditando = cliente;
  elModalClienteTitulo.textContent = "Editar cliente";
  elClienteId.value = cliente.id;
  elClienteNombre.value = cliente.name;
  elClienteTelefono.value = cliente.phone || "";
  elClienteEmail.value = cliente.email || "";
  elModalCliente.classList.add("active");
}

function cerrarModalCliente() {
  elModalCliente.classList.remove("active");
  clienteEditando = null;
  elFormCliente.reset();
}

elBtnAgregar.addEventListener("click", abrirModalCrear);
elModalClienteClose.addEventListener("click", cerrarModalCliente);
elBtnCancelarCliente.addEventListener("click", cerrarModalCliente);

elFormCliente.addEventListener("submit", async (e) => {
  e.preventDefault();

  const datos = {
    name: elClienteNombre.value.trim(),
    phone: elClienteTelefono.value.trim(),
    email: elClienteEmail.value.trim()
  };

  try {
    if (clienteEditando) {
      await editarCliente(clienteEditando.id, datos);
      Swal.fire({
        icon: 'success',
        title: 'Cliente actualizado',
        text: 'Cliente actualizado correctamente'
      });
    } else {
      await crearCliente(datos);
      Swal.fire({
        icon: 'success',
        title: 'Cliente creado',
        text: 'Cliente creado correctamente'
      });
    }

    cerrarModalCliente();
    clientes = await obtenerClientes();
    renderizarTablaClientes();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error: ${error.message}`
    });
  }
});

// ===== Utilidades =====
function formatearNumero(valor) {
  return Number(valor).toLocaleString("es-CO");
}

iniciar();
