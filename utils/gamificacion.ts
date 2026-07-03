import i18n from '@/utils/i18n';
import { localDateStr } from '@/utils/fechas';

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
  { min: 0,    label: i18n.t('levels.Explorador'), color: '#9E9E9E' },
  { min: 100,  label: i18n.t('levels.Guardián'),   color: '#4CAF50' },
  { min: 350,  label: i18n.t('levels.Protector'),  color: '#2196F3' },
  { min: 900,  label: i18n.t('levels.Maestro'),    color: '#9C27B0' },
  { min: 1500, label: i18n.t('levels.Leyenda'),    color: '#FF9800' },
];

export function getNivel(aura: number) {
  return [...NIVELES].reverse().find(n => aura >= n.min) ?? NIVELES[0];
}

export function getSiguienteNivel(aura: number) {
  return NIVELES.find(n => n.min > aura) ?? null;
}

export function calcRacha(registros: Registro[]): number {
  if (!registros.length) return 0;
  const dias = new Set(registros.map(r => localDateStr(r.fecha)));
  let n = 0;
  const d = new Date();
  while (dias.has(localDateStr(d))) {
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
  const diasConRegistro = new Set(registros.map(r => localDateStr(r.fecha))).size;
  const diasConCheckin = Object.keys(checkinsPorDia).length;
  const diasConNormal = new Set(
    registros.filter(r => r.sys < 130 && r.dia < 85).map(r => localDateStr(r.fecha))
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
  const diasConRegistro = new Set(registros.map(r => localDateStr(r.fecha))).size;
  const racha = calcRacha(registros);
  const totalCheckins = Object.keys(checkinsPorDia).length;
  const diasConMed = Object.values(checkinsPorDia).filter(c => c.med).length;
  const diasConBuenSueno = Object.values(checkinsPorDia).filter(c => c.sueno >= 7).length;
  const normalesConsec = maxNormalesConsecutivas(registros);

  const t = i18n.t.bind(i18n);
  return [
    {
      id: 'primera',
      titulo: t('logros.primera.titulo'),
      descripcion: t('logros.primera.descripcion'),
      icono: '🎯',
      desbloqueado: registros.length >= 1,
    },
    {
      id: 'semana',
      titulo: t('logros.semana.titulo'),
      descripcion: t('logros.semana.descripcion'),
      icono: '🔥',
      desbloqueado: racha >= 7,
      progreso: { actual: Math.min(racha, 7), total: 7 },
    },
    {
      id: 'mes',
      titulo: t('logros.mes.titulo'),
      descripcion: t('logros.mes.descripcion'),
      icono: '📅',
      desbloqueado: diasConRegistro >= 30,
      progreso: { actual: Math.min(diasConRegistro, 30), total: 30 },
    },
    {
      id: 'controlada',
      titulo: t('logros.controlada.titulo'),
      descripcion: t('logros.controlada.descripcion'),
      icono: '💚',
      desbloqueado: normalesConsec >= 7,
      progreso: { actual: Math.min(normalesConsec, 7), total: 7 },
    },
    {
      id: 'descanso',
      titulo: t('logros.descanso.titulo'),
      descripcion: t('logros.descanso.descripcion'),
      icono: '😴',
      desbloqueado: diasConBuenSueno >= 10,
      progreso: { actual: Math.min(diasConBuenSueno, 10), total: 10 },
    },
    {
      id: 'habito',
      titulo: t('logros.habito.titulo'),
      descripcion: t('logros.habito.descripcion'),
      icono: '✅',
      desbloqueado: totalCheckins >= 30,
      progreso: { actual: Math.min(totalCheckins, 30), total: 30 },
    },
    {
      id: 'medicado',
      titulo: t('logros.medicado.titulo'),
      descripcion: t('logros.medicado.descripcion'),
      icono: '💊',
      desbloqueado: diasConMed >= 14,
      progreso: { actual: Math.min(diasConMed, 14), total: 14 },
    },
    {
      id: 'imparable',
      titulo: t('logros.imparable.titulo'),
      descripcion: t('logros.imparable.descripcion'),
      icono: '⚡',
      desbloqueado: racha >= 30,
      progreso: { actual: Math.min(racha, 30), total: 30 },
    },
  ];
}
