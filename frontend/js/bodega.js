// Bodega - Vista de stock de productos
let datosBodega = null;
let busquedaActual = "";

// --- Referencias del DOM ---
const elBuscarBodega = document.getElementById("buscar-bodega");
const elResumenTotalProductos = document.getElementById("resumen-total-productos");
const elResumenStockBajo = document.getElementById("resumen-stock-bajo");
const elResumenValorInventario = document.getElementById("resumen-valor-inventario");
const elResumenStockBajoCard = document.getElementById("resumen-stock-bajo-card");
const elBodegaCategorias = document.getElementById("bodega-categorias");

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", async () => {
  await cargarBodega();
  configurarEventListeners();
  verificarSesion();
});

// --- Configurar event listeners ---
function configurarEventListeners() {
  elBuscarBodega.addEventListener("input", (e) => {
    busquedaActual = e.target.value.toLowerCase();
    renderizarBodega();
  });

  // NOTA: La navegación del sidebar se maneja en sidebar.js
  // No es necesario configurarla aquí
}

// --- Cargar datos de bodega ---
async function cargarBodega() {
  try {
    datosBodega = await obtenerBodega();
    renderizarBodega();
  } catch (error) {
    console.error("Error al cargar bodega:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo cargar la información de bodega",
      confirmButtonColor: "#1e3a5f"
    });
  }
}

// --- Renderizar vista de bodega ---
function renderizarBodega() {
  if (!datosBodega) return;

  // Renderizar resumen
  elResumenTotalProductos.textContent = datosBodega.resumen.total_productos;
  elResumenStockBajo.textContent = datosBodega.resumen.productos_stock_bajo;
  elResumenValorInventario.textContent = formatearDinero(datosBodega.resumen.valor_total_inventario);

  // Resaltar tarjeta de stock bajo si hay productos con stock bajo
  if (datosBodega.resumen.productos_stock_bajo > 0) {
    elResumenStockBajoCard.classList.add("alerta");
  } else {
    elResumenStockBajoCard.classList.remove("alerta");
  }

  // Filtrar y renderizar categorías
  const categoriasFiltradas = datosBodega.categorias.map(cat => ({
    ...cat,
    productos: cat.productos.filter(prod => 
      prod.name.toLowerCase().includes(busquedaActual) ||
      prod.sku.toLowerCase().includes(busquedaActual)
    )
  })).filter(cat => cat.productos.length > 0);

  elBodegaCategorias.innerHTML = "";

  if (categoriasFiltradas.length === 0) {
    elBodegaCategorias.innerHTML = `
      <div class="mensaje-vacio">
        <i class="bi bi-search"></i>
        <p>No se encontraron productos que coincidan con la búsqueda</p>
      </div>
    `;
    return;
  }

  categoriasFiltradas.forEach(categoria => {
    const categoriaDiv = document.createElement("div");
    categoriaDiv.className = "bodega-categoria";

    const titulo = document.createElement("h3");
    titulo.className = "bodega-categoria-titulo";
    titulo.textContent = categoria.categoria;
    categoriaDiv.appendChild(titulo);

    const tabla = document.createElement("table");
    tabla.className = "bodega-productos-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>SKU</th>
        <th>Nombre</th>
        <th>Stock</th>
        <th>Stock Mín</th>
        <th>Precio</th>
      </tr>
    `;
    tabla.appendChild(thead);

    const tbody = document.createElement("tbody");
    categoria.productos.forEach(producto => {
      const tr = document.createElement("tr");
      if (producto.stock_bajo) {
        tr.classList.add("stock-bajo");
      }

      tr.innerHTML = `
        <td>${producto.sku || "-"}</td>
        <td>${producto.name}</td>
        <td>${producto.stock}</td>
        <td>${producto.min_stock}</td>
        <td>${formatearDinero(producto.sale_price)}</td>
      `;
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);

    categoriaDiv.appendChild(tabla);
    elBodegaCategorias.appendChild(categoriaDiv);
  });
}

// --- Formatear dinero ---
function formatearDinero(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);
}

// --- Verificar sesión ---
async function verificarSesion() {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) {
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
