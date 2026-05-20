import { S } from "../lib/styles";
import { STAGES } from "../lib/constants";
import { daysAgo, fmtMoney } from "../lib/utils";

export default function Dashboard({ leads, ints, pipeline$, convRate, converted, active }) {
  const lost = leads.filter(l => l.stage === "perdido");
  const weekInts = ints.filter(i => daysAgo(i.date) <= 7).length;
  const stgData = STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.stage === s.id).length,
    amt: leads.filter(l => l.stage === s.id).reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
  }));
  const maxC = Math.max(...stgData.map(s => s.count), 1);

  const lossMap = {};
  lost.forEach(l => {
    const r = l.lossReason || "Sin motivo";
    lossMap[r] = (lossMap[r] || 0) + 1;
  });

  const prodMap = {};
  leads.forEach(l => {
    if (l.product) prodMap[l.product] = (prodMap[l.product] || 0) + 1;
  });

  return (
    <div style={S.fadeStackLg}>
      <div style={S.bigStatsGrid}>
        <BigStat label="Pipeline activo" value={`$${(pipeline$ / 1000).toFixed(0)}k`} sub={`${active.length} leads`} color="#2563eb" />
        <BigStat label="Conversión" value={`${convRate}%`} sub={`${converted.length} invertidos`} color="#4ade80" />
        <BigStat label="Perdidos" value={lost.length} sub={`de ${leads.length}`} color="#f87171" />
        <BigStat label="Actividad 7d" value={weekInts} sub="interacciones" color="#fbbf24" />
      </div>
      <div>
        <h3 style={S.secTitle}>Funnel</h3>
        {stgData.map(s => (
          <div key={s.id} style={S.funnelRow}>
            <span style={S.funnelLabel}>{s.label}</span>
            <div style={S.funnelTrack}>
              <div
                style={{
                  ...S.funnelFill,
                  width: `${(s.count / maxC) * 100}%`,
                  background: s.color,
                  minWidth: s.count > 0 ? 28 : 0
                }}
              >
                <span style={S.funnelCount}>{s.count}</span>
              </div>
            </div>
            <span style={S.funnelAmt}>{fmtMoney(s.amt)}</span>
          </div>
        ))}
      </div>
      <div style={S.twoCols}>
        <MetricList
          title="Motivos de pérdida"
          empty="Sin datos"
          entries={Object.entries(lossMap).sort((a, b) => b[1] - a[1])}
          color="#f87171"
        />
        <MetricList
          title="Por producto"
          empty="Sin datos"
          entries={Object.entries(prodMap)}
          color="#2563eb"
        />
      </div>
    </div>
  );
}

function MetricList({ title, empty, entries, color }) {
  return (
    <div>
      <h3 style={S.secTitle}>{title}</h3>
      {entries.length === 0 ? (
        <p style={S.noData}>{empty}</p>
      ) : (
        entries.map(([name, count]) => (
          <div key={name} style={S.metricRow}>
            <span style={S.metricName}>{name}</span>
            <span style={{ ...S.metricCount, color }}>{count}</span>
          </div>
        ))
      )}
    </div>
  );
}

function BigStat({ label, value, sub, color }) {
  const FM = "'DM Mono', 'SF Mono', monospace";
  return (
    <div style={S.bigStat}>
      <span style={S.bigStatLabel}>{label}</span>
      <span style={{ ...S.bigStatValue, color }}>{value}</span>
      <span style={S.bigStatSub}>{sub}</span>
    </div>
  );
}
