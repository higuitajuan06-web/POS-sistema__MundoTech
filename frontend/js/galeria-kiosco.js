let categoriasKiosco = [], galeriaKiosco = [], categoriaKioscoActiva = "";
const escapeHtml = value => String(value || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
async function iniciarKiosco() {
  try { [categoriasKiosco, galeriaKiosco] = await Promise.all([obtenerCategorias(), obtenerGaleria()]); renderCategorias(); renderGaleria(); }
  catch (error) { document.getElementById("galeria-grid").innerHTML = `<p class="kiosco-error">${escapeHtml(error.message)}</p>`; }
}
function renderCategorias() {
  document.getElementById("kiosco-categorias").innerHTML = `<button class="categoria-btn ${!categoriaKioscoActiva ? "activa" : ""}" data-id="">Todas</button>` + categoriasKiosco.map(c => `<button class="categoria-btn ${categoriaKioscoActiva === c.id ? "activa" : ""}" data-id="${c.id}">${escapeHtml(c.name)}</button>`).join("");
  document.querySelectorAll("#kiosco-categorias .categoria-btn").forEach(button => button.onclick = async () => { categoriaKioscoActiva = button.dataset.id; galeriaKiosco = await obtenerGaleria(categoriaKioscoActiva); renderCategorias(); renderGaleria(); });
}
function renderGaleria() {
  const grid = document.getElementById("galeria-grid");
  grid.innerHTML = galeriaKiosco.length ? galeriaKiosco.map(item => `<article class="galeria-card" data-id="${item.id}"><img src="${item.image_url}" alt="${escapeHtml(item.titulo)}"><div><h3>${escapeHtml(item.titulo)}</h3>${item.product_name ? `<p>Desde $${Number(item.sale_price).toLocaleString("es-CO")}</p>` : ""}</div></article>`).join("") : '<p class="kiosco-empty">No hay diseños en esta categoría.</p>';
  grid.querySelectorAll(".galeria-card").forEach(card => card.onclick = () => abrirDetalle(galeriaKiosco.find(i => i.id === card.dataset.id)));
}
function abrirDetalle(item) {
  document.getElementById("gallery-modal-image").src = item.image_url; document.getElementById("gallery-modal-image").alt = item.titulo;
  document.getElementById("gallery-modal-title").textContent = item.titulo; document.getElementById("gallery-modal-description").textContent = item.descripcion || "";
  document.getElementById("gallery-modal-price").textContent = item.product_name ? `${item.product_name} - $${Number(item.sale_price).toLocaleString("es-CO")}` : "";
  document.getElementById("gallery-modal").classList.add("active");
}
document.getElementById("gallery-modal-close").onclick = () => document.getElementById("gallery-modal").classList.remove("active");
document.getElementById("gallery-modal").onclick = e => { if (e.target.id === "gallery-modal") e.currentTarget.classList.remove("active"); };
iniciarKiosco();
