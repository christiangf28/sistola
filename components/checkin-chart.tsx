import { Dimensions } from 'react-native';
import { G, Line, Circle, Path, Svg, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/theme';

type Checkin = { sueno: number; estres: number; actividad: number; med?: boolean };

const W = Dimensions.get('window').width - 64;
const H = 110;
const PAD = { top: 10, bottom: 24, left: 24, right: 8 };
const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;

function scale(val: number, min: number, max: number, size: number) {
  return size - ((val - min) / (max - min)) * size;
}

function toPath(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

type Entry = { fecha: string } & Checkin;

export function CheckinChart({ entries }: { entries: Entry[] }) {
  const data = [...entries].reverse().slice(-14);
  if (data.length < 2) return null;

  const xStep = chartW / (data.length - 1);

  const suenoPoints = data.map((e, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + scale(e.sueno, 3, 12, chartH),
  }));

  const estresPoints = data.map((e, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + scale(e.estres, 1, 5, chartH),
  }));

  const tickCount = Math.min(data.length, 5);
  const tickIndices = data.length <= 5
    ? data.map((_, i) => i)
    : Array.from({ length: tickCount }, (_, i) => Math.round(i * (data.length - 1) / (tickCount - 1)));

  const refLines = [
    { val: 7, label: '7h', color: '#E8E6F8' },
    { val: 8, label: '8h', color: '#E8E6F8' },
  ];

  return (
    <Svg width={W} height={H}>
      <G>
        {refLines.map(({ val, label, color }) => {
          const y = PAD.top + scale(val, 3, 12, chartH);
          if (y < PAD.top || y > PAD.top + chartH) return null;
          return (
            <G key={val}>
              <Line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke={color} strokeWidth={1} strokeDasharray="3,3" />
              <SvgText x={0} y={y + 4} fontSize={8} fill="#ccc">{label}</SvgText>
            </G>
          );
        })}

        <Path d={toPath(suenoPoints)} stroke="#5B9BD5" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {suenoPoints.map((p, i) => <Circle key={`su${i}`} cx={p.x} cy={p.y} r={2.5} fill="#5B9BD5" />)}

        <Path d={toPath(estresPoints)} stroke={Colors.accent} strokeWidth={1.5} fill="none" strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" />
        {estresPoints.map((p, i) => <Circle key={`es${i}`} cx={p.x} cy={p.y} r={2} fill={Colors.accent} />)}

        {tickIndices.map(i => {
          const d = new Date(data[i].fecha + 'T00:00:00');
          return (
            <SvgText key={i} x={PAD.left + i * xStep} y={H - 4} fontSize={9} fill={Colors.text.light} textAnchor="middle">
              {`${d.getDate()}/${d.getMonth() + 1}`}
            </SvgText>
          );
        })}
      </G>
    </Svg>
  );
}
