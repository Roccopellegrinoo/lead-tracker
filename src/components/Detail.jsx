import { useState, useEffect } from "react";
import { S } from "../lib/styles";
import { STAGES, TEMP, PRODUCTS, CHANNELS, FOLLOW_UP_PRESETS } from "../lib/constants";
import { getTemp, fmtFull, fmtMoney, isOverdue, dateInDays } from "../lib/utils";

export default function Detail({
  lead,
  ints,
  allInts,
  onBack,
  onUpdate,
  onDelete,
  onAddInt,
  onMove,
  quickAction,
  setFollowUp
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(lead);
  const [confirmDel, setConfirmDel] = useState(false);
  const stg = STAGES.find(s => s.id === lead.stage);
  const temp = getTemp(lead, allInts);
  const t = temp ? TEMP[temp] : null;

  useEffect(() => setForm(lead), [lead]);

  const save = () => {
    onUpdate(form);
    setEditing(false);
  };

  return (
    <div style={S.fade}>
      <button style={S.backBtn} onClick={onBack}>← Volver</button>
      <div style={S.detailHead}>
        <div>
          <div style={S.titleRow}>
            <h2 style={S.h2}>{lead.name}</h2>
            {t && <span style={{ fontSize: 16 }} title={t.name}>{t.label}</span>}
          </div>
          <div style={S.chips}>
            <span style={{ ...S.pill, background: stg?.color + "20", color: stg?.color }}>{stg?.label}</span>
            {lead.product && <span style={S.chip}>{lead.product}</span>}
            {lead.channel && <span style={S.chip}>{lead.channel}</span>}
            {lead.attempts > 0 && <span style={S.chipWarn}>{lead.attempts} intento{lead.attempts > 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div style={S.detailActions}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.id} onClick={() => quickAction(a)} style={S.qBtn} title={a.label}>
              {a.icon} {a.label}
            </button>
          ))}
          <button style={S.secBtn} onClick={() => setEditing(!editing)}>
            {editing ? "Cancelar" : "Editar"}
          </button>
          <button style={S.priBtn} onClick={onAddInt}>+ Interacción</button>
        </div>
      </div>
      <div style={S.stageRow}>
        {STAGES.map(s => (
          <button
            key={s.id}
            onClick={() => onMove(s.id)}
            style={
              lead.stage === s.id
                ? { ...S.stgBtn, background: s.color, color: "#fff", borderColor: s.color }
                : S.stgBtn
            }
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <div style={S.followBar}>
        <span style={S.followLabel}>Próximo seguimiento:</span>
        {FOLLOW_UP_PRESETS.map(p => (
          <button key={p.label} style={S.fOff} onClick={() => setFollowUp(p.days)}>
            {p.label}
          </button>
        ))}
        {lead.followUpDate && (
          <span style={isOverdue(lead.followUpDate) ? S.followDanger : S.followDate}>
            {fmtFull(lead.followUpDate)}
          </span>
        )}
      </div>
      {lead.lossReason && <div style={S.lossNote}>Motivo de pérdida: <strong>{lead.lossReason}</strong></div>}
      {editing ? (
        <div style={S.editBox}>
          <div style={{ marginBottom: 8, flex: 1 }}>
            <label style={S.lbl}>Nombre</label>
            <input style={S.input} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ marginBottom: 8, flex: 1 }}>
            <label style={S.lbl}>Teléfono</label>
            <input style={S.input} value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div style={{ marginBottom: 8, flex: 1 }}>
            <label style={S.lbl}>Email</label>
            <input style={S.input} value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={S.fRow}>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Producto</label>
              <select style={S.input} value={form.product || ""} onChange={e => setForm({ ...form, product: e.target.value })}>
                <option value="">-</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Monto</label>
              <input style={S.input} type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div style={S.fRow}>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Canal</label>
              <select style={S.input} value={form.channel || ""} onChange={e => setForm({ ...form, channel: e.target.value })}>
                <option value="">-</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 8, flex: 1 }}>
              <label style={S.lbl}>Follow-up</label>
              <input style={S.input} type="date" value={form.followUpDate?.slice(0, 10) || ""} onChange={e => setForm({ ...form, followUpDate: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: 8, flex: 1 }}>
            <label style={S.lbl}>Notas</label>
            <textarea style={{ ...S.input, minHeight: 62, resize: "vertical" }} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={S.buttonRow}>
            <button style={S.priBtn} onClick={save}>Guardar</button>
            <button style={S.danBtn} onClick={() => setConfirmDel(true)}>Eliminar</button>
          </div>
          {confirmDel && (
            <div style={S.confirmBox}>
              <span style={{ color: "#f87171", fontSize: 12 }}>¿Seguro?</span>
              <button style={S.danBtn} onClick={onDelete}>Confirmar</button>
            </div>
          )}
        </div>
      ) : (
        <div style={S.infoWrap}>
          <div style={S.infoGrid}>
            <Info label="Teléfono" val={lead.phone} />
            <Info label="Email" val={lead.email} />
            <Info label="Monto" val={fmtMoney(lead.amount)} />
            <Info label="Follow-up" val={lead.followUpDate ? fmtFull(lead.followUpDate) : null} red={isOverdue(lead.followUpDate)} />
            <Info label="Creado" val={fmtFull(lead.createdAt)} />
            <Info label="Último contacto" val={lead.lastContact ? fmtFull(lead.lastContact) : "Nunca"} />
          </div>
          {lead.notes && <p style={S.notes}>{lead.notes}</p>}
        </div>
      )}
      <div style={S.history}>
        <h3 style={S.secTitle}>Historial ({ints.length})</h3>
        {ints.length === 0 ? (
          <p style={S.noData}>Sin interacciones</p>
        ) : (
          <div>
            {ints.map(i => (
              <div key={i.id} style={S.tlItem}>
                <div style={S.tlDot} />
                <div style={{ flex: 1 }}>
                  <div style={S.tlHead}>
                    <span style={S.tlType}>{i.type}</span>
                    <span style={S.tlDate}>{fmtFull(i.date)}</span>
                  </div>
                  <p style={S.tlNote}>{i.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, val, red }) {
  return (
    <div>
      <span style={S.infoLabel}>{label}</span>
      <p style={{ ...S.infoValue, color: red ? "#b91c1c" : "#172033", fontWeight: red ? 700 : 500 }}>
        {val || "-"}
      </p>
    </div>
  );
}
