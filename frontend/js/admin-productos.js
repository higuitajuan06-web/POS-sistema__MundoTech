// Admin Productos - Gestión CRUD de productos
let productos = [];
let categorias = [];
let productoEditando = null;
let imagenActualUrl = null;

// --- Referencias del DOM ---
const elTablaProductos = document.getElementById("tabla-productos-body");
const elInputEscaner = document.getElementById("input-escaner");
const elBtnAgregar = document.getElementById("btn-agregar-producto");
const elModalProducto = document.getElementById("modal-producto");
const elModalProductoTitulo = document.getElementById("modal-producto-titulo");
const elFormProducto = document.getElementById("form-producto");
const elProductoId = document.getElementById("producto-id");
const elProductoSku = document.getElementById("producto-sku");
const elProductoNombre = document.getElementById("producto-nombre");
const elProductoCategoria = document.getElementById("producto-categoria");
const elProductoPrecio = document.getElementById("producto-precio");
const elProductoComision = document.getElementById("producto-comision");
const elProductoStock = document.getElementById("producto-stock");
const elProductoStockMin = document.getElementById("producto-stock-min");
const elProductoImagen = document.getElementById("producto-imagen");
const elImagenPreview = document.getElementById("imagen-preview");
const elModalProductoClose = document.getElementById("modal-producto-close");
const elBtnCancelarProducto = document.getElementById("btn-cancelar-producto");

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
    [categorias, productos] = await Promise.all([
      obtenerCategorias(),
      obtenerProductos()
    ]);
    renderizarCategoriasSelect();
    renderizarTablaProductos();
  } catch (error) {
    elTablaProductos.innerHTML = `<tr><td colspan="8" class="carrito-vacio">No se pudo cargar los productos: ${error.message}</td></tr>`;
  }
}

// ===== Renderizar categorías en select =====
function renderizarCategoriasSelect() {
  const opciones = categorias.map(cat =>
    `<option value="${cat.id}">${cat.name}</option>`
  ).join("");
  elProductoCategoria.innerHTML = `<option value="">Seleccionar categoría</option>${opciones}`;
}

// ===== Renderizar tabla de productos =====
function renderizarTablaProductos(productosFiltrados = null) {
  const lista = productosFiltrados || productos;

  if (lista.length === 0) {
    elTablaProductos.innerHTML = `<tr><td colspan="8" class="carrito-vacio">No hay productos</td></tr>`;
    return;
  }

  elTablaProductos.innerHTML = lista.map(p => {
    const imagenHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.name}" class="producto-imagen-mini">`
      : '<div class="producto-imagen-mini" style="display:flex;align-items:center;justify-content:center;background:#f4f5f7;"><i class="bi bi-image" style="color:#6b7280;font-size:20px;"></i></div>';
    
    return `
    <tr data-id="${p.id}">
      <td>${imagenHtml}</td>
      <td>${p.sku || '-'}</td>
      <td>${p.name}</td>
      <td>${p.category_name || '-'}</td>
      <td>$${formatearNumero(p.sale_price)}</td>
      <td>${Number(p.commission_percentage || 0).toFixed(2)}%</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn-accion editar" data-id="${p.id}">
          <i class="bi bi-pencil"></i> Editar
        </button>
        <button class="btn-accion eliminar" data-id="${p.id}" data-nombre="${p.name}">
          <i class="bi bi-trash"></i> Eliminar
        </button>
      </td>
    </tr>
  `;
  }).join("");

  elTablaProductos.querySelectorAll(".editar").forEach(btn => {
    btn.addEventListener("click", () => {
      const producto = productos.find(p => p.id === btn.dataset.id);
      abrirModalEditar(producto);
    });
  });

  elTablaProductos.querySelectorAll(".eliminar").forEach(btn => {
    btn.addEventListener("click", () => {
      const producto = productos.find(p => p.id === btn.dataset.id);
      Swal.fire({
        title: '¿Eliminar producto?',
        text: `¿Seguro que deseas eliminar "${producto.name}"? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await eliminarProducto(producto.id);
            Swal.fire({
              icon: 'success',
              title: 'Producto eliminado',
              text: 'Producto eliminado correctamente'
            });
            productos = await obtenerProductos();
            renderizarTablaProductos();
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

// ===== Escáner de código de barras =====
elInputEscaner.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const codigo = elInputEscaner.value.trim();
    if (!codigo) return;

    console.log("Buscando producto con código:", codigo);

    try {
      const producto = await buscarProductoPorCodigo(codigo);
      console.log("Producto encontrado:", producto);
      
      // Producto encontrado - mostrar modal para agregar stock
      Swal.fire({
        title: 'Producto encontrado',
        html: `
          <div style="text-align:left;">
            <p><strong>Nombre:</strong> ${producto.name}</p>
            <p><strong>Stock actual:</strong> ${producto.stock}</p>
            <div style="margin-top:12px;">
              <label for="cantidad-agregar"><strong>¿Cuántas unidades vas a agregar?</strong></label>
              <input type="number" id="cantidad-agregar" class="swal2-input" min="1" value="1" style="width:150px;">
            </div>
          </div>
        `,
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Agregar stock',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const cantidad = document.getElementById('cantidad-agregar').value;
          if (!cantidad || cantidad <= 0) {
            Swal.showValidationMessage('La cantidad debe ser mayor a 0');
            return false;
          }
          return parseInt(cantidad);
        }
      }).then(async (result) => {
        console.log("Resultado del SweetAlert:", result);
        if (result.isConfirmed) {
          console.log("Agregando stock:", result.value, "unidades al producto:", producto.id);
          try {
            console.log("Llamando a agregarStock...");
            const resultadoStock = await agregarStock(producto.id, result.value);
            console.log("Respuesta de agregarStock:", resultadoStock);
            console.log("Stock agregado exitosamente");
            Swal.fire({
              icon: 'success',
              title: 'Stock actualizado',
              text: `Se agregaron ${result.value} unidades al inventario`
            });
            console.log("Recargando productos...");
            productos = await obtenerProductos();
            console.log("Productos recargados:", productos);
            renderizarTablaProductos();
          } catch (error) {
            console.error("Error al agregar stock:", error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `Error: ${error.message}`
            });
          }
        } else {
          console.log("Usuario canceló la acción");
        }
      });

    } catch (error) {
      console.error("Error al buscar producto:", error);
      // Producto no encontrado - abrir modal de creación con SKU pre-llenado
      if (error.message.includes("Producto no encontrado")) {
        abrirModalCrear();
        elProductoSku.value = codigo;
        elProductoNombre.focus();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error: ${error.message}`
        });
      }
    }

    // Limpiar input y volver a poner foco
    elInputEscaner.value = "";
    elInputEscaner.focus();
  }
});

