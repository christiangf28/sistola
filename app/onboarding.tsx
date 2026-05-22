import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MedicamentoPicker } from '@/components/medicamento-picker';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme-color';
import { Medicacion } from '@/utils/medicamentos';

type Datos = { nombre: string; edad: string; medicamentos: Medicacion[] };

export default function Onboarding() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [datos, setDatos] = useState<Datos>({ nombre: '', edad: '', medicamentos: [] });
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then(val => {
      if (val === 'true') router.replace('/(tabs)');
    });
  }, []);

  const steps = [
    { titulo: '¡Hola! Soy Sistola 👋', subtitulo: 'Tu acompañante de salud. En 3 pasos te configuro para empezar.', campo: 'nombre', label: '¿Cómo te llamas?', placeholder: 'Ej: Carlos', keyboard: 'default' as const },
    { titulo: 'Cuéntame un poco 🙂', subtitulo: 'Para darte recomendaciones correctas necesito tu edad.', campo: 'edad', label: '¿Cuántos años tienes?', placeholder: 'Ej: 52', keyboard: 'numeric' as const },
    { titulo: 'Tu medicación 💊', subtitulo: 'Selecciona los medicamentos que tomas para la presión. Puedes saltarlo si no tomas ninguno.', campo: 'medicamentos', label: '' },
  ];

  const current = steps[step];
  const esMedicamentos = current.campo === 'medicamentos';
  const valor = esMedicamentos ? '' : (datos as any)[current.campo] as string;
  const canNext = esMedicamentos
    || (current.campo === 'edad'
        ? (() => { const n = parseInt(valor); return !isNaN(n) && n >= 1 && n <= 120; })()
        : valor.trim().length > 0);

  const siguiente = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      await AsyncStorage.setItem('perfil', JSON.stringify(datos));
      await AsyncStorage.setItem('onboarding_done', 'true');
      router.replace('/(tabs)');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.progress}>
        {steps.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotOn]} />
        ))}
      </View>

      <View style={styles.body}>
        <Text style={styles.titulo}>{current.titulo}</Text>
        <Text style={styles.subtitulo}>{current.subtitulo}</Text>

        {esMedicamentos ? (
          <>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerVisible(true)}>
              <Text style={styles.pickerBtnText}>
                {datos.medicamentos.length ? 'Editar selección' : '📋 Elegir de la lista'}
              </Text>
            </TouchableOpacity>

            {datos.medicamentos.length > 0 && (
              <View style={styles.selectedList}>
                {datos.medicamentos.map((m, i) => (
                  <View key={m.nombre + i} style={[styles.selectedRow, i === datos.medicamentos.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.selectedNombre}>{m.nombre}</Text>
                    {(m.dosis || m.frecuencia) ? (
                      <Text style={styles.selectedDosis}>{[m.dosis, m.frecuencia].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {current.label ? <Text style={styles.label}>{current.label}</Text> : null}
            <TextInput
              style={styles.input}
              value={valor}
              onChangeText={v => setDatos(prev => ({ ...prev, [current.campo]: v }))}
              placeholder={current.placeholder}
              placeholderTextColor={Colors.text.placeholder}
              keyboardType={current.keyboard}
              autoFocus
            />
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.cta, !canNext && { opacity: 0.4 }]}
        onPress={siguiente}
        disabled={!canNext}
      >
        <Text style={styles.ctaText}>{step < steps.length - 1 ? 'Siguiente →' : '¡Empezar con Sistola!'}</Text>
      </TouchableOpacity>

      {esMedicamentos && (
        <>
          <TouchableOpacity onPress={siguiente} style={styles.skip}>
            <Text style={styles.skipText}>Saltar por ahora</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Sistola es una herramienta de registro personal. No reemplaza la consulta médica ni el diagnóstico profesional.
          </Text>
        </>
      )}

      <MedicamentoPicker
        visible={pickerVisible}
        initialSelection={datos.medicamentos}
        onSelect={meds => setDatos(prev => ({ ...prev, medicamentos: meds }))}
        onClose={() => setPickerVisible(false)}
      />
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: C.background },
    content:        { padding: 24, paddingTop: 80, minHeight: '100%' },
    progress:       { flexDirection: 'row', gap: 8, marginBottom: 48 },
    progressDot:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.cardBorder },
    progressDotOn:  { backgroundColor: C.primary },
    body:           { flex: 1, gap: 12 },
    titulo:         { fontSize: 28, fontWeight: '700', color: C.text.primary, lineHeight: 36 },
    subtitulo:      { fontSize: 15, color: C.text.subtle, lineHeight: 22, marginBottom: 24 },
    label:          { fontSize: 13, color: C.text.muted, marginBottom: 8 },
    input:          { backgroundColor: C.card, borderRadius: 14, padding: 16, fontSize: 18, color: C.text.primary, borderWidth: 0.5, borderColor: C.cardBorder },
    pickerBtn:      { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.primary, alignItems: 'center' },
    pickerBtnText:  { fontSize: 15, fontWeight: '500', color: C.primary },
    selectedList:   { backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 0.5, borderColor: C.cardBorder },
    selectedRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.divider },
    selectedNombre: { fontSize: 14, fontWeight: '500', color: C.text.primary },
    selectedDosis:  { fontSize: 13, color: C.text.muted },
    cta:            { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 32 },
    ctaText:        { color: C.text.onPrimary, fontSize: 16, fontWeight: '600' },
    skip:           { alignItems: 'center', marginTop: 16 },
    skipText:       { color: C.text.light, fontSize: 13 },
    disclaimer:     { marginTop: 24, fontSize: 11, color: C.text.light, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  });
}
