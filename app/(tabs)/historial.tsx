import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme-color';

type Registro = { sys: number; dia: number; pul?: number; nota?: string | null; fecha: string };
type Checkin  = { sueno: number; estres: number; actividad: number; med?: boolean };

const CLASES = ['Normal', 'Normal-alta', 'Elevada', 'Alta', 'Crítica'];
const PERIODOS: { label: string; dias: number | null }[] = [
  { label: 'Todo',     dias: null },
  { label: '7 días',  dias: 7    },
  { label: '30 días', dias: 30   },
  { label: '3 meses', dias: 90   },
];

function getPill(sys: number, dia: number, C: ThemeColors) {
  if (sys >= 180 || dia >= 110) return { label: 'Crítica',     ...C.bp.critica };
  if (sys >= 160 || dia >= 100) return { label: 'Alta',        ...C.bp.alta };
  if (sys >= 140 || dia >= 90)  return { label: 'Elevada',     ...C.bp.elevada };
  if (sys >= 130 || dia >= 85)  return { label: 'Normal-alta', ...C.bp.normalAlta };
  return                               { label: 'Normal',      ...C.bp.normal };
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatFechaCorta(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function csvField(val: string | null | undefined): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function buildCSV(registros: Registro[], checkins: Record<string, Checkin>, C: ThemeColors): string {
  const header = 'Fecha,Sistólica (mmHg),Diastólica (mmHg),Pulso (bpm),Clasificación,Nota,Sueño (h),Estrés (1-5),Actividad (1-5),Medicamento';
  const rows = registros.map(r => {
    const fecha = new Date(r.fecha).toLocaleString('es');
    const clase = getPill(r.sys, r.dia, C).label;
    const c = checkins[r.fecha.slice(0, 10)];
    return [
      fecha, r.sys, r.dia, r.pul ?? '', clase, csvField(r.nota),
      c ? c.sueno : '', c ? c.estres : '', c ? c.actividad : '', c ? (c.med ? 'Sí' : 'No') : '',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

type Medicacion = { nombre: string; dosis: string; frecuencia?: string };

function pillClass(label: string) {
  if (label === 'Crítica')     return 'pill-critica';
  if (label === 'Alta')        return 'pill-alta';
  if (label === 'Elevada')     return 'pill-elevada';
  if (label === 'Normal-alta') return 'pill-normal-alta';
  return 'pill-normal';
}

async function buildPDF(registros: Registro[], checkins: Record<string, Checkin>, C: ThemeColors): Promise<string> {
  const perfilRaw = await AsyncStorage.getItem('perfil');
  const perfil = perfilRaw ? JSON.parse(perfilRaw) : {};
  const nombre = perfil.nombre || 'Sin nombre';
  const edad   = perfil.edad   || '—';
  const meds: Medicacion[] = Array.isArray(perfil.medicamentos) ? perfil.medicamentos : [];

  const fecha = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const prom = registros.length ? {
    sys: Math.round(registros.reduce((s, r) => s + r.sys, 0) / registros.length),
    dia: Math.round(registros.reduce((s, r) => s + r.dia, 0) / registros.length),
  } : null;
  const minR = registros.length ? registros.reduce((m, r) => r.sys < m.sys ? r : m) : null;
  const maxR = registros.length ? registros.reduce((m, r) => r.sys > m.sys ? r : m) : null;

  const filas = registros.map(r => {
    const p = getPill(r.sys, r.dia, C);
    const c = checkins[r.fecha.slice(0, 10)];
    const f = new Date(r.fecha).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<tr>
      <td>${f}</td>
      <td><strong>${r.sys}/${r.dia}</strong></td>
      <td><span class="pill ${pillClass(p.label)}">${p.label}</span></td>
      <td>${r.pul ? r.pul + ' bpm' : '—'}</td>
      <td>${c ? c.sueno + 'h' : '—'}</td>
      <td>${c ? c.estres + '/5' : '—'}</td>
      <td>${c ? c.actividad + '/5' : '—'}</td>
      <td>${c ? (c.med ? '✓' : '✗') : '—'}</td>
      <td style="font-style:italic;color:#888">${r.nota || ''}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,Arial,sans-serif;padding:32px;color:#1a1a2e;font-size:13px}
    h1{color:#7F77DD;font-size:26px;margin:0 0 4px}
    .sub{color:#999;font-size:12px;margin-bottom:28px}
    .section{margin-bottom:24px}
    .st{font-size:10px;font-weight:700;letter-spacing:1.5px;color:#9890E8;text-transform:uppercase;border-bottom:1px solid #E5E3F8;padding-bottom:6px;margin-bottom:12px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .box{background:#F8F7FF;border-radius:8px;padding:10px 14px}
    .bl{font-size:11px;color:#999;margin-bottom:2px}
    .bv{font-size:15px;font-weight:600}
    .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
    .stat{background:#F8F7FF;border-radius:8px;padding:12px;text-align:center}
    .sl{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px}
    .sv{font-size:20px;font-weight:700;color:#7F77DD;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#F8F7FF;color:#999;font-weight:600;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px}
    td{padding:7px 8px;border-bottom:1px solid #F0EEF8;vertical-align:top}
    tr:last-child td{border-bottom:none}
    .pill{display:inline-block;padding:2px 7px;border-radius:5px;font-weight:600;font-size:10px}
    .pill-normal{background:#D6F5E0;color:#1A7F3C}
    .pill-normal-alta{background:#E8F5D0;color:#4A7A10}
    .pill-elevada{background:#FFF3CD;color:#856404}
    .pill-alta{background:#FFE0CC;color:#CC4400}
    .pill-critica{background:#FFD0D0;color:#CC0000}
    .med{background:#F8F7FF;border-radius:6px;padding:7px 12px;margin-bottom:6px}
    .footer{margin-top:32px;font-size:10px;color:#ccc;text-align:center}
  </style></head><body>
    <h1>Sistola — Reporte de Presión Arterial</h1>
    <p class="sub">Generado: ${fecha}</p>

    <div class="section">
      <div class="st">Paciente</div>
      <div class="grid2">
        <div class="box"><div class="bl">Nombre</div><div class="bv">${nombre}</div></div>
        <div class="box"><div class="bl">Edad</div><div class="bv">${edad} años</div></div>
      </div>
    </div>

    ${meds.length ? `<div class="section">
      <div class="st">Medicación</div>
      ${meds.map(m => `<div class="med">${m.nombre} · ${[m.dosis, m.frecuencia].filter(Boolean).join(' ')}</div>`).join('')}
    </div>` : ''}

    ${prom ? `<div class="section">
      <div class="st">Estadísticas · ${registros.length} registros</div>
      <div class="stats">
        <div class="stat"><div class="sl">Promedio</div><div class="sv">${prom.sys}/${prom.dia}</div></div>
        <div class="stat"><div class="sl">Mínimo</div><div class="sv">${minR!.sys}/${minR!.dia}</div></div>
        <div class="stat"><div class="sl">Máximo</div><div class="sv">${maxR!.sys}/${maxR!.dia}</div></div>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="st">Registros</div>
      <table>
        <tr><th>Fecha</th><th>Presión</th><th>Clasificación</th><th>Pulso</th><th>Sueño</th><th>Estrés</th><th>Actividad</th><th>Med</th><th>Nota</th></tr>
        ${filas}
      </table>
    </div>

    <div class="footer">Reporte generado por Sistola · Solo informativo, no reemplaza consulta médica profesional</div>
  </body></html>`;
}

function buildShareText(registros: Registro[], C: ThemeColors) {
  const hoy = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const prom = {
    sys: Math.round(registros.reduce((s, r) => s + r.sys, 0) / registros.length),
    dia: Math.round(registros.reduce((s, r) => s + r.dia, 0) / registros.length),
  };
  const lineas = registros.map(r => {
    const p = getPill(r.sys, r.dia, C);
    const nota = r.nota ? `\n   "${r.nota}"` : '';
    return `${formatFechaCorta(r.fecha)}  ${r.sys}/${r.dia} mmHg  ${p.label}${nota}`;
  }).join('\n');
  return [
    `📊 Historial de presión arterial — Sistola`,
    `Generado: ${hoy}`,
    `Promedio: ${prom.sys}/${prom.dia} mmHg · ${registros.length} registros`,
    ``,
    lineas,
  ].join('\n');
}

export default function HistorialScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [filtroClase, setFiltroClase] = useState<string | null>(null);
  const [filtroDias, setFiltroDias] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<{ registro: Registro; checkin: Checkin | null } | null>(null);
  const [exportando, setExportando] = useState(false);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('registros').then(d => { if (d) setRegistros(JSON.parse(d)); });
  }, []));

  const registrosFiltrados = useMemo(() => {
    let r = registros;
    if (filtroDias !== null) {
      const desde = new Date();
      desde.setDate(desde.getDate() - filtroDias);
      r = r.filter(reg => new Date(reg.fecha) >= desde);
    }
    if (filtroClase !== null) {
      r = r.filter(reg => getPill(reg.sys, reg.dia, Colors).label === filtroClase);
    }
    return r;
  }, [registros, filtroClase, filtroDias, Colors]);

  const filtroActivo = filtroClase !== null || filtroDias !== null;

  const swipeRefs = useRef<Record<string, Swipeable | null>>({});

  const handleVerDetalle = async (r: Registro) => {
    const raw = await AsyncStorage.getItem('checkin_' + r.fecha.slice(0, 10));
    setDetalle({ registro: r, checkin: raw ? JSON.parse(raw) : null });
  };

  const handleEliminar = async (fecha: string) => {
    swipeRefs.current[fecha]?.close();
    const nuevos = registros.filter(r => r.fecha !== fecha);
    setRegistros(nuevos);
    await AsyncStorage.setItem('registros', JSON.stringify(nuevos));
  };

  const renderDelete = (fecha: string) => (
    <TouchableOpacity onPress={() => handleEliminar(fecha)} style={styles.deleteAction}>
      <Text style={styles.deleteText}>Eliminar</Text>
    </TouchableOpacity>
  );

  const handleExportarCSV = async () => {
    setExportando(true);
    try {
      const src = filtroActivo ? registrosFiltrados : registros;
      const fechas = [...new Set(src.map(r => r.fecha.slice(0, 10)))];
      const pairs = await AsyncStorage.multiGet(fechas.map(f => `checkin_${f}`));
      const checkins: Record<string, Checkin> = {};
      for (const [key, val] of pairs) {
        if (val) checkins[key.replace('checkin_', '')] = JSON.parse(val);
      }
      const csv = buildCSV(src, checkins, Colors);
      const path = FileSystem.cacheDirectory + 'sistola_historial.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Exportar historial', UTI: 'public.comma-separated-values-text' });
    } catch {
      Alert.alert('Error', 'No se pudo exportar el historial.');
    } finally {
      setExportando(false);
    }
  };

  const handleExportarPDF = async () => {
    setExportando(true);
    try {
      const src = filtroActivo ? registrosFiltrados : registros;
      const fechas = [...new Set(src.map(r => r.fecha.slice(0, 10)))];
      const pairs = await AsyncStorage.multiGet(fechas.map(f => `checkin_${f}`));
      const checkins: Record<string, Checkin> = {};
      for (const [key, val] of pairs) {
        if (val) checkins[key.replace('checkin_', '')] = JSON.parse(val);
      }
      const html = await buildPDF(src, checkins, Colors);
      const { uri } = await Print.printToFileAsync({ html });
      const dest = FileSystem.cacheDirectory + 'sistola_reporte.pdf';
      await FileSystem.copyAsync({ from: uri, to: dest });
      await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Reporte Sistola', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setExportando(false);
    }
  };

  const handleCompartir = () => {
    const src = filtroActivo ? registrosFiltrados : registros;
    Alert.alert(
      'Compartir historial',
      '¿Cómo quieres exportar tus datos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Texto', onPress: () => Share.share({ message: buildShareText(src, Colors) }) },
        { text: 'CSV', onPress: handleExportarCSV },
        { text: 'PDF (médico)', onPress: handleExportarPDF },
      ],
    );
  };

  const agrupado = useMemo(() => {
    const groups: { fecha: string; label: string; items: Registro[] }[] = [];
    for (const r of registrosFiltrados) {
      const dia = r.fecha.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.fecha === dia) {
        last.items.push(r);
      } else {
        const d = new Date(r.fecha);
        const raw = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
        groups.push({ fecha: dia, label: raw.charAt(0).toUpperCase() + raw.slice(1), items: [r] });
      }
    }
    return groups;
  }, [registrosFiltrados]);

  const distribucion = useMemo(() => {
    const total = registrosFiltrados.length;
    if (total < 2) return null;
    return CLASES.map(clase => {
      const count = registrosFiltrados.filter(r => getPill(r.sys, r.dia, Colors).label === clase).length;
      return { clase, count, pct: Math.round((count / total) * 100) };
    }).filter(d => d.count > 0);
  }, [registrosFiltrados, Colors]);

  const stats = registrosFiltrados.length >= 2 ? {
    prom: {
      sys: Math.round(registrosFiltrados.reduce((s, r) => s + r.sys, 0) / registrosFiltrados.length),
      dia: Math.round(registrosFiltrados.reduce((s, r) => s + r.dia, 0) / registrosFiltrados.length),
    },
    min: registrosFiltrados.reduce((m, r) => r.sys < m.sys ? r : m),
    max: registrosFiltrados.reduce((m, r) => r.sys > m.sys ? r : m),
  } : null;

  const pulStats = useMemo(() => {
    const con = registrosFiltrados.filter(r => r.pul !== undefined);
    if (con.length < 2) return null;
    return {
      prom: Math.round(con.reduce((s, r) => s + r.pul!, 0) / con.length),
      min:  Math.min(...con.map(r => r.pul!)),
      max:  Math.max(...con.map(r => r.pul!)),
    };
  }, [registrosFiltrados]);

  const subText = filtroActivo
    ? `${registrosFiltrados.length} de ${registros.length} registros`
    : `${registros.length} registros`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>
            <Text style={{ fontWeight: '900' }}>S</Text>
            <Text style={{ fontWeight: '200' }}>istola</Text>
            <Text style={{ color: Colors.accent }}>.</Text>
          </Text>
          {registros.length > 0 && (
            <TouchableOpacity onPress={handleCompartir} style={styles.shareBtn} disabled={exportando}>
              <Text style={styles.shareBtnText}>{exportando ? 'Exportando…' : '📤 Compartir'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.sub}>{subText}</Text>
      </View>

      <View style={styles.body}>
        {registros.length > 0 && (
          <View style={styles.filterCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  onPress={() => setFiltroClase(null)}
                  style={[styles.chip, filtroClase === null && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filtroClase === null && styles.chipTextActive]}>Todas</Text>
                </TouchableOpacity>
                {CLASES.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setFiltroClase(filtroClase === c ? null : c)}
                    style={[styles.chip, filtroClase === c && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, filtroClase === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={styles.chipRow}>
                {PERIODOS.map(p => (
                  <TouchableOpacity
                    key={p.label}
                    onPress={() => setFiltroDias(p.dias)}
                    style={[styles.chip, filtroDias === p.dias && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, filtroDias === p.dias && styles.chipTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>PROMEDIO</Text>
              <Text style={styles.statVal}>{stats.prom.sys}/{stats.prom.dia}</Text>
            </View>
            <View style={[styles.statCol, styles.statBorder]}>
              <Text style={styles.statLabel}>MÍNIMO</Text>
              <Text style={styles.statVal}>{stats.min.sys}/{stats.min.dia}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>MÁXIMO</Text>
              <Text style={styles.statVal}>{stats.max.sys}/{stats.max.dia}</Text>
            </View>
          </View>
        )}

        {pulStats && (
          <View style={[styles.statsCard, { gap: 0 }]}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>💓 PULSO PROM</Text>
              <Text style={styles.statVal}>{pulStats.prom} bpm</Text>
            </View>
            <View style={[styles.statCol, styles.statBorder]}>
              <Text style={styles.statLabel}>MÍNIMO</Text>
              <Text style={styles.statVal}>{pulStats.min}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>MÁXIMO</Text>
              <Text style={styles.statVal}>{pulStats.max}</Text>
            </View>
          </View>
        )}

        {distribucion && (
          <View style={styles.statsCard}>
            <View style={{ flex: 1, gap: 6 }}>
              {distribucion.map(({ clase, count, pct }) => {
                const pill = getPill(
                  clase === 'Crítica' ? 180 : clase === 'Alta' ? 160 : clase === 'Elevada' ? 140 : clase === 'Normal-alta' ? 130 : 110,
                  clase === 'Crítica' ? 110 : clase === 'Alta' ? 100 : clase === 'Elevada' ? 90 : clase === 'Normal-alta' ? 85 : 70,
                  Colors,
                );
                return (
                  <View key={clase} style={styles.distRow}>
                    <Text style={styles.distLabel}>{clase}</Text>
                    <View style={styles.distBarBg}>
                      <View style={[styles.distBar, { width: `${pct}%` as any, backgroundColor: pill.bg }]} />
                    </View>
                    <Text style={styles.distPct}>{count} · {pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {registros.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sin registros aún</Text>
            <Text style={styles.empty}>Tus mediciones de presión aparecerán aquí. Empieza registrando desde la pestaña Registrar.</Text>
          </View>
        )}
        {registros.length > 0 && registrosFiltrados.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.empty}>No hay registros que coincidan con los filtros seleccionados.</Text>
            <TouchableOpacity onPress={() => { setFiltroClase(null); setFiltroDias(null); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Limpiar filtros</Text>
            </TouchableOpacity>
          </View>
        )}

        {agrupado.map(grupo => (
          <View key={grupo.fecha}>
            <Text style={styles.dayHeader}>{grupo.label}</Text>
            {grupo.items.map(r => {
              const p = getPill(r.sys, r.dia, Colors);
              return (
                <Swipeable
                  key={r.fecha}
                  ref={ref => { swipeRefs.current[r.fecha] = ref; }}
                  renderRightActions={() => renderDelete(r.fecha)}
                  overshootRight={false}
                >
                  <TouchableOpacity style={styles.card} onPress={() => handleVerDetalle(r)} activeOpacity={0.75}>
                    <View style={styles.row}>
                      <Text style={styles.val}>{r.sys}/{r.dia}</Text>
                      <View style={[styles.pill, { backgroundColor: p.bg }]}>
                        <Text style={[styles.pillText, { color: p.color }]}>{p.label}</Text>
                      </View>
                    </View>
                    <View style={styles.fechaPulRow}>
                      <Text style={styles.fecha}>{formatFecha(r.fecha)}</Text>
                      {r.pul ? <Text style={styles.pul}>💓 {r.pul} bpm</Text> : null}
                    </View>
                    {r.nota && <Text style={styles.nota}>{r.nota}</Text>}
                  </TouchableOpacity>
                </Swipeable>
              );
            })}
          </View>
        ))}
      </View>
      <Modal visible={!!detalle} transparent animationType="slide" onRequestClose={() => setDetalle(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetalle(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {detalle && (() => {
              const { registro: r, checkin: c } = detalle;
              const p = getPill(r.sys, r.dia, Colors);
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalVal}>{r.sys}/{r.dia} <Text style={styles.modalUnit}>mmHg</Text></Text>
                    <View style={[styles.pill, { backgroundColor: p.bg }]}>
                      <Text style={[styles.pillText, { color: p.color }]}>{p.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalFecha}>{formatFecha(r.fecha)}</Text>
                  {r.pul ? <Text style={styles.modalPul}>💓 {r.pul} bpm</Text> : null}

                  {r.nota ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionLabel}>NOTA</Text>
                      <Text style={styles.modalNota}>{r.nota}</Text>
                    </View>
                  ) : null}

                  {c ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionLabel}>CHECK-IN DEL DÍA</Text>
                      <View style={styles.modalCheckinRow}><Text style={styles.modalCheckinLabel}>🌙 Sueño</Text><Text style={styles.modalCheckinVal}>{c.sueno}h</Text></View>
                      <View style={styles.modalCheckinRow}><Text style={styles.modalCheckinLabel}>🧠 Estrés</Text><Text style={styles.modalCheckinVal}>{c.estres}/5</Text></View>
                      <View style={styles.modalCheckinRow}><Text style={styles.modalCheckinLabel}>🏃 Actividad</Text><Text style={styles.modalCheckinVal}>{c.actividad}/5</Text></View>
                      <View style={styles.modalCheckinRow}><Text style={styles.modalCheckinLabel}>💊 Medicamento</Text><Text style={[styles.modalCheckinVal, { color: c.med ? Colors.success : Colors.text.muted }]}>{c.med ? '✓ Tomado' : '✗ No tomado'}</Text></View>
                    </View>
                  ) : null}

                  <TouchableOpacity style={styles.modalClose} onPress={() => setDetalle(null)}>
                    <Text style={styles.modalCloseText}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: C.background },
    header:         { backgroundColor: C.primary, padding: 24, paddingTop: 60 },
    headerTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    logo:           { color: C.text.onPrimary, fontSize: 30, fontWeight: '700' },
    shareBtn:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    shareBtnText:   { color: C.text.onPrimary, fontSize: 13, fontWeight: '600' },
    title:          { color: C.text.onPrimary, fontSize: 22, fontWeight: '600' },
    sub:            { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
    body:           { padding: 16, gap: 10 },
    emptyCard:      { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 16 },
    emptyIcon:      { fontSize: 40 },
    emptyTitle:     { fontSize: 16, fontWeight: '600', color: C.text.primary },
    empty:          { textAlign: 'center', color: C.text.muted, lineHeight: 20 },
    clearBtn:       { marginTop: 8, borderWidth: 1, borderColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 },
    clearBtnText:   { color: C.primary, fontSize: 13, fontWeight: '600' },
    filterCard:     { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: C.cardBorder },
    chipRow:        { flexDirection: 'row', gap: 6 },
    chip:           { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.subtleBg },
    chipActive:     { backgroundColor: C.primary },
    chipText:       { fontSize: 12, fontWeight: '600', color: C.text.secondary },
    chipTextActive: { color: C.text.onPrimary },
    statsCard:      { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: C.cardBorder, flexDirection: 'row' },
    statCol:        { flex: 1, alignItems: 'center' },
    statBorder:     { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.cardBorder },
    statLabel:      { fontSize: 10, color: C.sectionLabel, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
    statVal:        { fontSize: 17, fontWeight: '700', color: C.text.primary },
    card:           { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: C.cardBorder },
    row:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    val:            { fontSize: 22, fontWeight: '600', color: C.text.primary },
    pill:           { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    pillText:       { fontSize: 11, fontWeight: '600' },
    fecha:          { fontSize: 12, color: C.text.muted, marginTop: 4 },
    nota:           { fontSize: 12, color: C.text.subtle, marginTop: 8, fontStyle: 'italic', borderTopWidth: 0.5, borderTopColor: C.divider, paddingTop: 8 },
    deleteAction:   { backgroundColor: '#E53935', justifyContent: 'center', alignItems: 'center', width: 88, borderRadius: 14, marginLeft: 8 },
    deleteText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
    dayHeader:      { fontSize: 12, fontWeight: '600', color: C.sectionLabel, marginTop: 8, marginBottom: 4, paddingHorizontal: 2 },
    modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet:         { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    modalVal:           { fontSize: 36, fontWeight: '700', color: C.text.primary },
    modalUnit:          { fontSize: 16, fontWeight: '400', color: C.text.muted },
    modalFecha:         { fontSize: 13, color: C.text.muted, marginBottom: 4 },
    modalPul:           { fontSize: 13, color: C.text.secondary, marginBottom: 12 },
    modalSection:       { marginTop: 16, borderTopWidth: 0.5, borderTopColor: C.divider, paddingTop: 14 },
    modalSectionLabel:  { fontSize: 10, fontWeight: '700', color: C.sectionLabel, letterSpacing: 1, marginBottom: 10 },
    modalNota:          { fontSize: 14, color: C.text.secondary, fontStyle: 'italic', lineHeight: 20 },
    modalCheckinRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    modalCheckinLabel:  { fontSize: 14, color: C.text.secondary },
    modalCheckinVal:    { fontSize: 14, fontWeight: '600', color: C.text.primary },
    modalClose:         { marginTop: 20, backgroundColor: C.subtleBg, borderRadius: 12, padding: 14, alignItems: 'center' },
    modalCloseText:     { fontSize: 15, fontWeight: '600', color: C.text.secondary },
    fechaPulRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    pul:            { fontSize: 11, color: C.text.muted },
    distRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distLabel:      { fontSize: 11, color: C.text.secondary, width: 80 },
    distBarBg:      { flex: 1, height: 8, backgroundColor: C.subtleBg, borderRadius: 4, overflow: 'hidden' },
    distBar:        { height: 8, borderRadius: 4 },
    distPct:        { fontSize: 11, color: C.text.muted, width: 60, textAlign: 'right' },
  });
}
