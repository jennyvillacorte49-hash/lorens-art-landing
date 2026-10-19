import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const $ = (id) => document.getElementById(id);

if (!URL || !KEY) {
  $("config-error").hidden = false;
  $("config-error").textContent = "El panel no está conectado: faltan las variables de entorno de Supabase en Vercel.";
  throw new Error("Faltan variables de entorno");
}
const sb = createClient(URL, KEY);

// ── Etiquetas legibles ──
const PRESUPUESTO = { menos_25: "Menos de $25", "25_50": "$25 a $50", "50_100": "$50 a $100", mas_100: "Más de $100" };
const DOLOR = {
  no_coincide_foto: "Teme que llegue distinto a la foto",
  entrega_falla: "Teme que la entrega falle o llegue tarde",
  sin_respuesta: "Teme que nadie responda si hay un problema",
  otro: "Otra preocupación",
};
const CORREOS_PERSONALES = ["gmail.com", "hotmail.com", "outlook.com", "outlook.es", "yahoo.com", "yahoo.es", "live.com", "icloud.com"];

// Desglose del score: replica la función calcular_score_lead() de Supabase
function desglose(l) {
  const partes = [];
  partes.push(["Presupuesto", { mas_100: 40, "50_100": 30, "25_50": 18 }[l.presupuesto] ?? 5]);
  partes.push(["Dolor", ["no_coincide_foto", "entrega_falla", "sin_respuesta"].includes(l.dolor_principal) ? 25 : 5]);
  if ((l.empresa || "").trim()) partes.push(["Empresa", 20]);
  const dom = (l.correo.split("@")[1] || "").toLowerCase();
  if (!CORREOS_PERSONALES.includes(dom)) partes.push(["Correo propio", 15]);
  return partes.map(([k, v]) => `${k} +${v}`).join(", ");
}

// ── Motor de consejos comerciales (reglas) ──
function consejo(l) {
  const nombre = l.nombre_completo.split(" ")[0];
  const pasos = [];
  const urgencia = {
    Caliente: "Escríbele hoy, idealmente en menos de 1 hora: es tu prospecto con más intención de compra.",
    Tibio: "Escríbele dentro de las próximas 24 horas, antes de que cotice en otra florería.",
    Frío: "Seguimiento ligero: envíale el catálogo base y no inviertas una llamada todavía.",
  }[l.prioridad] || "Revisa sus datos y escríbele.";
  pasos.push(urgencia);

  const porDolor = {
    no_coincide_foto: "Abre con pruebas: comparte 2 o 3 fotos reales de arreglos de su rango de precio y recuérdale que aprueba la foto antes del envío.",
    entrega_falla: "Confirma desde el primer mensaje la fecha, la franja horaria y quién recibe; promete la foto de la entrega con la hora.",
    sin_respuesta: "Preséntate con tu nombre y responde rápido; deja claro que tendrá un contacto directo y menciona la política de reposición.",
    otro: "Haz una pregunta abierta para descubrir la necesidad real: ocasión, fecha y para quién es el arreglo.",
  };
  pasos.push(porDolor[l.dolor_principal] || porDolor.otro);

  if ((l.empresa || "").trim()) {
    pasos.push(`Es un pedido para ${l.empresa.trim()}: ofrece factura, un plan mensual o un precio por volumen para fechas corporativas.`);
  } else if (l.presupuesto === "menos_25") {
    pasos.push("Con este presupuesto, ofrece una opción del catálogo base o un arreglo pequeño; evita una asesoría larga.");
  } else if (l.presupuesto === "mas_100") {
    pasos.push("Presupuesto alto: propone dos diseños cerrados con precio y un detalle adicional (tarjeta, chocolates) como cierre.");
  } else {
    pasos.push("Propón dos opciones con precio cerrado, envío incluido, para que solo tenga que elegir.");
  }

  const mensajes = {
    no_coincide_foto: `Hola ${nombre}, soy de Loren's Art 🌹. Vi tu solicitud de asesoría. Te comparto fotos reales de arreglos de tu presupuesto; antes de enviar el tuyo te mando su foto para que lo apruebes. ¿Para qué ocasión es?`,
    entrega_falla: `Hola ${nombre}, soy de Loren's Art 🌹. Vi tu solicitud de asesoría. ¿Para qué fecha y a qué hora necesitas la entrega? Te enviamos la foto del arreglo entregado con la hora.`,
    sin_respuesta: `Hola ${nombre}, soy de Loren's Art 🌹 y seré tu contacto directo para tu pedido. Cuéntame qué tienes en mente y te respondo enseguida.`,
    otro: `Hola ${nombre}, soy de Loren's Art 🌹. Vi tu solicitud de asesoría. Cuéntame, ¿para qué ocasión y para quién es el arreglo?`,
  };
  return { pasos, mensaje: mensajes[l.dolor_principal] || mensajes.otro };
}

