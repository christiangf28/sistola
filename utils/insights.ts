import i18n from '@/utils/i18n';

type Registro = { sys: number; dia: number; fecha: string };
type Checkin = { sueno: number; estres: number; actividad: number; fecha: string };

export type Insight = { texto: string; icono: string };

function promSys(rs: Registro[]) {
  return rs.reduce((s, r) => s + r.sys, 0) / rs.length;
}

export function getInsight(
  registros: Registro[],
  checkinsPorDia: Record<string, Checkin>
): Insight | null {
  const t = i18n.t.bind(i18n);
  if (registros.length < 3) return null;

  if (registros.length >= 6) {
    const diff = promSys(registros.slice(0, 3)) - promSys(registros.slice(3, 6));
    if (diff >= 8) return { icono: '📈', texto: t('home.insights.risingTrend') };
    if (diff <= -8) return { icono: '📉', texto: t('home.insights.fallingTrend') };
  }

  const conCheckin = registros.filter(r => checkinsPorDia[r.fecha.split('T')[0]]);
  if (conCheckin.length >= 4) {
    const malSueno  = conCheckin.filter(r => checkinsPorDia[r.fecha.split('T')[0]].sueno <= 5);
    const buenSueno = conCheckin.filter(r => checkinsPorDia[r.fecha.split('T')[0]].sueno >= 7);
    if (malSueno.length >= 2 && buenSueno.length >= 2) {
      const diff = promSys(malSueno) - promSys(buenSueno);
      if (diff >= 8) return { icono: '😴', texto: t('home.insights.sleepImpact') };
    }
  }

  const dias = new Set(registros.map(r => r.fecha.split('T')[0]));
  let racha = 0;
  const d = new Date();
  while (dias.has(d.toISOString().split('T')[0])) {
    racha++;
    d.setDate(d.getDate() - 1);
  }
  if (racha >= 3) return { icono: '🔥', texto: t('home.insights.streak', { n: racha }) };

  return null;
}
