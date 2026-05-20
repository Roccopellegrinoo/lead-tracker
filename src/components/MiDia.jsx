import { useState, useEffect } from "react";
import { S } from "../lib/styles";
import { TEMP, FM, QUICK_ACTIONS, PRODUCTS } from "../lib/constants";
import { fmt, fmtMoney, getTemp, daysAgo, isOverdue, dateInDays, cleanAmount } from "../lib/utils";

export default function MiDia({
  overdue,
  today,
  tomorrow,
  hotNoAction,
  fu10d,
  untouched,
  ints,
  onSelect,
  onUpdate,
  onDelete,
  quickAction,
  pipeline$,
  convRate,
  active,
  onAdd
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buen día" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const totalActions = overdue.length + today.length + untouched.length;

  return (
    <div style={S.fadeStack}>
      <div style={S.heroRow}>
        <div>
          <h2 style={S.h2}>{greeting}</h2>
          <p style={S.muted}>
            {totalActions > 0
              ? `Tenés ${totalActions} acción${totalActions > 1 ? "es" : ""} para empujar hoy`
              : "Todo al día. Podés cargar nuevos leads o revisar oportunidades calientes."}
          </p>
        </div>
        <div style={S.statsRow}>
          <MiniStat label="Pipeline" value={`$${(pipeline$ / 1000).toFixed(0)}k`} color="#2563eb" />
          <MiniStat label="Activos" value={active.length} color="#fbbf24" />
          <MiniStat label="Conversión" value={`${convRate}%`} color="#4ade80" />
        </div>
      </div>
      {overdue.length > 0 && (
        <ActionSection
          title="Vencidos - contactar ya"
          leads={overdue}
          color="#f87171"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          quickAction={quickAction}
          ints={ints}
        />
      )}
      {today.length > 0 && (
        <ActionSection
          title="Para hoy"
          leads={today}
          color="#fbbf24"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          quickAction={quickAction}
          ints={ints}
        />
      )}
      {untouched.length > 0 && (
        <ActionSection
          title="Sin contactar"
          leads={untouched}
          color="#2563eb"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          quickAction={quickAction}
          ints={ints}
        />
      )}
      {fu10d.length > 0 && (
        <ActionSection
          title="Follow-up 10d (contactados)"
          leads={fu10d}
          color="#fb923c"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          quickAction={quickAction}
          ints={ints}
          showDays
        />
      )}
      {tomorrow.length > 0 && (
        <ActionSection
          title="Mañana"
          leads={tomorrow}
          color="#667085"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          quickAction={quickAction}
          ints={ints}
        />
      )}
      {hotNoAction.length > 0 && (
        <ActionSection
          title="Calientes sin follow-up agendado"
          leads={hotNoAction}
          color="#ef4444"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          quickAction={quickAction}
          ints={ints}
        />
      )}
      {overdue.length === 0 && today.length === 0 && untouched.length === 0 && fu10d.length === 0 && (
        <div style={S.empty}>
          <p style={{ fontSize: 14, margin: 0, color: "#667085" }}>No tenés acciones pendientes.</p>
          <button style={{ ...S.priBtn, marginTop: 14 }} onClick={onAdd}>Cargar leads</button>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: FM }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function ActionSection({ title, leads, color, onSelect, onUpdate, onDelete, quickAction, ints, showDays }) {
  return (
    <div>
      <h3 style={{ ...S.secTitle, color }}>
        {title} <span style={S.count}>{leads.length}</span>
      </h3>
      <div style={S.actionList}>
        {leads.map(l => {
          const temp = getTemp(l, ints);
          const t = temp ? TEMP[temp] : null;
          return (
            <ActionCard
              key={l.id}
              lead={l}
              temp={t}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onDelete={onDelete}
              quickAction={quickAction}
              showDays={showDays}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActionCard({ lead, temp, onSelect, onUpdate, onDelete, quickAction, showDays }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(lead);

  useEffect(() => setForm(lead), [lead]);

  const save = () => {
    onUpdate(lead.id, { ...form, amount: cleanAmount(form.amount) });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={S.actionCardEdit}>
        <div style={S.inlineEditGrid}>
          <input
            style={{ ...S.gridInput, flex: 2 }}
            value={form.name || ""}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre"
          />
          <input
            style={S.gridInput}
            value={form.phone || ""}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="Teléfono"
          />
          <input
            style={{ ...S.gridInput, flex: 1.4 }}
            value={form.email || ""}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
          />
          <select
            style={S.gridInput}
            value={form.product || ""}
            onChange={e => setForm({ ...form, product: e.target.value })}
          >
            <option value="">Producto</option>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            style={S.gridInput}
            value={form.amount || ""}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            placeholder="Monto"
          />
          <input
            style={S.gridInput}
            type="date"
            value={form.followUpDate?.slice(0, 10) || ""}
            onChange={e => setForm({ ...form, followUpDate: e.target.value })}
          />
        </div>
        <div style={S.quickRow}>
          <button style={S.priBtn} onClick={save}>Guardar</button>
          <button style={S.secBtn} onClick={() => { setForm(lead); setEditing(false); }}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.actionCard}>
      <div style={S.actionMain} onClick={() => onSelect(lead)}>
        {temp && <span style={{ fontSize: 14 }} title={temp.name}>{temp.label}</span>}
        <div>
          <span style={S.leadName}>{lead.name}</span>
          <div style={S.chips}>
            {lead.product && <span style={S.chip}>{lead.product}</span>}
            {lead.amount && <span style={S.chip}>{fmtMoney(lead.amount)}</span>}
            {lead.followUpDate && <span style={S.chip}>FU {fmt(lead.followUpDate)}</span>}
            {lead.attempts > 0 && <span style={S.chipWarn}>{lead.attempts} intento{lead.attempts > 1 ? "s" : ""}</span>}
            {showDays && lead.lastContact && <span style={S.chipWarn}>{daysAgo(lead.lastContact)}d sin contacto</span>}
          </div>
        </div>
      </div>
      <div style={S.quickRow}>
        <button style={S.qBtn} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>Editar</button>
        {confirmDelete ? (
          <>
            <button style={S.danBtn} onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}>Confirmar</button>
            <button style={S.secBtn} onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}>Cancelar</button>
          </>
        ) : (
          <button style={S.qBtn} onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}>Borrar</button>
        )}
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={(e) => { e.stopPropagation(); quickAction(lead.id, a); }}
            style={S.qBtn}
            title={a.label}
          >
            {a.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
