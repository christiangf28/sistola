import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme-color';

function getAnalysis(sys: number, dia: number, pul: number | null, nota: string, C: ThemeColors) {
  let msg: string;
  let color: string;

  if (sys >= 180 || dia >= 110)      { msg = '⚠️ Presión muy alta. Busca atención médica de inmediato o llama a los servicios de emergencia.'; color = C.bp.critica.bg; }
  else if (sys >= 160 || dia >= 100) { msg = '🔴 Presión elevada Grado 2. Evita esfuerzo físico y consulta a tu médico pronto.'; color = C.bp.alta.bg; }
  else if (sys >= 140 || dia >= 90)  { msg = '🟡 Presión elevada Grado 1. No es urgencia, pero revisa tu medicación y descansa.'; color = C.bp.elevada.bg; }
  else if (sys >= 130 || dia >= 85)  { msg = '🟢 Presión normal-alta. Mantén tus hábitos. Buen trabajo.'; color = C.bp.normalAlta.bg; }
  else                               { msg = '✅ Presión excelente. Sigue así. Registra mañana a la misma hora.'; color = C.bp.normal.bg; }

  if (pul !== null) {
    const esEjercicio = nota.toLowerCase().includes('ejercicio');
    if (esEjercicio) {
      if (pul > 190) msg += '\n\n💓 Pulso muy alto incluso para ejercicio intenso (>190 bpm). Descansa y consulta si persiste.';
    } else {
      if (pul > 150)      msg += '\n\n💓 Pulso elevado (>150 bpm). Si estabas en reposo, consulta a tu médico.';
      else if (pul > 100) msg += '\n\n💓 Pulso algo elevado (>100 bpm). Normal tras actividad física, pero el rango en reposo es 60–100 bpm.';
    }
    if (pul < 50) msg += '\n\n💓 Pulso bajo (<50 bpm). Si tienes mareo o fatiga, consulta a tu médico.';
  }

  return { msg, color };
}

function isValid(val: string, min: number, max: number) {
  const n = parseInt(val);
  return !isNaN(n) && n >= min && n <= max;
}

