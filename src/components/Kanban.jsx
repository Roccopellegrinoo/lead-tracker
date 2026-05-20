import { S } from "../lib/styles";
import { STAGES, TEMP, QUICK_ACTIONS } from "../lib/constants";
import { getTemp, daysAgo, isOverdue, isToday, fmt, fmtMoney } from "../lib/utils";

export default function Kanban({ leads, ints, onSelect, onMove, dragId, setDragId, quickAction }) {
  const visible = STAGES.filter(s => s.id !== "perdido");
  const lost = leads.filter(l => l.stage === "perdido");

  return (
    <div style={S.kanbanWrap}>
      <div style={S.kanban}>
        {visible.map(stg => {
          const sl = leads.filter(l => l.stage === stg.id);
          const amt = sl.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
          return (
            <div
              key={stg.id}
              style={S.kCol}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragId) {
                  onMove(dragId, stg.id);
                  setDragId(null);
                }
              }}
            >
              <div style={S.kHead}>
                <div style={S.kHeadLeft}>
                  <span style={{ color: stg.color, fontSize: 9 }}>{stg.icon}</span>
                  <span style={S.kTitle}>{stg.label}</span>
                  <span style={S.kBadge}>{sl.length}</span>
                </div>
                {amt > 0 && <span style={S.kAmt}>${(amt / 1000).toFixed(0)}k</span>}
              </div>
              <div style={S.kCards}>
                {sl.map(l => (
                  <KCard
                    key={l.id}
                    lead={l}
                    ints={ints}
                    color={stg.color}
                    onClick={() => onSelect(l)}
                    onDrag={() => setDragId(l.id)}
                    quickAction={quickAction}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {lost.length > 0 && (
        <div
          style={S.lostBar}
          onDragOver={e => e.preventDefault()}
          onDrop={() => {
            if (dragId) {
              onMove(dragId, "perdido");
              setDragId(null);
            }
          }}
        >
          <span style={S.lostTitle}>✕ Perdidos ({lost.length})</span>
          {lost.map(l => (
            <span key={l.id} style={S.lostChip} onClick={() => onSelect(l)}>
              {l.name}
              {l.lossReason ? ` - ${l.lossReason}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KCard({ lead, ints, color, onClick, onDrag, quickAction }) {
  const temp = getTemp(lead, ints);
  const t = temp ? TEMP[temp] : null;
  const d = daysAgo(lead.lastContact);
  const od = isOverdue(lead.followUpDate);
  const td = isToday(lead.followUpDate);

  return (
    <div
      style={{ ...S.card, borderLeft: `3px solid ${color}` }}
      onClick={onClick}
      draggable
      onDragStart={onDrag}
    >
      <div style={S.cardTop}>
        <div style={S.cardName}>
          {t && <span>{t.label}</span>}
          <span>{lead.name}</span>
        </div>
        {lead.amount && <span style={S.cardAmount}>{fmtMoney(lead.amount)}</span>}
      </div>
      <div style={S.chips}>
        {lead.product && <span style={S.chip}>{lead.product}</span>}
        {d !== null && (
          <span
            style={{
              ...S.chip,
              ...(d >= 7
                ? { background: "#ef444418", color: "#f87171" }
                : d >= 3
                ? { background: "#f59e0b18", color: "#fbbf24" }
                : {})
            }}
          >
            {d}d
          </span>
        )}
        {lead.attempts > 0 && <span style={S.chipWarn}>{lead.attempts}x</span>}
        {od && <span style={S.chipDanger}>⚠ {fmt(lead.followUpDate)}</span>}
        {td && <span style={S.chipWarn}>hoy</span>}
      </div>
      <div style={S.quickSmallRow}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={e => {
              e.stopPropagation();
              quickAction(lead.id, a);
            }}
            style={S.qBtnSmall}
            title={a.label}
          >
            {a.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
