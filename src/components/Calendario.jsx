import { useState } from "react";
import { S } from "../lib/styles";
import { STAGES, TEMP, QUICK_ACTIONS } from "../lib/constants";
import { dateKey, calendarDays, sameMonth, addMonths, monthLabel, fmtFull, fmt, isOverdue, dateInDays } from "../lib/utils";

export default function Calendario({ leads, ints, onSelect, onUpdate, quickAction }) {
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const weekdays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const active = leads.filter(l => !["invertido", "perdido"].includes(l.stage));

  const byDate = active.reduce((map, lead) => {
    const key = dateKey(lead.followUpDate);
    if (!key) return map;
    map[key] = [...(map[key] || []), lead];
    return map;
  }, {});

  const days = calendarDays(month);
  const selectedLeads = (byDate[selectedDate] || []).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const overdue = active.filter(l => isOverdue(l.followUpDate)).sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
  const todayKey = dateKey(new Date());
  const monthCount = active.filter(l => l.followUpDate && sameMonth(new Date(l.followUpDate), month)).length;

  return (
    <div style={S.calendarWrap}>
      <div style={S.calendarHead}>
        <div>
          <h2 style={S.h2}>Calendario</h2>
          <p style={S.muted}>{monthCount} seguimiento{monthCount === 1 ? "" : "s"} este mes</p>
        </div>
        <div style={S.calendarControls}>
          <button style={S.secBtn} onClick={() => setMonth(addMonths(month, -1))}>Anterior</button>
          <button
            style={S.secBtn}
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(dateKey(now));
            }}
          >
            Hoy
          </button>
          <button style={S.secBtn} onClick={() => setMonth(addMonths(month, 1))}>Siguiente</button>
        </div>
      </div>
      <div style={S.calendarLayout}>
        <div style={S.calendarPanel}>
          <div style={S.calendarTitle}>{monthLabel(month)}</div>
          <div style={S.weekGrid}>{weekdays.map(day => <div key={day} style={S.weekday}>{day}</div>)}</div>
          <div style={S.monthGrid}>
            {days.map(day => {
              const key = dateKey(day);
              const items = byDate[key] || [];
              const selected = key === selectedDate;
              const isCurrentMonth = sameMonth(day, month);
              const isTodayCell = key === todayKey;
              return (
                <button
                  key={key}
                  style={{
                    ...S.dayCell,
                    ...(isCurrentMonth ? {} : S.dayMuted),
                    ...(selected ? S.daySelected : {}),
                    ...(isTodayCell ? S.dayToday : {})
                  }}
                  onClick={() => setSelectedDate(key)}
                >
                  <span style={S.dayNumber}>{day.getDate()}</span>
                  {items.length > 0 && <span style={S.dayCount}>{items.length}</span>}
                  <div style={S.dayDots}>
                    {items.slice(0, 3).map(item => {
                      const stg = STAGES.find(s => s.id === item.stage);
                      return <span key={item.id} style={{ ...S.dayDot, background: stg?.color || "#2563eb" }} />;
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={S.calendarSide}>
          <CalendarLeadList
            title={`Agenda ${fmtFull(selectedDate)}`}
            leads={selectedLeads}
            ints={ints}
            empty="Sin seguimientos para este dia"
            onSelect={onSelect}
            onUpdate={onUpdate}
            quickAction={quickAction}
          />
          {overdue.length > 0 && (
            <CalendarLeadList
              title={`Vencidos (${overdue.length})`}
              leads={overdue.slice(0, 8)}
              ints={ints}
              onSelect={onSelect}
              onUpdate={onUpdate}
              quickAction={quickAction}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarLeadList({ title, leads, ints, empty, onSelect, onUpdate, quickAction, compact }) {
  return (
    <div style={S.calendarList}>
      <h3 style={S.secTitle}>{title}</h3>
      {leads.length === 0 ? (
        <p style={S.noData}>{empty}</p>
      ) : (
        leads.map(lead => {
          const stg = STAGES.find(s => s.id === lead.stage);
          const temp = getTemp(lead, ints);
          const t = temp ? TEMP[temp] : null;
          return (
            <div key={lead.id} style={S.calendarItem}>
              <div style={S.calendarItemMain} onClick={() => onSelect(lead)}>
                <span style={{ ...S.pill, background: stg?.color + "20", color: stg?.color }}>{stg?.label}</span>
                <strong style={S.leadName}>{lead.name}</strong>
                <div style={S.chips}>
                  {t && <span style={S.chip}>{t.name}</span>}
                  {lead.phone && <span style={S.chip}>{lead.phone}</span>}
                  {lead.email && <span style={S.chip}>{lead.email}</span>}
                  {lead.followUpDate && (
                    <span style={isOverdue(lead.followUpDate) ? S.chipDanger : S.chip}>
                      FU {fmt(lead.followUpDate)}
                    </span>
                  )}
                </div>
              </div>
              {!compact && (
                <div style={S.quickRow}>
                  {QUICK_ACTIONS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => quickAction(lead.id, a)}
                      style={S.qBtn}
                      title={a.label}
                    >
                      {a.icon}
                    </button>
                  ))}
                  <button style={S.qBtn} onClick={() => onUpdate(lead.id, { followUpDate: dateInDays(1) })}>
                    +1d
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
