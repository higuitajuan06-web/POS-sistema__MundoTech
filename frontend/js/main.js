// Estado de la pantalla de venta (vive solo en memoria, se resetea cada venta)
let categorias = [];
let productos = [];
let carrito = [];              // [{ product_id, name, price, quantity, stock }]
let metodoPagoSeleccionado = null;
let categoriaActiva = null;    // null = "todas"
let USUARIO_ACTUAL_ID = null; // Se llena al verificar la sesión

// --- Referencias del DOM (se buscan una sola vez) ---
const elCategorias = document.getElementById("lista-categorias");
const elProductos = document.getElementById("lista-productos");
const elCarritoItems = document.getElementById("carrito-items");
const elCarritoTotal = document.getElementById("carrito-total");
const elBtnCobrar = document.getElementById("btn-cobrar");
const elMetodosPago = document.querySelectorAll(".metodo-pago-btn");
const elInputEscanerVenta = document.getElementById("input-escaner-venta");

// ===== Inicio =====
async function iniciar() {
  // Primero verificar sesión
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    window.location.href = "login.html";
    return;
  }
  
  USUARIO_ACTUAL_ID = sesion.id;
  
  // Mostrar mensaje de bienvenida si es la primera vez que entra (usamos sessionStorage)
  if (!sessionStorage.getItem('bienvenida_mostrada')) {
    Swal.fire({
      icon: 'success',
      title: '¡Bienvenido!',
      text: `Hola, ${sesion.username || sesion.name || 'Usuario'}. ¡Buen día!`,
      timer: 2000,
      showConfirmButton: false,
      confirmButtonColor: '#16a34a'
    });
    sessionStorage.setItem('bienvenida_mostrada', 'true');
  }
  
  // NOTA: El manejo del sidebar según rol ahora se hace en sidebar.js
  // No es necesario ocultar/mostrar elementos aquí
  
  // Recuperar carrito guardado
  const carritoGuardado = localStorage.getItem('pos_carrito_actual');
  if (carritoGuardado) {
    carrito = JSON.parse(carritoGuardado);
  }
  
  try {
    [categorias, productos] = await Promise.all([
      obtenerCategorias(),
      obtenerProductos()
    ]);
    await cargarMetodosPago();
    renderizarCategorias();
    renderizarProductos();
    renderizarCarrito(); // Mostrar carrito recuperado
  } catch (error) {
    elProductos.innerHTML = `<p class="carrito-vacio">No se pudo cargar el catálogo: ${error.message}</p>`;
  }
}

// ===== Categorías =====
function renderizarCategorias() {
  const botonTodas = `<button class="categoria-btn ${categoriaActiva === null ? "activa" : ""}" data-id="">Todas</button>`;
  const botones = categorias.map(cat =>
    `<button class="categoria-btn ${categoriaActiva === cat.id ? "activa" : ""}" data-id="${cat.id}">${cat.name}</button>`
  ).join("");

  elCategorias.innerHTML = botonTodas + botones;

  elCategorias.querySelectorAll(".categoria-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      categoriaActiva = btn.dataset.id || null;
      renderizarCategorias();
      renderizarProductos();
    });
  });
}

// ===== Productos =====
function renderizarProductos() {
  let listaFiltrada = productos;
  
  // Filtrar por categoría si hay una seleccionada
  if (categoriaActiva) {
    listaFiltrada = listaFiltrada.filter(p => p.category_name === categorias.find(c => c.id === categoriaActiva)?.name);
  }

  if (listaFiltrada.length === 0) {
    elProductos.innerHTML = `<p class="carrito-vacio">No se encontraron productos</p>`;
    return;
  }

  elProductos.innerHTML = listaFiltrada.map(p => {
    const stockBajo = p.stock <= p.min_stock;
    const imagenHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.name}" class="producto-imagen">`
      : `<div class="imagen-placeholder"><i class="bi bi-image"></i></div>`;
    
    return `
      <div class="producto-card" data-id="${p.id}">
        ${imagenHtml}
        <h3>${p.name}</h3>
        <div class="precio">$${formatearNumero(p.sale_price)}</div>
        ${stockBajo ? `<div class="stock-bajo">¡Stock bajo: ${p.stock}!</div>` : `<div>Stock: ${p.stock}</div>`}
      </div>
    `;
  }).join("");

  elProductos.querySelectorAll(".producto-card").forEach(card => {
    card.addEventListener("click", () => {
      const producto = productos.find(p => p.id === card.dataset.id);
      agregarAlCarrito(producto);
    });
  });
}