// ===== Modal agregar/editar =====
function abrirModalCrear() {
  productoEditando = null;
  imagenActualUrl = null;
  elModalProductoTitulo.textContent = "Agregar producto";
  elFormProducto.reset();
  elProductoId.value = "";
  elImagenPreview.innerHTML = "";
  elImagenPreview.classList.add("empty");
  elModalProducto.classList.add("active");
}

function abrirModalEditar(producto) {
  productoEditando = producto;
  imagenActualUrl = producto.image_url || null;
  elModalProductoTitulo.textContent = "Editar producto";
  elProductoId.value = producto.id;
  elProductoSku.value = producto.sku || "";
  elProductoNombre.value = producto.name;
  elProductoCategoria.value = producto.category_id || "";
  elProductoPrecio.value = parseFloat(producto.sale_price) || 0;
  elProductoComision.value = parseFloat(producto.commission_percentage) || 0;
  elProductoStock.value = producto.stock;
  elProductoStockMin.value = producto.min_stock || 5;
  
  // Mostrar imagen existente si hay
  if (imagenActualUrl) {
    elImagenPreview.innerHTML = `<img src="${imagenActualUrl}" alt="Vista previa">`;
    elImagenPreview.classList.remove("empty");
  } else {
    elImagenPreview.innerHTML = "";
    elImagenPreview.classList.add("empty");
  }
  
  elModalProducto.classList.add("active");
}

function cerrarModalProducto() {
  elModalProducto.classList.remove("active");
  productoEditando = null;
  imagenActualUrl = null;
  elFormProducto.reset();
  elImagenPreview.innerHTML = "";
  elImagenPreview.classList.add("empty");
}

elBtnAgregar.addEventListener("click", abrirModalCrear);
elModalProductoClose.addEventListener("click", cerrarModalProducto);
elBtnCancelarProducto.addEventListener("click", cerrarModalProducto);

// ===== Vista previa de imagen =====
elProductoImagen.addEventListener("change", function(e) {
  const archivo = e.target.files[0];
  if (archivo) {
    const reader = new FileReader();
    reader.onload = function(e) {
      elImagenPreview.innerHTML = `<img src="${e.target.result}" alt="Vista previa">`;
      elImagenPreview.classList.remove("empty");
    };
    reader.readAsDataURL(archivo);
  } else {
    elImagenPreview.innerHTML = "";
    elImagenPreview.classList.add("empty");
  }
});

elFormProducto.addEventListener("submit", async (e) => {
  e.preventDefault();

  const archivoImagen = elProductoImagen.files[0];
  let imageUrl = imagenActualUrl;

  // Si se seleccionó una nueva imagen, subirla primero
  if (archivoImagen) {
    try {
      const respuesta = await uploadImage(archivoImagen);
      imageUrl = respuesta.image_url;
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al subir imagen',
        text: `Error: ${error.message}`
      });
      return;
    }
  }

  const datos = {
    sku: elProductoSku.value.trim(),
    name: elProductoNombre.value.trim(),
    category_id: elProductoCategoria.value,
    sale_price: parseFloat(elProductoPrecio.value),
    commission_percentage: parseFloat(elProductoComision.value) || 0,
    stock: parseInt(elProductoStock.value) || 0,
    min_stock: parseInt(elProductoStockMin.value) || 5
  };

  // Solo incluir image_url si hay una (nueva o existente)
  if (imageUrl) {
    datos.image_url = imageUrl;
  }

  try {
    if (productoEditando) {
      await editarProducto(productoEditando.id, datos);
      Swal.fire({
        icon: 'success',
        title: 'Producto actualizado',
        text: 'Producto actualizado correctamente'
      });
    } else {
      await crearProducto(datos);
      Swal.fire({
        icon: 'success',
        title: 'Producto creado',
        text: 'Producto creado correctamente'
      });
    }

    cerrarModalProducto();
    productos = await obtenerProductos();
    renderizarTablaProductos();
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