function waLink(numero, texto) {
  let d = String(numero).replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = "593" + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (iso) => new Date(iso).toLocaleString("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ── Estado de la vista ──
let leads = [];
let filtro = "Por contactar";

function render() {
  const pend = leads.filter((l) => l.estado !== "Contactado");
  const done = leads.filter((l) => l.estado === "Contactado");
  $("c-pend").textContent = pend.length;
  $("c-done").textContent = done.length;
  $("c-all").textContent = leads.length;

  const n = (p) => pend.filter((l) => l.prioridad === p).length;
  $("summary").innerHTML = `
    <span class="sum b-Caliente"><b>${n("Caliente")}</b> calientes</span>
    <span class="sum b-Tibio"><b>${n("Tibio")}</b> tibios</span>
    <span class="sum b-Frío"><b>${n("Frío")}</b> fríos</span>
    <span class="sum muted">por contactar</span>`;

  const lista = filtro === "Todos" ? leads : filtro === "Contactado" ? done : pend;
  $("leads").innerHTML = lista.map((l, i) => {
    const c = consejo(l);
    const hecho = l.estado === "Contactado";
    return `
    <li class="lead p-${esc(l.prioridad)}${hecho ? " done" : ""}">
      <div class="lead-top">
        <span class="rank">${i + 1}</span>
        <div class="who">
          <h2>${esc(l.nombre_completo)}</h2>
          <p class="sub">${l.empresa ? esc(l.empresa) + ", " : ""}${fecha(l.created_at)}</p>
        </div>
        <span class="badge b-${esc(l.prioridad)}">${esc(l.prioridad)} <span class="pts">${l.score} pts</span></span>
      </div>
      <div>
        <div class="facts">
          <span class="fact">${esc(PRESUPUESTO[l.presupuesto] || l.presupuesto)}</span>
          <span class="fact">${esc(DOLOR[l.dolor_principal] || l.dolor_principal)}</span>
        </div>
        <p class="breakdown">Score: ${esc(desglose(l))}</p>
        <p class="breakdown">${esc(l.whatsapp)}, ${esc(l.correo)}</p>
      </div>
      <div class="tip">
        <h3>Consejo comercial sugerido</h3>
        <ul>${c.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>
      <div class="actions">
        <a class="btn btn-wa" href="${waLink(l.whatsapp, c.mensaje)}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
        <a class="btn-ghost" href="mailto:${esc(l.correo)}">Enviar correo</a>
        <div class="state">
          <span class="state-label ${hecho ? "ok" : "pend"}">${hecho ? "Contactado" : "Por contactar"}</span>
          <button class="btn-ghost" data-id="${l.id}" data-next="${hecho ? "Por contactar" : "Contactado"}">
            ${hecho ? "Volver a por contactar" : "Marcar como contactado"}
          </button>
        </div>
      </div>
    </li>`;
  }).join("");

  const vacio = !lista.length;
  $("empty").hidden = !vacio;
  $("empty").textContent = filtro === "Contactado"
    ? "Todavía no marcas a nadie como contactado."
    : filtro === "Por contactar" ? "No hay prospectos pendientes. Los nuevos registros de la web aparecerán aquí." : "Aún no hay registros.";
}

async function cargar() {
  const { data, error } = await sb.from("leads")
    .select("id, created_at, nombre_completo, correo, whatsapp, empresa, presupuesto, dolor_principal, score, prioridad, estado, contactado_at")
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    $("empty").hidden = false;
    $("empty").textContent = "No se pudieron cargar los prospectos. Revisa que ejecutaste el SQL de la Semana 3 en Supabase.";
    console.error(error);
    return;
  }
  leads = data || [];
  $("updated").textContent = `Ordenados automáticamente por score. Última actualización: ${new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;
  render();
}

// Cambiar estado
$("leads").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  b.disabled = true;
  const estado = b.dataset.next;
  const { error } = await sb.from("leads")
    .update({ estado, contactado_at: estado === "Contactado" ? new Date().toISOString() : null })
    .eq("id", b.dataset.id);
  if (error) { alert("No se pudo actualizar el estado. Inténtalo de nuevo."); b.disabled = false; return; }
  const l = leads.find((x) => x.id === b.dataset.id);
  if (l) l.estado = estado;
  render();
});

// Pestañas
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
  filtro = t.dataset.filter;
  render();
}));

$("refresh").addEventListener("click", cargar);

// Sesión
let timer;
async function mostrar(session) {
  const dentro = Boolean(session);
  $("login-view").hidden = dentro;
  $("inbox-view").hidden = !dentro;
  $("logout").hidden = !dentro;
  clearInterval(timer);
  if (dentro) { await cargar(); timer = setInterval(cargar, 30000); }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").textContent = "";
  $("login-btn").disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  $("login-btn").disabled = false;
  if (error) { $("login-error").textContent = "Correo o contraseña incorrectos."; return; }
  mostrar(data.session);
});

$("logout").addEventListener("click", async () => { await sb.auth.signOut(); mostrar(null); });

const { data: { session } } = await sb.auth.getSession();
mostrar(session);