// ===== Carrito =====
function agregarAlCarrito(producto) {
  console.log("Agregando al carrito:", producto);
  const existente = carrito.find(item => item.product_id === producto.id);

  if (existente) {
    if (existente.quantity >= producto.stock) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock agotado',
        text: `No hay más stock disponible de "${producto.name}"`
      });
      return;
    }
    existente.quantity += 1;
    console.log("Producto existente, cantidad incrementada:", existente);
  } else {
    if (producto.stock <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin stock',
        text: `"${producto.name}" no tiene stock disponible`
      });
      return;
    }
    const nuevoItem = {
      product_id: producto.id,
      name: producto.name,
      price: parseFloat(producto.sale_price),
      quantity: 1,
      stock: producto.stock,
      image_url: producto.image_url || null
    };
    carrito.push(nuevoItem);
    console.log("Nuevo producto agregado:", nuevoItem);
  }
  console.log("Carrito actual:", carrito);
  renderizarCarrito();
}

function cambiarCantidad(productId, delta) {
  const item = carrito.find(i => i.product_id === productId);
  
  if (!item && delta === -1) return; // No existe item y queremos restar - no hacer nada
  
  if (!item && delta === 1) {
    // Producto no existe en carrito y queremos sumar - agregarlo
    const producto = productos.find(p => p.id === productId);
    if (!producto) return;
    
    if (producto.stock <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin stock',
        text: `"${producto.name}" no tiene stock disponible`
      });
      return;
    }
    
    carrito.push({
      product_id: producto.id,
      name: producto.name,
      price: parseFloat(producto.sale_price),
      quantity: 1,
      stock: producto.stock,
      image_url: producto.image_url || null
    });
  } else {
    // Item existe en carrito
    const nuevaCantidad = item.quantity + delta;

    if (nuevaCantidad <= 0) {
      carrito = carrito.filter(i => i.product_id !== productId);
    } else if (nuevaCantidad > item.stock) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock agotado',
        text: 'No hay más stock disponible'
      });
      return;
    } else {
      item.quantity = nuevaCantidad;
    }
  }
  renderizarCarrito();
}

function renderizarCarrito() {
  if (carrito.length === 0) {
    elCarritoItems.innerHTML = `<p class="carrito-vacio">Agrega productos para iniciar la venta</p>`;
  } else {
    elCarritoItems.innerHTML = carrito.map(item => {
      const imagenHtml = item.image_url 
        ? `<img src="${item.image_url}" alt="${item.name}" class="carrito-item-imagen">`
        : '';
      
      return `
      <div class="carrito-item">
        <div class="carrito-item-linea1">
          <div class="carrito-item-info">
            <span>${item.name}</span>
            ${imagenHtml}
          </div>
          <span>$${formatearNumero(item.price * item.quantity)}</span>
        </div>
        <div class="carrito-item-linea2">
          <div class="qty-controls">
            <button data-id="${item.product_id}" data-delta="-1">−</button>
            <span>${item.quantity}</span>
            <button data-id="${item.product_id}" data-delta="1">+</button>
          </div>
        </div>
      </div>
    `;
    }).join("");

    elCarritoItems.querySelectorAll("button[data-delta]").forEach(btn => {
      btn.addEventListener("click", () => {
        cambiarCantidad(btn.dataset.id, parseInt(btn.dataset.delta));
      });
    });
  }

  const total = calcularTotal();
  elCarritoTotal.textContent = `$${formatearNumero(total)}`;
  actualizarEstadoBotonCobrar();
  
  // Guardar carrito en localStorage
  localStorage.setItem('pos_carrito_actual', JSON.stringify(carrito));
}

function calcularTotal() {
  return carrito.reduce((suma, item) => suma + (item.price * item.quantity), 0);
}

// ===== Métodos de pago =====
elMetodosPago.forEach(btn => {
  btn.addEventListener("click", () => {
    metodoPagoSeleccionado = btn.dataset.metodo;
    elMetodosPago.forEach(b => b.classList.remove("seleccionado"));
    btn.classList.add("seleccionado");
    actualizarEstadoBotonCobrar();
  });
});

function actualizarEstadoBotonCobrar() {
  elBtnCobrar.disabled = carrito.length === 0 || !metodoPagoSeleccionado;
}

