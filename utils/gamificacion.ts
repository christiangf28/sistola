type Registro = { sys: number; dia: number; fecha: string };
type Checkin = { sueno: number; estres: number; actividad: number; med?: boolean; fecha: string };

export type Logro = {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  desbloqueado: boolean;
  progreso?: { actual: number; total: number };
};

export const NIVELES = [
  { min: 0,    label: 'Explorador', color: '#9E9E9E' },
  { min: 100,  label: 'Guardián',   color: '#4CAF50' },
  { min: 350,  label: 'Protector',  color: '#2196F3' },
  { min: 900,  label: 'Maestro',    color: '#9C27B0' },
  { min: 1500, label: 'Leyenda',    color: '#FF9800' },
];

export function getNivel(aura: number) {
  return [...NIVELES].reverse().find(n => aura >= n.min) ?? NIVELES[0];
}

export function getSiguienteNivel(aura: number) {
  return NIVELES.find(n => n.min > aura) ?? null;
}

export function calcRacha(registros: Registro[]): number {
  if (!registros.length) return 0;
  const dias = new Set(registros.map(r => r.fecha.split('T')[0]));
  let n = 0;
  const d = new Date();
  while (dias.has(d.toISOString().split('T')[0])) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Aura = (días con registro ×10 + días con check-in ×15 + días con lectura normal ×5) × multiplicador de racha
// Multiplicador: racha ≥30 → ×2.0, racha ≥7 → ×1.5, resto → ×1.0
export function calcAura(
  registros: Registro[],
  checkinsPorDia: Record<string, Checkin>,
  racha: number
): number {
  const diasConRegistro = new Set(registros.map(r => r.fecha.split('T')[0])).size;
  const diasConCheckin = Object.keys(checkinsPorDia).length;
  const diasConNormal = new Set(
    registros.filter(r => r.sys < 130 && r.dia < 85).map(r => r.fecha.split('T')[0])
  ).size;

  const base = diasConRegistro * 10 + diasConCheckin * 15 + diasConNormal * 5;
  const mult = racha >= 30 ? 2.0 : racha >= 7 ? 1.5 : 1.0;
  return Math.round(base * mult);
}

function maxNormalesConsecutivas(registros: Registro[]): number {
  const sorted = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let max = 0, count = 0;
  for (const r of sorted) {
    if (r.sys < 130 && r.dia < 85) { count++; max = Math.max(max, count); }
    else count = 0;
  }
  return max;
}

export function getLogros(
  registros: Registro[],
  checkinsPorDia: Record<string, Checkin>
): Logro[] {
  const diasConRegistro = new Set(registros.map(r => r.fecha.split('T')[0])).size;
  const racha = calcRacha(registros);
  const totalCheckins = Object.keys(checkinsPorDia).length;
  const diasConMed = Object.values(checkinsPorDia).filter(c => c.med).length;
  const diasConBuenSueno = Object.values(checkinsPorDia).filter(c => c.sueno >= 7).length;
  const normalesConsec = maxNormalesConsecutivas(registros);

  return [
    {
      id: 'primera',
      titulo: 'Primera medición',
      descripcion: 'Registraste tu primera presión',
      icono: '🎯',
      desbloqueado: registros.length >= 1,
    },
    {
      id: 'semana',
      titulo: 'Una semana',
      descripcion: '7 días seguidos registrando',
      icono: '🔥',
      desbloqueado: racha >= 7,
      progreso: { actual: Math.min(racha, 7), total: 7 },
    },
    {
      id: 'mes',
      titulo: 'Mes completo',
      descripcion: '30 días con al menos un registro',
      icono: '📅',
      desbloqueado: diasConRegistro >= 30,
      progreso: { actual: Math.min(diasConRegistro, 30), total: 30 },
    },
    {
      id: 'controlada',
      titulo: 'Presión controlada',
      descripcion: '7 lecturas normales consecutivas',
      icono: '💚',
      desbloqueado: normalesConsec >= 7,
      progreso: { actual: Math.min(normalesConsec, 7), total: 7 },
    },
    {
      id: 'descanso',
      titulo: 'Buen descanso',
      descripcion: '10 noches con ≥7h de sueño',
      icono: '😴',
      desbloqueado: diasConBuenSueno >= 10,
      progreso: { actual: Math.min(diasConBuenSueno, 10), total: 10 },
    },
    {
      id: 'habito',
      titulo: 'Hábito formado',
      descripcion: '30 check-ins completados',
      icono: '✅',
      desbloqueado: totalCheckins >= 30,
      progreso: { actual: Math.min(totalCheckins, 30), total: 30 },
    },
    {
      id: 'medicado',
      titulo: 'Adherencia total',
      descripcion: '14 días con medicamento tomado',
      icono: '💊',
      desbloqueado: diasConMed >= 14,
      progreso: { actual: Math.min(diasConMed, 14), total: 14 },
    },
    {
      id: 'imparable',
      titulo: 'Imparable',
      descripcion: '30 días seguidos registrando',
      icono: '⚡',
      desbloqueado: racha >= 30,
      progreso: { actual: Math.min(racha, 30), total: 30 },
    },
  ];
}
