import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { BpChart } from '@/components/bp-chart';
import { CheckinChart } from '@/components/checkin-chart';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme-color';
import { cancelNotifications, getSavedTime, NotifTime, requestPermissions, scheduleDaily } from '@/utils/notifications';
import { getInsight } from '@/utils/insights';
import { calcAura, calcRacha, getNivel, getSiguienteNivel, getLogros } from '@/utils/gamificacion';

type Registro = { sys: number; dia: number; pul?: number; nota?: string | null; fecha: string };
type Checkin = { sueno: number; estres: number; actividad: number; med?: boolean; fecha: string };

function getPill(sys: number, dia: number, C: ThemeColors) {
  if (sys >= 180 || dia >= 110) return { label: 'Crítica',     ...C.bp.critica };
  if (sys >= 160 || dia >= 100) return { label: 'Alta',        ...C.bp.alta };
  if (sys >= 140 || dia >= 90)  return { label: 'Elevada',     ...C.bp.elevada };
  if (sys >= 130 || dia >= 85)  return { label: 'Normal-alta', ...C.bp.normalAlta };
  return                               { label: 'Normal',      ...C.bp.normal };
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatNotifTime(t: NotifTime) {
  return `${t.hour}:${String(t.minute).padStart(2, '0')}`;
}

function hoyStr() {
  return new Date().toISOString().split('T')[0];
}

function fechaHoy() {
  const s = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DIA_LABEL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function getUltimos7() {
  const hoy = new Date();
  const dow = hoy.getDay(); // 0=Dom, 1=Lun...
  const diffLunes = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLunes);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return { label: DIA_LABEL[d.getDay()], fecha: d.toISOString().split('T')[0] };
  });
}

function calcComparativa(registros: Registro[]) {
  const hoy = new Date();
  const dow = hoy.getDay();
  const diffLunes = dow === 0 ? -6 : 1 - dow;
  const lunesEsta = new Date(hoy);
  lunesEsta.setDate(hoy.getDate() + diffLunes);
  lunesEsta.setHours(0, 0, 0, 0);
  const lunesAnterior = new Date(lunesEsta);
  lunesAnterior.setDate(lunesEsta.getDate() - 7);

  const estaS = registros.filter(r => new Date(r.fecha) >= lunesEsta);
  const anteriorS = registros.filter(r => {
    const d = new Date(r.fecha);
    return d >= lunesAnterior && d < lunesEsta;
  });

  if (!estaS.length || !anteriorS.length) return null;
  const avgEsta = Math.round(estaS.reduce((s, r) => s + r.sys, 0) / estaS.length);
  const avgAnterior = Math.round(anteriorS.reduce((s, r) => s + r.sys, 0) / anteriorS.length);
  return { avgEsta, avgAnterior, delta: avgEsta - avgAnterior };
}

const FACTORES = [
  { key: 'estres',    label: 'Estrés',    icon: '🧠' },
  { key: 'actividad', label: 'Actividad', icon: '🏃' },
];

const CHECKIN_RESET = { sueno: 7, estres: 0, actividad: 0, med: false };

function suenoColor(h: number, C: ThemeColors) {
  if (h >= 7) return C.success;
  if (h >= 6) return C.warning;
  return C.accent;
}

function getWellnessFeedback(sueno: number, estres: number, actividad: number): { msg: string; emoji: string } | null {
  const malSueno = sueno < 6;
  const estresAlto = estres >= 4;
  const actividadAlta = actividad >= 4;
  const buenSueno = sueno >= 7;
  const estresOk = estres <= 2;

  if (malSueno && estresAlto) return { emoji: '⚠️', msg: 'Poco descanso y mucho estrés pueden elevar tu presión. Prioriza el descanso hoy.' };
  if (malSueno)               return { emoji: '💤', msg: `Dormiste ${sueno}h — menos de las 7h recomendadas. Intenta acostarte más temprano esta noche.` };
  if (estresAlto)             return { emoji: '🧘', msg: 'Nivel de estrés alto. Una caminata corta o respiración profunda puede ayudar.' };
  if (buenSueno && estresOk && actividadAlta) return { emoji: '🌟', msg: '¡Rutina excelente! Buen sueño, bajo estrés y buena actividad física.' };
  if (buenSueno && estresOk)  return { emoji: '✅', msg: 'Buen descanso y bajo estrés. Sigue con esta rutina.' };
  return null;
}

