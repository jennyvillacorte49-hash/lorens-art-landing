import { createClient } from "@supabase/supabase-js";
import { testimonios, hallazgos } from "./config.js";

// ── Conexión a Supabase (variables de entorno de Vite / Vercel) ──
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

document.getElementById("year").textContent = new Date().getFullYear();

// ── Prueba social ──
const grid = document.getElementById("proof-grid");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

if (testimonios.length) {
  grid.innerHTML = testimonios.map((t) => `
    <figure class="quote-card">
      <div class="stars" aria-label="${t.estrellas || 5} de 5 estrellas">${"★".repeat(t.estrellas || 5)}</div>
      <p>“${esc(t.texto)}”</p>
      <footer>${esc(t.autor)}${t.fuente ? `, vía ${esc(t.fuente)}` : ""}</footer>
    </figure>`).join("");
} else {
  document.getElementById("proof-title").textContent = hallazgos.titulo;
  grid.innerHTML = hallazgos.items.map((h) => `
    <div class="quote-card">
      <p><strong style="font-family:var(--display);font-size:1.6rem;color:var(--tallo);display:block;line-height:1.1;margin-bottom:6px">${esc(h.dato)}</strong>${esc(h.texto)}</p>
    </div>`).join("");
}

// ── Formulario ──
const form = document.getElementById("lead-form");
const statusEl = document.getElementById("form-status");
const btn = document.getElementById("submit-btn");
const success = document.getElementById("success");

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function setError(name, msg) {
  const p = form.querySelector(`.error[data-for="${name}"]`);
  const field = p?.closest(".field");
  if (p) p.textContent = msg || "";
  field?.classList.toggle("invalid", Boolean(msg));
  const input = form.elements[name];
  if (input && input.setAttribute) input.setAttribute("aria-invalid", msg ? "true" : "false");
}

function limpiarWhatsapp(v) {
  return v.replace(/[^\d+]/g, "");
}

function validar(data) {
  const errores = {};
  if (data.nombre_completo.length < 3) errores.nombre_completo = "Escribe tu nombre completo.";
  if (!EMAIL_RE.test(data.correo)) errores.correo = "Revisa el correo: debe tener el formato nombre@dominio.com.";
  const digitos = data.whatsapp.replace(/\D/g, "");
  if (digitos.length < 9 || data.whatsapp.length > 20) errores.whatsapp = "Escribe tu número de WhatsApp, por ejemplo 0991234567.";
  if (!data.presupuesto) errores.presupuesto = "Elige un rango de presupuesto.";
  if (!data.dolor_principal) errores.dolor_principal = "Elige una opción.";
  return errores;
}

// Limpia el error de un campo cuando la persona lo corrige
form.addEventListener("input", (e) => { if (e.target.name) setError(e.target.name, ""); });
form.addEventListener("change", (e) => { if (e.target.name) setError(e.target.name, ""); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "form-status";

  const fd = new FormData(form);
  if (fd.get("sitio_web")) return; // bot

  const data = {
    nombre_completo: String(fd.get("nombre_completo") || "").trim(),
    correo: String(fd.get("correo") || "").trim().toLowerCase(),
    whatsapp: limpiarWhatsapp(String(fd.get("whatsapp") || "").trim()),
    empresa: String(fd.get("empresa") || "").trim() || null,
    presupuesto: String(fd.get("presupuesto") || ""),
    dolor_principal: String(fd.get("dolor_principal") || ""),
  };

  ["nombre_completo", "correo", "whatsapp", "presupuesto", "dolor_principal"].forEach((n) => setError(n, ""));
  const errores = validar(data);
  if (Object.keys(errores).length) {
    Object.entries(errores).forEach(([n, m]) => setError(n, m));
    const primero = form.elements[Object.keys(errores)[0]];
    (primero?.focus ? primero : primero?.[0])?.focus();
    return;
  }

  if (!supabase) {
    statusEl.textContent = "El formulario no está conectado: faltan las variables de entorno de Supabase.";
    statusEl.classList.add("err");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando…";

  const { error } = await supabase.from("leads").insert(data);

  btn.disabled = false;
  btn.textContent = "Pedir mi asesoría gratis";

  if (error) {
    console.error(error);
    statusEl.textContent = error.code === "23514"
      ? "Algún dato no tiene el formato correcto. Revisa el correo y el WhatsApp e inténtalo de nuevo."
      : "No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.";
    statusEl.classList.add("err");
    return;
  }

  const primer = data.nombre_completo.split(" ")[0];
  const nombre = primer.charAt(0).toUpperCase() + primer.slice(1);
  document.getElementById("success-text").textContent =
    `Gracias, ${nombre}. Te escribiremos al ${data.whatsapp} por WhatsApp para armar tu propuesta.`;
  form.hidden = true;
  success.hidden = false;
  success.focus();
});
