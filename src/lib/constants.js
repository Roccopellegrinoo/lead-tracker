export const STAGES = [
  { id: "nuevo", label: "Nuevo", color: "#2563eb", icon: "◉" },
  { id: "contactado", label: "Contactado", color: "#fbbf24", icon: "◆" },
  { id: "interesado", label: "Interesado", color: "#10b981", icon: "▲" },
  { id: "propuesta", label: "Propuesta", color: "#0ea5e9", icon: "■" },
  { id: "invertido", label: "Invertido", color: "#16a34a", icon: "★" },
  { id: "perdido", label: "Perdido", color: "#ef4444", icon: "✕" },
];

export const CHANNELS = ["WhatsApp", "Llamada", "Email", "Presencial", "Sendis"];
export const PRODUCTS = ["Crowdium", "TechFinance"];
export const LOSS_REASONS = ["No interesado", "Fue con la competencia", "No califica", "Sin respuesta", "Timing malo", "Otro"];
export const QUICK_ACTIONS = [
  { id: "no_atendio", label: "No atendió", icon: "☎", type: "No atendió" },
  { id: "llamar_despues", label: "Llamar mañana", icon: "↗", type: "Llamar después" },
  { id: "contactado", label: "Contactado", icon: "✓", type: "Contacto realizado" },
];
export const FOLLOW_UP_PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "+7 días", days: 7 },
  { label: "+10 días", days: 10 },
];

export const NAME_STOPWORDS = [
  "nombre", "apellido", "telefono", "teléfono", "tel", "cel", "celular", "whatsapp", "mail", "email",
  "producto", "monto", "capital", "inversion", "inversión", "lead", "cliente", "contacto", "fecha",
  "estado", "origen", "observacion", "observación", "nota", "notas", "nuevo", "interesado",
  "contactado", "propuesta", "crowdium", "techfinance", "sendis", "usd", "ars", "contesta", "alas", "las",
  "vencidos", "contactar", "ya", "sin", "fu"
];

export const TEMP = {
  hot: { label: "🔥", name: "Caliente", color: "#ef4444", bg: "#ef444415" },
  warm: { label: "🟡", name: "Tibio", color: "#f59e0b", bg: "#f59e0b15" },
  cold: { label: "🧊", name: "Frío", color: "#6366f1", bg: "#6366f115" },
};

export const F = "'DM Sans', system-ui, sans-serif";
export const FM = "'DM Mono', 'SF Mono', monospace";
