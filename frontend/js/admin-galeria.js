let galeria = [], categoriasGaleria = [], productosGaleria = [], itemEditando = null, imagenGaleriaUrl = null;
const $ = id => document.getElementById(id);
const tabla = $("tabla-galeria-body"), modal = $("modal-galeria"), form = $("form-galeria");

async function iniciarGaleriaAdmin() {
  if (!await obtenerSesionActual()) { window.location.href = "login.html"; return; }
  try {
    [galeria, categoriasGaleria, productosGaleria] = await Promise.all([obtenerGaleria(), obtenerCategorias(), obtenerProductos()]);
    renderSelects(); renderTabla();
  } catch (error) { tabla.innerHTML = `<tr><td colspan="5" class="carrito-vacio">${error.message}</td></tr>`; }
}
function renderSelects() {
  $("galeria-categoria").innerHTML = '<option value="">Sin categoría</option>' + categoriasGaleria.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  $("galeria-producto").innerHTML = '<option value="">Ninguno</option>' + productosGaleria.map(p => `<option value="${p.id}">${p.name} - $${Number(p.sale_price).toLocaleString("es-CO")}</option>`).join("");
}
function renderTabla() {
  tabla.innerHTML = galeria.length ? galeria.map(item => `<tr>
    <td>${item.image_url ? `<img src="${item.image_url}" alt="${item.titulo}" class="producto-imagen-mini">` : "-"}</td>
    <td>${item.titulo}</td><td>${item.category_name || "-"}</td><td>${item.product_name || "Ninguno"}</td>
    <td><button class="btn-accion editar" data-id="${item.id}"><i class="bi bi-pencil"></i> Editar</button>
    <button class="btn-accion eliminar" data-id="${item.id}"><i class="bi bi-trash"></i> Eliminar</button></td></tr>`).join("") :
    '<tr><td colspan="5" class="carrito-vacio">No hay diseños activos</td></tr>';
  tabla.querySelectorAll(".editar").forEach(b => b.onclick = () => abrirEditar(galeria.find(i => i.id === b.dataset.id)));
  tabla.querySelectorAll(".eliminar").forEach(b => b.onclick = () => eliminar(b.dataset.id));
}
function abrirCrear() { itemEditando = null; imagenGaleriaUrl = null; form.reset(); $("galeria-preview").innerHTML = ""; $("modal-galeria-titulo").textContent = "Agregar diseño"; modal.classList.add("active"); }
function abrirEditar(item) {
  itemEditando = item; imagenGaleriaUrl = item.image_url; $("galeria-id").value = item.id;
  $("galeria-titulo").value = item.titulo; $("galeria-descripcion").value = item.descripcion || "";
  $("galeria-categoria").value = item.category_id || ""; $("galeria-producto").value = item.product_id || "";
  $("galeria-preview").innerHTML = `<img src="${item.image_url}" alt="Vista previa">`; $("modal-galeria-titulo").textContent = "Editar diseño"; modal.classList.add("active");
}
function cerrar() { modal.classList.remove("active"); itemEditando = null; imagenGaleriaUrl = null; form.reset(); $("galeria-preview").innerHTML = ""; }
async function eliminar(id) {
  const item = galeria.find(i => i.id === id);
  const result = await Swal.fire({ title: "¿Eliminar diseño?", text: `Se ocultará "${item.titulo}" del kiosco.`, icon: "warning", showCancelButton: true, confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", confirmButtonColor: "#dc2626" });
  if (!result.isConfirmed) return;
  try { await eliminarGaleriaItem(id); galeria = await obtenerGaleria(); renderTabla(); Swal.fire({ icon: "success", title: "Diseño eliminado", timer: 1400, showConfirmButton: false }); }
  catch (error) { Swal.fire({ icon: "error", title: "Error", text: error.message }); }
}
$("btn-agregar-galeria").onclick = abrirCrear; $("galeria-imagen").onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader(); reader.onload = event => $("galeria-preview").innerHTML = `<img src="${event.target.result}" alt="Vista previa">`; reader.readAsDataURL(file);
};
$("modal-galeria-close").onclick = cerrar; $("btn-cancelar-galeria").onclick = cerrar;
form.onsubmit = async e => {
  e.preventDefault();
  try {
    if ($("galeria-imagen").files[0]) imagenGaleriaUrl = (await uploadImage($("galeria-imagen").files[0])).image_url;
    if (!imagenGaleriaUrl) throw new Error("Debes seleccionar una imagen");
    const datos = { titulo: $("galeria-titulo").value.trim(), descripcion: $("galeria-descripcion").value.trim(), image_url: imagenGaleriaUrl, category_id: $("galeria-categoria").value || null, product_id: $("galeria-producto").value || null };
    if (itemEditando) await editarGaleriaItem(itemEditando.id, datos); else await crearGaleriaItem(datos);
    cerrar(); galeria = await obtenerGaleria(); renderTabla(); Swal.fire({ icon: "success", title: "Guardado", timer: 1400, showConfirmButton: false });
  } catch (error) { Swal.fire({ icon: "error", title: "Error", text: error.message }); }
};
iniciarGaleriaAdmin();