export default function RegisterScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [pul, setPul] = useState('');
  const [nota, setNota] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState<{ msg: string; color: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToastVisible(false));
    }, 2500);
  };

  const sysOk = isValid(sys, 60, 250);
  const diaOk = isValid(dia, 40, 150);
  const pulOk = pul === '' || isValid(pul, 40, 200);
  const canSave = sysOk && diaOk && pulOk;

  const pulNum = pul !== '' && isValid(pul, 40, 200) ? parseInt(pul) : null;
  const liveAnalysis = canSave ? getAnalysis(parseInt(sys), parseInt(dia), pulNum, nota, Colors) : null;
  const displayAnalysis = liveAnalysis ?? savedAnalysis ?? { msg: 'Ingresa tu presión sistólica y diastólica para ver el análisis.', color: Colors.neutralBg };
  const postSaveMode = !canSave && savedAnalysis !== null;

  const handleSysChange = (v: string) => { if (savedAnalysis) setSavedAnalysis(null); setSys(v); };
  const handleDiaChange = (v: string) => { if (savedAnalysis) setSavedAnalysis(null); setDia(v); };
  const handlePulChange = (v: string) => { if (savedAnalysis) setSavedAnalysis(null); setPul(v); };

  const guardar = async () => {
    if (!canSave) return;
    const registro: { sys: number; dia: number; nota: string | null; fecha: string; pul?: number } = {
      sys: parseInt(sys),
      dia: parseInt(dia),
      nota: nota.trim() || null,
      fecha: new Date().toISOString(),
      ...(pul !== '' ? { pul: parseInt(pul) } : {}),
    };
    try {
      const prev = await AsyncStorage.getItem('registros');
      const lista = prev ? JSON.parse(prev) : [];
      lista.unshift(registro);
      await AsyncStorage.setItem('registros', JSON.stringify(lista));
      setSavedAnalysis(getAnalysis(registro.sys, registro.dia, registro.pul ?? null, nota, Colors));
      setSys('');
      setDia('');
      setPul('');
      setNota('');
      if (registro.sys >= 180 || registro.dia >= 110) {
        Alert.alert(
          '⚠️ Presión crítica',
          `Tu presión ${registro.sys}/${registro.dia} mmHg está en rango de crisis. Acude a urgencias o llama a los servicios de emergencia de tu país de inmediato.\n\nEsta app no reemplaza la atención médica.`,
          [{ text: 'Entendido', style: 'cancel' }]
        );
      } else {
        const esNormal = registro.sys < 130 && registro.dia < 85;
        showToast(`✅ ${registro.sys}/${registro.dia} mmHg guardado · +10 aura${esNormal ? ' · +5 normal' : ''}`);
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>
          <Text style={{ fontWeight: '900' }}>S</Text>
          <Text style={{ fontWeight: '200' }}>istola</Text>
          <Text style={{ color: Colors.accent }}>.</Text>
        </Text>
        <Text style={styles.greeting}>Registrar presión</Text>
        <Text style={styles.sub}>Ingresa tus valores ahora</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>¿Cuál es tu presión ahora?</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={sys}
              onChangeText={handleSysChange}
              keyboardType="numeric"
              maxLength={3}
              placeholder="120"
              placeholderTextColor={Colors.text.placeholder}
            />
            <Text style={styles.slash}>/</Text>
            <TextInput
              style={styles.input}
              value={dia}
              onChangeText={handleDiaChange}
              keyboardType="numeric"
              maxLength={3}
              placeholder="80"
              placeholderTextColor={Colors.text.placeholder}
            />
          </View>
          <View style={styles.hintsRow}>
            <Text style={styles.hint}>Sistólica</Text>
            <Text style={styles.hint}>Diastólica</Text>
          </View>
          <View style={styles.pulRow}>
            <Text style={styles.pulLabel}>💓 Pulso</Text>
            <View style={styles.pulInputWrap}>
              <TextInput
                style={[styles.pulInput, !pulOk && pul !== '' && { borderColor: Colors.accent }]}
                value={pul}
                onChangeText={handlePulChange}
                keyboardType="numeric"
                maxLength={3}
                placeholder="—"
                placeholderTextColor={Colors.text.placeholder}
              />
              <Text style={styles.pulUnit}>bpm</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.notaInput}
            value={nota}
            onChangeText={setNota}
            placeholder="Nota opcional..."
            placeholderTextColor={Colors.text.placeholder}
            maxLength={120}
            multiline
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
            <View style={styles.tagsRow}>
              {['En reposo', 'Tras ejercicio', 'Con estrés', 'Tras medicamento', 'Con dolor', 'Tras dormir', 'Después de comer'].map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tag}
                  onPress={() => setNota(n => n ? `${n} · ${tag}` : tag)}
                >
                  <Text style={styles.tagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.card, { backgroundColor: displayAnalysis.color }]}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiIcon}>🩺</Text>
            <View>
              <Text style={styles.aiName}>Asistente Sistola</Text>
              <Text style={styles.aiSub}>{postSaveMode ? '✓ Análisis guardado' : 'Análisis en tiempo real'}</Text>
            </View>
          </View>
          <Text style={styles.aiMsg}>{displayAnalysis.msg}</Text>
        </View>

        {canSave && (
          <View style={styles.puntosPreview}>
            <Text style={styles.puntosText}>
              ⚡ +10 aura{parseInt(sys) < 130 && parseInt(dia) < 85 ? ' · +5 lectura normal' : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity style={[styles.cta, !canSave && { opacity: 0.4 }]} onPress={guardar} disabled={!canSave}>
          <Text style={styles.ctaText}>✓ Guardar registro</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    {toastVisible && (
      <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>
    )}
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.background },
    hero:       { backgroundColor: C.primary, padding: 24, paddingTop: 60 },
    logo:       { color: C.text.onPrimary, fontSize: 30, fontWeight: '700', marginBottom: 12 },
    greeting:   { color: C.text.onPrimary, fontSize: 24, fontWeight: '600' },
    sub:        { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
    body:       { padding: 16, gap: 12 },
    card:       { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: C.cardBorder },
    cardLabel:  { fontSize: 12, color: C.text.muted, textAlign: 'center', marginBottom: 12 },
    inputRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    input:      { backgroundColor: C.inputBg, borderRadius: 10, padding: 10, fontSize: 32, fontWeight: '500', color: C.primary, width: 100, textAlign: 'center' },
    slash:      { fontSize: 28, color: C.text.placeholder },
    hintsRow:   { flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 },
    hint:       { fontSize: 11, color: C.text.light },
    aiHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    aiIcon:     { fontSize: 24 },
    aiName:     { fontSize: 13, fontWeight: '600', color: C.text.primary },
    aiSub:      { fontSize: 11, color: C.text.muted },
    aiMsg:      { fontSize: 13, color: C.text.secondary, lineHeight: 20 },
    cta:        { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
    ctaText:    { color: C.text.onPrimary, fontSize: 15, fontWeight: '600' },
    notaInput:  { fontSize: 13, color: C.text.primary, minHeight: 56, textAlignVertical: 'top' },
    pulRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.cardBorder },
    pulLabel:    { fontSize: 13, color: C.text.secondary },
    pulInputWrap:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
    pulInput:    { backgroundColor: C.inputBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 18, fontWeight: '500', color: C.primary, width: 72, textAlign: 'center', borderWidth: 1, borderColor: 'transparent' },
    pulUnit:     { fontSize: 13, color: C.text.muted },
    tagsScroll:  { marginTop: 12 },
    tagsRow:     { flexDirection: 'row', gap: 6, paddingBottom: 2 },
    tag:         { backgroundColor: C.subtleBg, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
    tagText:     { fontSize: 12, color: C.text.secondary },
    puntosPreview: { backgroundColor: C.primary + '18', borderRadius: 10, padding: 10, alignItems: 'center' },
    puntosText:    { fontSize: 12, color: C.primary, fontWeight: '700' },
    toast:       { position: 'absolute', bottom: 36, left: 24, right: 24, backgroundColor: C.text.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
    toastText:   { color: C.card, fontSize: 14, fontWeight: '500' },
  });
}