export default function HomeScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [checkinHoy, setCheckinHoy] = useState(CHECKIN_RESET);
  const [guardado, setGuardado] = useState(false);
  const [nombre, setNombre] = useState('');
  const [notifTime, setNotifTime] = useState<NotifTime | null>(null);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [pickerHour, setPickerHour] = useState('8');
  const [pickerMinute, setPickerMinute] = useState('00');
  const [checkinsHistorial, setCheckinsHistorial] = useState<Record<string, Checkin>>({});
  const [meta, setMeta] = useState<{ sys: number; dia: number } | null>(null);
  const [detalle, setDetalle] = useState<{ registro: Registro; checkin: Checkin | null } | null>(null);
  const [logroToast, setLogroToast] = useState<{ titulo: string; icono: string } | null>(null);
  const logroToastAnim = useRef(new Animated.Value(0)).current;
  const logroToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [regData, perfilData, metaData] = await Promise.all([
        AsyncStorage.getItem('registros'),
        AsyncStorage.getItem('perfil'),
        AsyncStorage.getItem('meta_presion'),
      ]);
      const lista: Registro[] = regData ? JSON.parse(regData) : [];
      setRegistros(lista);
      if (perfilData) setNombre(JSON.parse(perfilData).nombre || '');
      if (metaData) setMeta(JSON.parse(metaData));
      setNotifTime(await getSavedTime());

      const checkinData = await AsyncStorage.getItem('checkin_' + hoyStr());
      if (checkinData) {
        setCheckin(JSON.parse(checkinData));
        setGuardado(true);
      } else {
        setCheckin(null);
        setGuardado(false);
        setCheckinHoy(CHECKIN_RESET);
      }

      const last30Keys = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return 'checkin_' + d.toISOString().split('T')[0];
      });
      const pairs = await AsyncStorage.multiGet(last30Keys);
      const map: Record<string, Checkin> = {};
      pairs.forEach(([key, val]) => {
        if (val) map[key.replace('checkin_', '')] = JSON.parse(val);
      });
      setCheckinsHistorial(map);

      const logrosActuales = getLogros(lista, map);
      const desbloqueadosIds = logrosActuales.filter(l => l.desbloqueado).map(l => l.id);
      const vistosRaw = await AsyncStorage.getItem('logros_vistos');
      const vistos: string[] = vistosRaw ? JSON.parse(vistosRaw) : [];
      const nuevos = logrosActuales.filter(l => l.desbloqueado && !vistos.includes(l.id));
      if (nuevos.length > 0) {
        await AsyncStorage.setItem('logros_vistos', JSON.stringify(desbloqueadosIds));
        setTimeout(() => {
          if (logroToastTimer.current) clearTimeout(logroToastTimer.current);
          setLogroToast(nuevos[0]);
          logroToastAnim.setValue(0);
          Animated.timing(logroToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          logroToastTimer.current = setTimeout(() => {
            Animated.timing(logroToastAnim, { toValue: 0, duration: 400, useNativeDriver: true })
              .start(() => setLogroToast(null));
          }, 3500);
        }, 700);
      }
    })();
  }, []));

  const setVal = (key: string, val: number) => {
    setCheckinHoy(prev => ({ ...prev, [key]: val }));
  };

  const guardarCheckin = async () => {
    try {
      const data = { ...checkinHoy, fecha: new Date().toISOString() };
      await AsyncStorage.setItem('checkin_' + hoyStr(), JSON.stringify(data));
      setCheckin(data);
      setGuardado(true);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el check-in.');
    }
  };

  const toggleNotifExpanded = () => {
    if (!notifExpanded) {
      setPickerHour(notifTime ? String(notifTime.hour) : '8');
      setPickerMinute(notifTime ? String(notifTime.minute).padStart(2, '0') : '00');
    }
    setNotifExpanded(e => !e);
  };

  const handleGuardarHorario = async () => {
    const h = parseInt(pickerHour);
    const m = parseInt(pickerMinute);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) return;
    const granted = await requestPermissions();
    if (!granted) return;
    await scheduleDaily(h, m);
    setNotifTime({ hour: h, minute: m });
    setNotifExpanded(false);
  };

  const handleVerDetalle = async (r: Registro) => {
    const raw = await AsyncStorage.getItem('checkin_' + r.fecha.slice(0, 10));
    setDetalle({ registro: r, checkin: raw ? JSON.parse(raw) : null });
  };

  const handleDesactivar = async () => {
    await cancelNotifications();
    setNotifTime(null);
    setNotifExpanded(false);
  };

  const chartRef = useRef<View>(null);
  const tarjetaRef = useRef<View>(null);

  const handleCompartirGrafico = async () => {
    try {
      const uri = await captureRef(chartRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir gráfico' });
    } catch {
      Alert.alert('Error', 'No se pudo compartir el gráfico.');
    }
  };

  const handleCompartirTarjeta = async () => {
    try {
      const uri = await captureRef(tarjetaRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir tarjeta' });
    } catch {
      Alert.alert('Error', 'No se pudo compartir la tarjeta.');
    }
  };

  const h = parseInt(pickerHour);
  const m = parseInt(pickerMinute);
  const pickerValid = !isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59;

  const ultimo = registros[0];
  const pill = ultimo ? getPill(ultimo.sys, ultimo.dia, Colors) : null;
  const racha = calcRacha(registros);
  const aura = calcAura(registros, checkinsHistorial, racha);
  const auraNivel = getNivel(aura);
  const siguienteNivel = getSiguienteNivel(aura);
  const logros = getLogros(registros, checkinsHistorial);
  const comparativa = calcComparativa(registros);
  const diasConRegistro = new Set(registros.map(r => r.fecha.split('T')[0]));
  const ultimos7 = getUltimos7();
  const registrosHoy = registros.filter(r => r.fecha.split('T')[0] === hoyStr());
  const promedioHoy = registrosHoy.length > 1
    ? { sys: Math.round(registrosHoy.reduce((s, r) => s + r.sys, 0) / registrosHoy.length), dia: Math.round(registrosHoy.reduce((s, r) => s + r.dia, 0) / registrosHoy.length) }
    : registrosHoy[0] ?? null;
  const insight = getInsight(registros, checkinsHistorial);

  const suenoMostrado = guardado ? (checkin?.sueno ?? 7) : checkinHoy.sueno;
  const medMostrado   = guardado ? (checkin?.med ?? false) : checkinHoy.med;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>
          <Text style={{ fontWeight: '900' }}>S</Text>
          <Text style={{ fontWeight: '200' }}>istola</Text>
          <Text style={{ color: Colors.accent }}>.</Text>
        </Text>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Hola, {nombre || 'bienvenido'} 👋</Text>
          <View style={[styles.auraBadge, { backgroundColor: auraNivel.color + '33' }]}>
            <Text style={[styles.auraBadgeText, { color: auraNivel.color }]}>⚡ {aura} · {auraNivel.label}</Text>
          </View>
        </View>
        {siguienteNivel ? (
          <View style={styles.nivelProgressWrap}>
            <View style={styles.nivelProgressBg}>
              <View style={[styles.nivelProgressFill, {
                width: `${Math.round(((aura - auraNivel.min) / (siguienteNivel.min - auraNivel.min)) * 100)}%` as any,
              }]} />
            </View>
            <Text style={styles.nivelProgressLabel}>
              {aura} / {siguienteNivel.min} → {siguienteNivel.label}
            </Text>
          </View>
        ) : (
          <Text style={styles.nivelProgressLabel}>⭐ Nivel máximo alcanzado</Text>
        )}
        <Text style={styles.sub}>{fechaHoy()}</Text>
      </View>

      <View style={styles.body}>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>HOY</Text>
          <View style={styles.grid2x2}>
            <View style={styles.gridRow}>
              <View style={styles.gridTile}>
                <Text style={styles.gridTileIcon}>❤️</Text>
                <Text style={styles.gridTileLabel}>PRESIÓN</Text>
                <Text style={styles.gridTileVal}>
                  {promedioHoy ? `${promedioHoy.sys}/${promedioHoy.dia}` : '—'}
                  {registrosHoy.length > 1 && <Text style={{ fontSize: 10, color: Colors.text.muted }}>{'\n'}prom. {registrosHoy.length}</Text>}
                </Text>
              </View>
              <View style={styles.gridTile}>
                <Text style={styles.gridTileIcon}>🌙</Text>
                <Text style={styles.gridTileLabel}>SUEÑO</Text>
                <Text style={styles.gridTileVal}>
                  {checkin ? `${checkin.sueno}h` : '—'}
                </Text>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridTile}>
                <Text style={styles.gridTileIcon}>🧠</Text>
                <Text style={styles.gridTileLabel}>ESTRÉS</Text>
                <Text style={styles.gridTileVal}>
                  {checkin ? `${checkin.estres}/5` : '—'}
                </Text>
              </View>
              <View style={styles.gridTile}>
                <Text style={styles.gridTileIcon}>💊</Text>
                <Text style={styles.gridTileLabel}>MEDICAMENTO</Text>
                <Text style={[styles.gridTileVal, checkin !== null && { color: checkin.med ? Colors.success : Colors.text.muted }]}>
                  {checkin === null ? '—' : checkin.med ? '✓' : '✗'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>CHECK-IN DIARIO</Text>
            {guardado && <View style={styles.pill}><Text style={[styles.pillText, { color: Colors.bp.normal.color }]}>✓ Aura cargada</Text></View>}
          </View>

          <View style={styles.ciRow}>
            <View>
              <Text style={styles.ciLabel}>🌙 Sueño nocturno</Text>
            </View>
            {guardado ? (
              <Text style={[styles.suenoVal, { color: suenoColor(suenoMostrado, Colors) }]}>{suenoMostrado}h</Text>
            ) : (
              <View style={styles.suenoStepper}>
                <TouchableOpacity
                  onPress={() => setCheckinHoy(p => ({ ...p, sueno: Math.max(3, +(p.sueno - 0.5).toFixed(1)) }))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.suenoVal, { color: suenoColor(checkinHoy.sueno, Colors) }]}>{checkinHoy.sueno}h</Text>
                <TouchableOpacity
                  onPress={() => setCheckinHoy(p => ({ ...p, sueno: Math.min(12, +(p.sueno + 0.5).toFixed(1)) }))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {FACTORES.map(f => {
            const val = guardado ? (checkin as any)?.[f.key] : (checkinHoy as any)[f.key];
            return (
              <View key={f.key} style={styles.ciRow}>
                <Text style={styles.ciLabel}>{f.icon} {f.label}</Text>
                <View style={styles.dots}>
                  {[1,2,3,4,5].map(n => (
                    <TouchableOpacity
                      key={n}
                      disabled={guardado}
                      onPress={() => setVal(f.key, n)}
                      style={[styles.dot, n <= val && { backgroundColor: n <= 2 ? Colors.primary : n <= 4 ? Colors.warning : Colors.accent }]}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          <View style={[styles.ciRow, { marginBottom: 0 }]}>
            <Text style={styles.ciLabel}>💊 Medicamento</Text>
            <TouchableOpacity
              disabled={guardado}
              onPress={() => setCheckinHoy(p => ({ ...p, med: !p.med }))}
              style={[styles.medCheck, medMostrado && styles.medCheckOn]}
            >
              {medMostrado && <Text style={styles.medCheckText}>✓</Text>}
            </TouchableOpacity>
          </View>

          {!guardado && (
            <TouchableOpacity style={styles.ctaSmall} onPress={guardarCheckin}>
              <Text style={styles.ctaSmallText}>Guardar check-in</Text>
            </TouchableOpacity>
          )}
        </View>

        {guardado && checkin && (() => {
          const wf = getWellnessFeedback(checkin.sueno, checkin.estres, checkin.actividad);
          if (!wf) return null;
          const isAlerta = wf.emoji === '⚠️';
          const isBueno  = wf.emoji === '🌟' || wf.emoji === '✅';
          return (
            <View style={[styles.card, {
              backgroundColor: isAlerta ? Colors.bp.elevada.bg : isBueno ? Colors.bp.normal.bg : Colors.neutralBg,
            }]}>
              <View style={styles.insightBody}>
                <Text style={styles.insightIcon}>{wf.emoji}</Text>
                <Text style={styles.insightTexto}>{wf.msg}</Text>
              </View>
            </View>
          );
        })()}

        {insight && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>INSIGHT</Text>
            <View style={styles.insightBody}>
              <Text style={styles.insightIcon}>{insight.icono}</Text>
              <Text style={styles.insightTexto}>{insight.texto}</Text>
            </View>
          </View>
        )}

        {ultimo ? (
          <View ref={tarjetaRef} style={styles.card} collapsable={false}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>ÚLTIMO REGISTRO</Text>
              <TouchableOpacity onPress={handleCompartirTarjeta} style={styles.chartShareBtn}>
                <Text style={styles.chartShareBtnText}>📤</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.tarjetaNombre}>{nombre || 'Sistola'}</Text>
            <View style={styles.row}>
              <Text style={styles.bigVal}>{ultimo.sys}/{ultimo.dia}</Text>
              {pill && <View style={[styles.pill, { backgroundColor: pill.bg }]}><Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text></View>}
            </View>
            <Text style={styles.fechaText}>{formatFecha(ultimo.fecha)}</Text>
            {meta && (
              <Text style={[styles.metaText, { color: (ultimo.sys <= meta.sys && ultimo.dia <= meta.dia) ? Colors.success : Colors.accent }]}>
                {(ultimo.sys <= meta.sys && ultimo.dia <= meta.dia) ? '✓ Dentro de tu meta' : `Meta: ${meta.sys}/${meta.dia}`}
              </Text>
            )}
          </View>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyIcon}>💜</Text>
            <Text style={styles.emptyTitle}>Sin registros aún</Text>
            <Text style={styles.emptyText}>Registra tu primera medición para ver tu tendencia y estadísticas aquí.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.navigate('/(tabs)/explore')}>
              <Text style={styles.emptyBtnText}>Registrar ahora</Text>
            </TouchableOpacity>
          </View>
        )}

        {comparativa && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ESTA SEMANA VS ANTERIOR</Text>
            <View style={styles.comparativaRow}>
              <View style={styles.comparativaItem}>
                <Text style={styles.comparativaLabel}>Esta semana</Text>
                <Text style={styles.comparativaVal}>{comparativa.avgEsta}</Text>
              </View>
              <Text style={[styles.comparativaFlecha, {
                color: comparativa.delta < -3 ? Colors.success : comparativa.delta > 3 ? Colors.accent : Colors.text.muted
              }]}>
                {comparativa.delta < -3 ? '↓' : comparativa.delta > 3 ? '↑' : '→'}
              </Text>
              <View style={styles.comparativaItem}>
                <Text style={styles.comparativaLabel}>Semana anterior</Text>
                <Text style={styles.comparativaVal}>{comparativa.avgAnterior}</Text>
              </View>
            </View>
            <Text style={[styles.comparativaDelta, {
              color: comparativa.delta < -3 ? Colors.success : comparativa.delta > 3 ? Colors.accent : Colors.text.muted
            }]}>
              {comparativa.delta < -3
                ? `${Math.abs(comparativa.delta)} mmHg menos que la semana anterior`
                : comparativa.delta > 3
                ? `${comparativa.delta} mmHg más que la semana anterior`
                : 'Sin cambio significativo'}
            </Text>
          </View>
        )}

        {registros.length > 0 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>RACHA</Text>
              {racha >= 7 && (
                <View style={[styles.multiBadge, { backgroundColor: auraNivel.color + '22' }]}>
                  <Text style={[styles.multiBadgeText, { color: auraNivel.color }]}>
                    ×{racha >= 30 ? '2.0' : '1.5'} aura
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.rachaRow}>
              <View style={styles.rachaLeft}>
                <Text style={styles.rachaNum}>{racha}</Text>
                <Text style={styles.rachaLbl}>días{'\n'}seguidos</Text>
              </View>
              <View style={styles.semana}>
                {ultimos7.map(({ label, fecha }) => {
                  const activo = diasConRegistro.has(fecha);
                  const esHoy = fecha === hoyStr();
                  return (
                    <View key={fecha} style={[styles.diaCirculo, activo && styles.diaCirculoOn, esHoy && !activo && styles.diaCirculoHoy]}>
                      <Text style={[styles.diaLabel, activo && styles.diaLabelOn]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {registros.length > 0 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>LOGROS</Text>
              <Text style={styles.logrosCount}>
                {logros.filter(l => l.desbloqueado).length}/{logros.length}
              </Text>
            </View>
            <View style={styles.logrosGrid}>
              {logros.map(l => (
                <View key={l.id} style={[styles.logroBadge, !l.desbloqueado && styles.logroBadgeLocked]}>
                  <Text style={styles.logroIcon}>{l.desbloqueado ? l.icono : '🔒'}</Text>
                  <Text style={styles.logroTitulo}>{l.titulo}</Text>
                  {!l.desbloqueado && l.progreso && (
                    <>
                      <Text style={styles.logroProgreso}>
                        {l.progreso.actual}/{l.progreso.total}
                      </Text>
                      <View style={styles.logroBarBg}>
                        <View style={[styles.logroBarFill, { width: `${(l.progreso.actual / l.progreso.total) * 100}%` as any }]} />
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {registros.length >= 2 && (
          <View ref={chartRef} style={styles.card} collapsable={false}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>TENDENCIA</Text>
              <View style={styles.row}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={styles.legendLabel}>SIS</Text>
                <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} /><Text style={styles.legendLabel}>DIA</Text>
                {registros.some(r => r.pul) && <><View style={[styles.legendDot, { backgroundColor: '#0097A7' }]} /><Text style={styles.legendLabel}>BPM</Text></>}
                <TouchableOpacity onPress={handleCompartirGrafico} style={styles.chartShareBtn}>
                  <Text style={styles.chartShareBtnText}>📷</Text>
                </TouchableOpacity>
              </View>
            </View>
            <BpChart registros={registros} metaSys={meta?.sys} />
          </View>
        )}

        {Object.keys(checkinsHistorial).length >= 2 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>SUEÑO Y ESTRÉS</Text>
              <View style={styles.row}>
                <View style={[styles.legendDot, { backgroundColor: '#5B9BD5' }]} /><Text style={styles.legendLabel}>Sueño</Text>
                <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} /><Text style={styles.legendLabel}>Estrés</Text>
              </View>
            </View>
            <CheckinChart entries={Object.entries(checkinsHistorial).map(([fecha, c]) => ({ ...c, fecha })).sort((a, b) => b.fecha.localeCompare(a.fecha))} />
          </View>
        )}

        {registros.length > 0 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>HISTORIAL</Text>
              <TouchableOpacity onPress={() => router.navigate('/(tabs)/historial')}>
                <Text style={styles.verTodo}>Ver todo →</Text>
              </TouchableOpacity>
            </View>
            {registros.slice(0, 7).map((r, i) => {
              const p = getPill(r.sys, r.dia, Colors);
              return (
                <TouchableOpacity key={i} style={styles.histRow} onPress={() => handleVerDetalle(r)} activeOpacity={0.7}>
                  <View>
                    <Text style={styles.histVal}>{r.sys}/{r.dia}</Text>
                    <Text style={styles.histFecha}>{formatFecha(r.fecha)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}>
                    <Text style={[styles.pillText, { color: p.color }]}>{p.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <TouchableOpacity style={styles.recordatorioRow} onPress={toggleNotifExpanded}>
            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>RECORDATORIO</Text>
            <Text style={styles.recordatorioValue}>
              {notifTime ? `🔔 ${formatNotifTime(notifTime)}` : '🔕 Sin recordatorio'}
            </Text>
          </TouchableOpacity>
          {notifExpanded && (
            <View style={styles.timePickerWrap}>
              <View style={styles.timeInputRow}>
                <TextInput
                  style={styles.timeInput}
                  value={pickerHour}
                  onChangeText={setPickerHour}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="8"
                  placeholderTextColor={Colors.text.placeholder}
                />
                <Text style={styles.timeColon}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={pickerMinute}
                  onChangeText={setPickerMinute}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={Colors.text.placeholder}
                />
                <TouchableOpacity
                  style={[styles.saveTimeBtn, !pickerValid && { opacity: 0.4 }]}
                  onPress={handleGuardarHorario}
                  disabled={!pickerValid}
                >
                  <Text style={styles.saveTimeBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
              {notifTime && (
                <TouchableOpacity onPress={handleDesactivar}>
                  <Text style={styles.desactivarText}>Desactivar recordatorio</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

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

    {logroToast && (
      <Animated.View style={[styles.logroToastWrap, { opacity: logroToastAnim, transform: [{ translateY: logroToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
        <Text style={styles.logroToastIcon}>{logroToast.icono}</Text>
        <View>
          <Text style={styles.logroToastSuper}>¡LOGRO DESBLOQUEADO!</Text>
          <Text style={styles.logroToastLabel}>{logroToast.titulo}</Text>
        </View>
      </Animated.View>
    )}
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: C.background },
    hero:             { backgroundColor: C.primary, padding: 24, paddingTop: 60 },
    logo:             { color: C.text.onPrimary, fontSize: 30, fontWeight: '700', marginBottom: 12 },
    greetingRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    auraBadge:        { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    auraBadgeText:    { color: C.text.onPrimary, fontSize: 12, fontWeight: '600' },
    greeting:         { color: C.text.onPrimary, fontSize: 24, fontWeight: '600', flex: 1 },
    sub:              { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
    body:             { padding: 16, gap: 12 },
    card:             { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: C.cardBorder },
    sectionLabel:     { fontSize: 11, color: C.sectionLabel, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
    rowBetween:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    row:              { flexDirection: 'row', alignItems: 'center', gap: 12 },
    ciRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    ciLabel:          { fontSize: 13, color: C.text.secondary },
    ciSubLabel:       { fontSize: 10, color: C.text.muted, marginTop: 1 },
    dots:             { flexDirection: 'row', gap: 6 },
    dot:              { width: 24, height: 24, borderRadius: 12, backgroundColor: C.dotEmpty },
    ctaSmall:         { backgroundColor: C.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
    ctaSmallText:     { color: C.text.onPrimary, fontSize: 13, fontWeight: '600' },
    pill:             { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: C.bp.normal.bg },
    pillText:         { fontSize: 11, fontWeight: '600' },
    bigVal:           { fontSize: 36, fontWeight: '600', color: C.text.primary },
    fechaText:        { fontSize: 12, color: C.text.muted, marginTop: 6 },
    emptyCard:        { alignItems: 'center', paddingVertical: 24, gap: 8 },
    emptyIcon:        { fontSize: 36 },
    emptyTitle:       { fontSize: 16, fontWeight: '600', color: C.text.primary },
    emptyText:        { fontSize: 13, color: C.text.muted, textAlign: 'center', lineHeight: 20 },
    emptyBtn:         { marginTop: 8, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
    emptyBtnText:     { color: C.text.onPrimary, fontSize: 14, fontWeight: '600' },
    histRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.divider },
    histVal:          { fontSize: 15, fontWeight: '500', color: C.text.primary },
    histFecha:        { fontSize: 11, color: C.text.muted, marginTop: 2 },
    legendDot:        { width: 8, height: 8, borderRadius: 4 },
    legendLabel:      { fontSize: 10, color: C.text.muted, marginRight: 8 },
    recordatorioRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    recordatorioValue:{ fontSize: 13, color: C.text.subtle, fontWeight: '500' },
    timePickerWrap:   { marginTop: 14, gap: 12 },
    timeInputRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput:        { backgroundColor: C.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 22, fontWeight: '500', color: C.primary, width: 64, textAlign: 'center' },
    timeColon:        { fontSize: 22, color: C.text.muted, fontWeight: '300' },
    saveTimeBtn:      { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 4 },
    saveTimeBtnText:  { color: C.text.onPrimary, fontSize: 13, fontWeight: '600' },
    desactivarText:   { fontSize: 12, color: C.text.light, textDecorationLine: 'underline' },
    verTodo:          { fontSize: 12, color: C.primary, fontWeight: '600' },
    rachaRow:         { flexDirection: 'row', alignItems: 'center', gap: 16 },
    rachaLeft:        { alignItems: 'center', minWidth: 56 },
    rachaNum:         { fontSize: 38, fontWeight: '700', color: C.primary, lineHeight: 42 },
    rachaLbl:         { fontSize: 11, color: C.sectionLabel, textAlign: 'center', marginTop: 2 },
    semana:           { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
    diaCirculo:       { width: 34, height: 34, borderRadius: 17, backgroundColor: C.subtleBg, alignItems: 'center', justifyContent: 'center' },
    diaCirculoOn:     { backgroundColor: C.primary },
    diaCirculoHoy:    { borderWidth: 1.5, borderColor: C.primary, backgroundColor: 'transparent' },
    diaLabel:         { fontSize: 11, fontWeight: '600', color: C.text.muted },
    diaLabelOn:       { color: C.text.onPrimary },
    grid2x2:          { gap: 8 },
    gridRow:          { flexDirection: 'row', gap: 8 },
    gridTile:         { flex: 1, backgroundColor: C.inputBg, borderRadius: 12, padding: 12, alignItems: 'center' },
    gridTileIcon:     { fontSize: 18, marginBottom: 2 },
    gridTileLabel:    { fontSize: 10, color: C.sectionLabel, fontWeight: '600', letterSpacing: 0.5 },
    gridTileVal:      { fontSize: 18, fontWeight: '700', color: C.text.primary, marginTop: 4 },
    suenoStepper:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn:          { width: 30, height: 30, borderRadius: 15, backgroundColor: C.subtleBg, alignItems: 'center', justifyContent: 'center' },
    stepBtnText:      { fontSize: 20, color: C.primary, fontWeight: '400', lineHeight: 24 },
    suenoVal:         { fontSize: 15, fontWeight: '600', color: C.text.primary, minWidth: 44, textAlign: 'center' },
    medCheck:         { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: C.inputBg },
    medCheckOn:       { backgroundColor: C.primary, borderColor: C.primary },
    medCheckText:     { color: C.text.onPrimary, fontSize: 13, fontWeight: '700' },
    insightBody:      { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    insightIcon:      { fontSize: 22 },
    insightTexto:     { flex: 1, fontSize: 13, color: C.text.secondary, lineHeight: 20 },
    chartShareBtn:    { marginLeft: 8, padding: 2 },
    chartShareBtnText:{ fontSize: 15 },
    comparativaRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    comparativaItem:  { alignItems: 'center', flex: 1 },
    comparativaLabel: { fontSize: 11, color: C.text.muted, marginBottom: 4 },
    comparativaVal:   { fontSize: 28, fontWeight: '700', color: C.text.primary },
    comparativaFlecha:{ fontSize: 32, fontWeight: '300', textAlign: 'center' },
    comparativaDelta: { fontSize: 12, textAlign: 'center', marginTop: 8 },
    metaText:         { fontSize: 12, marginTop: 6, fontWeight: '500' },
    tarjetaNombre:    { fontSize: 12, color: C.text.muted, marginBottom: 6 },
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
    nivelProgressWrap:  { marginTop: 10, marginBottom: 2 },
    nivelProgressBg:    { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
    nivelProgressFill:  { height: 4, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 2 },
    nivelProgressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 5 },
    multiBadge:         { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    multiBadgeText:     { fontSize: 11, fontWeight: '700' },
    logrosCount:        { fontSize: 11, color: C.text.muted, fontWeight: '600' },
    logrosGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    logroBadge:         { alignItems: 'center', width: '22%', paddingVertical: 10, backgroundColor: C.subtleBg, borderRadius: 12 },
    logroBadgeLocked:   { opacity: 0.3 },
    logroIcon:          { fontSize: 22 },
    logroTitulo:        { fontSize: 9, color: C.text.secondary, textAlign: 'center', marginTop: 4, fontWeight: '600' },
    logroProgreso:      { fontSize: 8, color: C.text.muted, marginTop: 3 },
    logroBarBg:         { width: '80%', height: 3, backgroundColor: C.cardBorder, borderRadius: 2, marginTop: 3, overflow: 'hidden' },
    logroBarFill:       { height: 3, backgroundColor: C.primary, borderRadius: 2 },
    logroToastWrap:     { position: 'absolute', top: 56, left: 16, right: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, borderWidth: 1.5, borderColor: '#F0B429' },
    logroToastIcon:     { fontSize: 30 },
    logroToastSuper:    { fontSize: 10, color: '#C8920A', fontWeight: '700', letterSpacing: 1 },
    logroToastLabel:    { fontSize: 16, color: C.text.primary, fontWeight: '700', marginTop: 2 },
  });
}