// ===== Cobrar =====
elBtnCobrar.addEventListener("click", async () => {
  const total = calcularTotal();
  const metodoPagoNombre = metodoPagoSeleccionado === 'CASH' ? 'Efectivo' : 
                          metodoPagoSeleccionado === 'CARD' ? 'Tarjeta' : 'Transferencia';
  
  // Generar resumen de items para mostrar en la confirmación
  const itemsResumen = carrito.map(item => 
    `<div style="display:flex;justify-content:space-between;margin:4px 0;">
      <span>${item.name} x${item.quantity}</span>
      <span>$${formatearNumero(item.price * item.quantity)}</span>
    </div>`
  ).join('');

  const result = await Swal.fire({
    title: '¿Confirmar venta?',
    html: `
      <div style="text-align:left;">
        <div style="margin-bottom:12px;">
          <strong>Método de pago:</strong> ${metodoPagoNombre}
        </div>
        <div style="margin-bottom:12px;">
          <strong>Productos:</strong>
          ${itemsResumen}
        </div>
        <div style="border-top:1px solid #ddd;padding-top:8px;margin-top:8px;">
          <strong>Total a pagar:</strong> $${formatearNumero(total)}
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#16a34a',
    cancelButtonColor: '#dc2626',
    confirmButtonText: 'Confirmar venta',
    cancelButtonText: 'Cancelar',
    width: '500px'
  });

  if (!result.isConfirmed) {
    return; // Usuario canceló la venta
  }

  elBtnCobrar.disabled = true;
  elBtnCobrar.textContent = "Procesando...";

  // Mapeo simple: el nombre del método a su UUID real en la base de datos.
  // Se resuelve consultando payment_methods (evita hardcodear IDs en el frontend).
  const metodoPago = mapaMetodosPago[metodoPagoSeleccionado];

  const venta = {
    user_id: USUARIO_ACTUAL_ID, // TODO: vendrá del login, por ahora fijo para pruebas
    items: carrito.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    })),
    payments: [
      { payment_method_id: metodoPago, amount: calcularTotal() }
    ]
  };

  try {
    const resultado = await registrarVenta(venta);
    Swal.fire({
      icon: 'success',
      title: 'Venta registrada',
      text: `Total: $${formatearNumero(resultado.total)}`
    });
    resetearVenta();
    await iniciar(); // recarga productos para reflejar el nuevo stock
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo registrar la venta: ${error.message}`
    });
    elBtnCobrar.disabled = false;
  } finally {
    elBtnCobrar.textContent = "Cobrar";
  }
});

function resetearVenta() {
  carrito = [];
  metodoPagoSeleccionado = null;
  elMetodosPago.forEach(b => b.classList.remove("seleccionado"));
  localStorage.removeItem('pos_carrito_actual');
  renderizarCarrito();
}

// ===== Utilidades =====
function formatearNumero(valor) {
  return Number(valor).toLocaleString("es-CO");
}

// ===== Escáner de código de barras para venta =====
if (elInputEscanerVenta) {
  elInputEscanerVenta.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      const codigo = elInputEscanerVenta.value.trim();
      if (!codigo) return;

      console.log("Buscando producto con código:", codigo);

      try {
        const producto = await buscarProductoPorCodigo(codigo);
        console.log("Producto encontrado:", producto);
        
        // Producto encontrado - agregar al carrito si tiene stock
        if (producto.stock > 0) {
          console.log("Stock disponible, agregando al carrito...");
          agregarAlCarrito(producto);
          console.log("Carrito después de agregar:", carrito);
          
          // Forzar renderizado del carrito
          renderizarCarrito();
          
          // Mostrar mensaje simple sin SweetAlert que podría interferir
          const mensaje = document.createElement('div');
          mensaje.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #16a34a; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; animation: fadeIn 0.3s;';
          mensaje.textContent = `${producto.name} agregado al carrito`;
          document.body.appendChild(mensaje);
          setTimeout(() => {
            mensaje.style.opacity = '0';
            mensaje.style.transition = 'opacity 0.3s';
            setTimeout(() => mensaje.remove(), 300);
          }, 1500);
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Sin stock',
            text: `"${producto.name}" no tiene stock disponible`
          });
        }
      } catch (error) {
        console.error("Error al buscar producto:", error);
        // Producto no encontrado
        if (error.message.includes("Producto no encontrado")) {
          Swal.fire({
            icon: 'warning',
            title: 'Producto no encontrado',
            text: `El código "${codigo}" no existe en el inventario`
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `Error: ${error.message}`
          });
        }
      }

      // Limpiar input y volver a poner foco
      elInputEscanerVenta.value = "";
      elInputEscanerVenta.focus();
    }
  });
}

// NOTA: La navegación del sidebar se maneja en sidebar.js
// No es necesario configurarla aquí

// Se llena en tiempo real al iniciar, consultando payment_methods
let mapaMetodosPago = {};

async function cargarMetodosPago() {
  const res = await fetch(`${API_BASE}/payment_methods`, { credentials: "include" });
  const metodos = await res.json();
  metodos.forEach(m => {
    mapaMetodosPago[m.name] = m.id; // ej: mapaMetodosPago["CASH"] = "uuid-real"
  });
}

iniciar();