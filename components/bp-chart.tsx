import { Dimensions } from 'react-native';
import { G, Line, Svg, Circle, Path, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/use-theme-color';

type Registro = { sys: number; dia: number; pul?: number; fecha: string };

const PUL_COLOR = '#0097A7';

const W = Dimensions.get('window').width - 64;
const H = 140;
const PAD = { top: 12, bottom: 28, left: 28, right: 8 };

const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;

function scale(val: number, min: number, max: number, size: number) {
  return size - ((val - min) / (max - min)) * size;
}

function pointsToPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function BpChart({ registros, metaSys }: { registros: Registro[]; metaSys?: number }) {
  const C = useColors();
  const data = [...registros].reverse().slice(-14);
  if (data.length < 2) return null;

  const allSys = data.map(r => r.sys);
  const allDia = data.map(r => r.dia);
  const pulData = data.filter(r => r.pul !== undefined);
  const minVal = Math.min(...allDia, 60, ...(pulData.map(r => r.pul!))) - 5;
  const maxVal = Math.max(...allSys, 140) + 5;

  const xStep = chartW / (data.length - 1);

  const sysPoints = data.map((r, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + scale(r.sys, minVal, maxVal, chartH),
  }));
  const diaPoints = data.map((r, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + scale(r.dia, minVal, maxVal, chartH),
  }));

  const refLines = [
    { val: 140, label: '140', isWarning: true },
    { val: 90,  label: '90',  isWarning: true },
    { val: 120, label: '120', isWarning: false },
    { val: 80,  label: '80',  isWarning: false },
  ];

  const tickCount = Math.min(data.length, 5);
  const tickIndices = data.length <= 5
    ? data.map((_, i) => i)
    : Array.from({ length: tickCount }, (_, i) =>
        Math.round(i * (data.length - 1) / (tickCount - 1)));

  return (
    <Svg width={W} height={H}>
      <G>
        {refLines.map(({ val, label, isWarning }) => {
          const y = PAD.top + scale(val, minVal, maxVal, chartH);
          if (y < PAD.top || y > PAD.top + chartH) return null;
          const lineColor = isWarning ? C.warning : C.cardBorder;
          const labelColor = isWarning ? C.warning : C.text.light;
          return (
            <G key={val}>
              <Line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke={lineColor} strokeWidth={1} strokeDasharray={isWarning ? '4,2' : '3,3'} />
              <SvgText x={0} y={y + 4} fontSize={9} fill={labelColor} fontWeight="500">{label}</SvgText>
            </G>
          );
        })}

        {metaSys !== undefined && (() => {
          const y = PAD.top + scale(metaSys, minVal, maxVal, chartH);
          if (y < PAD.top || y > PAD.top + chartH) return null;
          return (
            <G key="meta">
              <Line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke={C.primary} strokeWidth={1.5} strokeDasharray="6,3" opacity={0.5} />
              <SvgText x={0} y={y + 4} fontSize={9} fill={C.primary} fontWeight="600">M</SvgText>
            </G>
          );
        })()}

        <Path d={pointsToPath(sysPoints)} stroke={C.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d={pointsToPath(diaPoints)} stroke={C.accent}  strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pulData.length >= 2 && (() => {
          const pts = pulData.map(r => {
            const i = data.indexOf(r);
            return { x: PAD.left + i * xStep, y: PAD.top + scale(r.pul!, minVal, maxVal, chartH) };
          });
          return <Path d={pointsToPath(pts)} stroke={PUL_COLOR} strokeWidth={1.5} fill="none" strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" />;
        })()}

        {sysPoints.map((p, i) => (
          <Circle key={`s${i}`} cx={p.x} cy={p.y} r={3} fill={C.primary} />
        ))}
        {diaPoints.map((p, i) => (
          <Circle key={`d${i}`} cx={p.x} cy={p.y} r={3} fill={C.accent} />
        ))}
        {pulData.map(r => {
          const i = data.indexOf(r);
          const y = PAD.top + scale(r.pul!, minVal, maxVal, chartH);
          return <Circle key={`p${i}`} cx={PAD.left + i * xStep} cy={y} r={2.5} fill={PUL_COLOR} />;
        })}

        {tickIndices.map(i => {
          const d = new Date(data[i].fecha);
          const label = `${d.getDate()}/${d.getMonth() + 1}`;
          return (
            <SvgText key={i} x={PAD.left + i * xStep} y={H - 4} fontSize={9} fill={C.text.light} textAnchor="middle">
              {label}
            </SvgText>
          );
        })}
      </G>
    </Svg>
  );
}
