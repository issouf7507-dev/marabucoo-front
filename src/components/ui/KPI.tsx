interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  color?: 'g' | 'r' | 'a' | 'b' | 'p' | 't';
}

export default function KPI({ label, value, sub, color = '' as never }: KPIProps & { color?: string }) {
  return (
    <div className={`kpi${color ? ' ' + color : ''}`}>
      <div className="kpi-l">{label}</div>
      <div className="kpi-v">{value}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}
