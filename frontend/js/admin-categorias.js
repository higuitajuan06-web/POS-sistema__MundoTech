// Admin Categorías - Gestión CRUD de categorías
let categorias = [];
let categoriaEditando = null;

// --- Referencias del DOM ---
const elTablaCategorias = document.getElementById("tabla-categorias-body");
const elBuscarCategoria = document.getElementById("buscar-categoria-admin");
const elBtnAgregar = document.getElementById("btn-agregar-categoria");
const elModalCategoria = document.getElementById("modal-categoria");
const elModalCategoriaTitulo = document.getElementById("modal-categoria-titulo");
const elFormCategoria = document.getElementById("form-categoria");
const elCategoriaId = document.getElementById("categoria-id");
const elCategoriaNombre = document.getElementById("categoria-nombre");
const elCategoriaDescripcion = document.getElementById("categoria-descripcion");
const elModalCategoriaClose = document.getElementById("modal-categoria-close");
const elBtnCancelarCategoria = document.getElementById("btn-cancelar-categoria");

// ===== Inicio =====
async function iniciar() {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    window.location.href = "login.html";
    return;
  }

  // NOTA: La verificación de rol y configuración del sidebar se manejan en sidebar.js
  // No es necesario configurarlos aquí

  try {
    categorias = await obtenerCategorias();
    renderizarTablaCategorias();
  } catch (error) {
    elTablaCategorias.innerHTML = `<tr><td colspan="4" class="carrito-vacio">No se pudo cargar las categorías: ${error.message}</td></tr>`;
  }
}

// ===== Renderizar tabla de categorías =====
async function renderizarTablaCategorias(categoriasFiltradas = null) {
  const lista = categoriasFiltradas || categorias;

  if (lista.length === 0) {
    elTablaCategorias.innerHTML = `<tr><td colspan="4" class="carrito-vacio">No hay categorías</td></tr>`;
    return;
  }

  // Obtener conteo de productos para cada categoría
  const productos = await obtenerProductos();
  const productosPorCategoria = {};
  productos.forEach(p => {
    if (p.category_id) {
      productosPorCategoria[p.category_id] = (productosPorCategoria[p.category_id] || 0) + 1;
    }
  });

  elTablaCategorias.innerHTML = lista.map(c => {
    const numProductos = productosPorCategoria[c.id] || 0;
    return `
    <tr data-id="${c.id}">
      <td>${c.name}</td>
      <td>${c.description || '-'}</td>
      <td>${numProductos}</td>
      <td>
        <button class="btn-accion editar" data-id="${c.id}">
          <i class="bi bi-pencil"></i> Editar
        </button>
        <button class="btn-accion eliminar" data-id="${c.id}" data-nombre="${c.name}">
          <i class="bi bi-trash"></i> Eliminar
        </button>
      </td>
    </tr>
  `;
  }).join("");

  elTablaCategorias.querySelectorAll(".editar").forEach(btn => {
    btn.addEventListener("click", () => {
      const categoria = categorias.find(c => c.id === btn.dataset.id);
      abrirModalEditar(categoria);
    });
  });

  elTablaCategorias.querySelectorAll(".eliminar").forEach(btn => {
    btn.addEventListener("click", () => {
      const categoria = categorias.find(c => c.id === btn.dataset.id);
      Swal.fire({
        title: '¿Eliminar categoría?',
        text: `¿Seguro que deseas eliminar "${categoria.name}"? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await eliminarCategoria(categoria.id);
            Swal.fire({
              icon: 'success',
              title: 'Categoría eliminada',
              text: 'Categoría eliminada correctamente'
            });
            categorias = await obtenerCategorias();
            renderizarTablaCategorias();
          } catch (error) {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `Error: ${error.message}`
            });
          }
        }
      });
    });
  });
}

// ===== Búsqueda =====
elBuscarCategoria.addEventListener("input", () => {
  const termino = elBuscarCategoria.value.toLowerCase().trim();
  
  if (!termino) {
    renderizarTablaCategorias();
    return;
  }

  const filtradas = categorias.filter(c => 
    c.name.toLowerCase().includes(termino) || 
    (c.description && c.description.toLowerCase().includes(termino))
  );
  
  renderizarTablaCategorias(filtradas);
});

// ===== Modal agregar/editar =====
function abrirModalCrear() {
  categoriaEditando = null;
  elModalCategoriaTitulo.textContent = "Agregar categoría";
  elFormCategoria.reset();
  elCategoriaId.value = "";
  elModalCategoria.classList.add("active");
}

function abrirModalEditar(categoria) {
  categoriaEditando = categoria;
  elModalCategoriaTitulo.textContent = "Editar categoría";
  elCategoriaId.value = categoria.id;
  elCategoriaNombre.value = categoria.name;
  elCategoriaDescripcion.value = categoria.description || "";
  elModalCategoria.classList.add("active");
}

function cerrarModalCategoria() {
  elModalCategoria.classList.remove("active");
  categoriaEditando = null;
  elFormCategoria.reset();
}

elBtnAgregar.addEventListener("click", abrirModalCrear);
elModalCategoriaClose.addEventListener("click", cerrarModalCategoria);
elBtnCancelarCategoria.addEventListener("click", cerrarModalCategoria);

elFormCategoria.addEventListener("submit", async (e) => {
  e.preventDefault();

  const datos = {
    name: elCategoriaNombre.value.trim(),
    description: elCategoriaDescripcion.value.trim()
  };

  if (!datos.name) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'El nombre es obligatorio'
    });
    return;
  }

  try {
    if (categoriaEditando) {
      await editarCategoria(categoriaEditando.id, datos);
      Swal.fire({
        icon: 'success',
        title: 'Categoría actualizada',
        text: 'Categoría actualizada correctamente'
      });
    } else {
      await crearCategoria(datos);
      Swal.fire({
        icon: 'success',
        title: 'Categoría creada',
        text: 'Categoría creada correctamente'
      });
    }

    cerrarModalCategoria();
    categorias = await obtenerCategorias();
    renderizarTablaCategorias();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error: ${error.message}`
    });
  }
});

iniciar();
