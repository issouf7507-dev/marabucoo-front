import { YEAR_OPTIONS } from '../../utils/format';

interface Props {
  value: number;
  onChange: (y: number) => void;
  style?: React.CSSProperties;
}

export default function YearSelect({ value, onChange, style }: Props) {
  return (
    <select
      className="sel"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: 90, fontFamily: 'var(--fm)', fontWeight: 700, ...style }}
    >
      {YEAR_OPTIONS.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
