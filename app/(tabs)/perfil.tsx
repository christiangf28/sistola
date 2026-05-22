import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcRacha } from '@/utils/gamificacion';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MedicamentoPicker } from '@/components/medicamento-picker';
import { ThemeColors } from '@/constants/theme';
import { useAppScheme } from '@/contexts/theme';
import { useColors } from '@/hooks/use-theme-color';
import { Medicacion } from '@/utils/medicamentos';

type Perfil = { nombre: string; edad: string; medicamentos: Medicacion[] };
type Meta = { sys: number; dia: number };

const PERFIL_RESET: Perfil = { nombre: '', edad: '', medicamentos: [] };

const EMOJIS_AVATAR = ['😊','😎','🙂','😄','🧑','👩','👨','🧓','💪','🧘','❤️','🌟','🦋','🌺','🎯','🏃'];

function iniciales(nombre: string) {
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

function parsePerfil(raw: any): Perfil {
  if (!raw) return PERFIL_RESET;
  if (raw.medicamento !== undefined && !raw.medicamentos) {
    return {
      nombre: raw.nombre ?? '',
      edad: raw.edad ?? '',
      medicamentos: raw.medicamento ? [{ nombre: raw.medicamento, dosis: raw.dosis ?? '', frecuencia: 'cada 24h' }] : [],
    };
  }
  return {
    nombre: raw.nombre ?? '',
    edad: raw.edad ?? '',
    medicamentos: (raw.medicamentos ?? []).map((m: any) => ({
      nombre: m.nombre ?? '',
      dosis: m.dosis ?? '',
      frecuencia: m.frecuencia ?? '',
    })),
  };
}

export default function PerfilScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const router = useRouter();
  const { scheme, toggle } = useAppScheme();
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_RESET);
  const [editando, setEditando]     = useState(false);
  const [form, setForm]             = useState<Perfil>(PERFIL_RESET);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [fotoUri, setFotoUri]       = useState<string | null>(null);
  const [emojiAvatar, setEmojiAvatar] = useState<string | null>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [editMeta, setEditMeta]     = useState({ sys: '130', dia: '80' });
  const [adherencia, setAdherencia] = useState<number | null>(null);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [racha, setRacha] = useState(0);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('registros').then(d => {
      const lista = d ? JSON.parse(d) : [];
      setTotalRegistros(lista.length);
      setRacha(calcRacha(lista));
    });
    AsyncStorage.getItem('perfil').then(d => {
      const p = parsePerfil(d ? JSON.parse(d) : null);
      setPerfil(p);
      setForm(p);
    });
    AsyncStorage.getItem('perfil_foto').then(uri => setFotoUri(uri));
    AsyncStorage.getItem('perfil_emoji').then(e => setEmojiAvatar(e));
    AsyncStorage.getItem('meta_presion').then(d => {
      if (d) {
        const m: Meta = JSON.parse(d);
        setMeta(m);
        setEditMeta({ sys: String(m.sys), dia: String(m.dia) });
      }
    });
    (async () => {
      const last30Keys = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return 'checkin_' + d.toISOString().split('T')[0];
      });
      const pairs = await AsyncStorage.multiGet(last30Keys);
      const conDatos = pairs.filter(([, v]) => v !== null);
      const conMed = conDatos.filter(([, v]) => v && JSON.parse(v).med === true);
      setAdherencia(conDatos.length > 0 ? Math.round((conMed.length / conDatos.length) * 100) : null);
    })();
  }, []));

  const handleCambiarAvatar = () => {
    const opciones: any[] = [
      {
        text: '📷 Elegir foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) {
            const uri = result.assets[0].uri;
            setFotoUri(uri);
            setEmojiAvatar(null);
            await AsyncStorage.setItem('perfil_foto', uri);
            await AsyncStorage.removeItem('perfil_emoji');
          }
        },
      },
      {
        text: '😊 Elegir emoji',
        onPress: () => setEmojiPickerVisible(true),
      },
    ];
    if (fotoUri || emojiAvatar) {
      opciones.push({
        text: 'Eliminar',
        style: 'destructive' as const,
        onPress: async () => {
          setFotoUri(null);
          setEmojiAvatar(null);
          await AsyncStorage.removeItem('perfil_foto');
          await AsyncStorage.removeItem('perfil_emoji');
        },
      });
    }
    opciones.push({ text: 'Cancelar', style: 'cancel' as const });
    Alert.alert('Foto de perfil', '', opciones);
  };

  const handleSeleccionarEmoji = async (emoji: string) => {
    setEmojiAvatar(emoji);
    setFotoUri(null);
    setEmojiPickerVisible(false);
    await AsyncStorage.setItem('perfil_emoji', emoji);
    await AsyncStorage.removeItem('perfil_foto');
  };

  const guardar = async () => {
    await AsyncStorage.setItem('perfil', JSON.stringify(form));
    setPerfil(form);
    const metaSys = parseInt(editMeta.sys);
    const metaDia = parseInt(editMeta.dia);
    if (!isNaN(metaSys) && !isNaN(metaDia) && metaSys > 0 && metaDia > 0) {
      const m: Meta = { sys: metaSys, dia: metaDia };
      await AsyncStorage.setItem('meta_presion', JSON.stringify(m));
      setMeta(m);
    }
    setEditando(false);
  };

  const cancelar = () => { setForm(perfil); setEditando(false); };

  const handleExportarBackup = () => {
    Alert.alert(
      'Exportar copia de seguridad',
      'Este archivo contiene tus datos de salud (presión arterial, medicamentos, hábitos). Compártelo solo en lugares seguros y de confianza.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar',
          onPress: async () => {
            const keys = await AsyncStorage.getAllKeys();
            const pairs = await AsyncStorage.multiGet(keys as string[]);
            const data: Record<string, string> = {};
            for (const [k, v] of pairs) { if (v !== null) data[k] = v; }
            const json = JSON.stringify({ version: 1, exportado: new Date().toISOString(), data }, null, 2);
            const path = FileSystem.cacheDirectory + 'sistola_backup.json';
            await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });
            await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Exportar copia de seguridad' });
          },
        },
      ]
    );
  };

  const handleImportarBackup = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
      if (raw.length > 5 * 1024 * 1024) throw new Error('Archivo demasiado grande');
      const parsed = JSON.parse(raw);
      if (!parsed.version || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data))
        throw new Error('Formato inválido');

      const CLAVE_OK = /^(registros|perfil|perfil_foto|perfil_emoji|meta_presion|notif_time|notif_hour|onboarding_done|theme|logros_vistos|checkin_\d{4}-\d{2}-\d{2})$/;
      const entries: [string, string][] = Object.entries(parsed.data).filter(([k, v]) =>
        CLAVE_OK.test(k) && typeof v === 'string'
      ) as [string, string][];

      if (entries.length === 0) throw new Error('Sin datos reconocidos');

      Alert.alert(
        'Restaurar copia de seguridad',
        `Se restaurarán ${entries.length} registros. Esto reemplazará todos tus datos actuales. ¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar', style: 'destructive',
            onPress: async () => {
              const currentKeys = await AsyncStorage.getAllKeys();
              await AsyncStorage.multiRemove(currentKeys as string[]);
              await AsyncStorage.multiSet(entries);
              const perfilEntry = entries.find(([k]) => k === 'perfil');
              const p = parsePerfil(perfilEntry ? JSON.parse(perfilEntry[1]) : null);
              setPerfil(p);
              setForm(p);
              const fotoEntry = entries.find(([k]) => k === 'perfil_foto');
              setFotoUri(fotoEntry ? fotoEntry[1] : null);
              const emojiEntry = entries.find(([k]) => k === 'perfil_emoji');
              setEmojiAvatar(emojiEntry ? emojiEntry[1] : null);
              Alert.alert('✅ Restaurado', 'Tus datos fueron restaurados correctamente.');
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'El archivo no es un backup válido de Sistola.');
    }
  };

  const handleBorrarTodo = () => {
    Alert.alert(
      'Borrar todos los datos',
      'Se eliminarán todos tus registros, check-ins y configuración. Esta acción no se puede deshacer.\n\nTe recomendamos exportar una copia de seguridad antes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Exportar primero', onPress: handleExportarBackup },
        {
          text: 'Borrar todo', style: 'destructive',
          onPress: async () => {
            const keys = await AsyncStorage.getAllKeys();
            await AsyncStorage.multiRemove(keys as string[]);
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const ini = iniciales(perfil.nombre);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>
          <Text style={{ fontWeight: '900' }}>S</Text>
          <Text style={{ fontWeight: '200' }}>istola</Text>
          <Text style={{ color: Colors.accent }}>.</Text>
        </Text>
        <View style={styles.heroContent}>
          <TouchableOpacity onPress={handleCambiarAvatar} style={styles.avatarTouch}>
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.heroAvatarImg} />
            ) : emojiAvatar ? (
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarEmoji}>{emojiAvatar}</Text>
              </View>
            ) : (
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{ini || '?'}</Text>
              </View>
            )}
            <View style={styles.avatarCamara}>
              <Text style={styles.avatarCamaraIcon}>✏️</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.heroInfo}>
            <Text style={styles.heroNombre}>{perfil.nombre || 'Sin nombre'}</Text>
            {perfil.edad ? <Text style={styles.heroEdad}>{perfil.edad} años</Text> : null}
          </View>
        </View>
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalRegistros}</Text>
            <Text style={styles.statLabel}>registros</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{racha}</Text>
            <Text style={styles.statLabel}>días racha</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{adherencia !== null ? `${adherencia}%` : '—'}</Text>
            <Text style={[styles.statLabel, adherencia !== null && { color: adherencia >= 80 ? '#86efac' : adherencia >= 50 ? '#fcd34d' : '#fca5a5' }]}>
              adherencia
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>

        {!editando ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>DATOS PERSONALES</Text>
              <InfoRow label="Nombre" value={perfil.nombre || '—'} styles={styles} />
              <InfoRow label="Edad" value={perfil.edad ? `${perfil.edad} años` : '—'} styles={styles} last />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>MEDICACIÓN</Text>
              {perfil.medicamentos.length === 0 ? (
                <Text style={styles.emptyMed}>Sin medicamentos registrados</Text>
              ) : (
                perfil.medicamentos.map((m, i) => (
                  <InfoRow
                    key={m.nombre + i}
                    label={m.nombre}
                    value={[m.dosis, m.frecuencia].filter(Boolean).join(' · ') || '—'}
                    styles={styles}
                    last={i === perfil.medicamentos.length - 1 && adherencia === null}
                  />
                ))
              )}
              {adherencia !== null && (
                <View style={[styles.infoRow, { borderTopWidth: perfil.medicamentos.length ? 0.5 : 0, borderTopColor: Colors.divider }]}>
                  <Text style={styles.infoLabel}>Adherencia (30 días)</Text>
                  <Text style={[styles.infoValue, { color: adherencia >= 80 ? Colors.success : adherencia >= 50 ? Colors.warning : Colors.accent }]}>
                    {adherencia}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>META DE PRESIÓN</Text>
              {meta ? (
                <InfoRow label="Objetivo" value={`${meta.sys}/${meta.dia} mmHg`} styles={styles} last />
              ) : (
                <Text style={styles.emptyMed}>Sin meta configurada — edita tu perfil para establecerla</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>APARIENCIA</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Modo oscuro</Text>
                <Switch
                  value={scheme === 'dark'}
                  onValueChange={toggle}
                  trackColor={{ false: Colors.cardBorder, true: Colors.primary }}
                  thumbColor={Colors.card}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.editBtn} onPress={() => setEditando(true)}>
              <Text style={styles.editBtnText}>Editar perfil</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>COPIA DE SEGURIDAD</Text>
              <TouchableOpacity style={[styles.infoRow, { paddingVertical: 12 }]} onPress={handleExportarBackup}>
                <Text style={styles.infoLabel}>Exportar backup</Text>
                <Text style={[styles.infoValue, { color: Colors.primary }]}>JSON →</Text>
              </TouchableOpacity>
              <View style={{ borderTopWidth: 0.5, borderTopColor: Colors.divider }}>
                <TouchableOpacity style={[styles.infoRow, { paddingVertical: 12 }]} onPress={handleImportarBackup}>
                  <Text style={styles.infoLabel}>Importar backup</Text>
                  <Text style={[styles.infoValue, { color: Colors.primary }]}>← JSON</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>TENSIÓMETROS RECOMENDADOS</Text>
              <Text style={styles.afiliadoSub}>Para mediciones precisas y confiables · Disponible en MercadoLibre Chile</Text>
              {[
                { nombre: 'Omron RS2',       desc: 'Muñeca · Compacto y preciso',           emoji: '⌚', url: 'https://www.mercadolibre.cl/social/guch5652947?matt_word=guch5652947&matt_tool=91729548&forceInApp=true&ref=BF22XIkz%2FpIjgdvZSkPUabfTd9GDkFxzjhxlPSUet3E9GETpS1xT9AhkYu3SeuhgxF2bOKYJNMfxIj0q0U835M76G2Fmt53%2BiKnjzv0%2FnHFa8pXRaHyMcWJTQh%2FmIFrzbJRJtuTMwlXFXbXk%2FmBLwod4jYuJyZ5w7JMOdKt0GQ4XjTuw%2F6gh1INedkxyHBgo%2F6sShyXu8hlh7vEHUA%3D%3D' },
                { nombre: 'Omron X2 Basic',  desc: 'Brazo · Básico · Validado clínicamente', emoji: '🩺', url: 'https://www.mercadolibre.cl/social/guch5652947?matt_word=guch5652947&matt_tool=91729548&forceInApp=true&ref=BA6myj6RL%2BSj2eqRlEFU3RBUHCkCA32DrKBJ1pOhFW8a9RFQa0dEtDmrVy0OSCraGkUEFUUgT4uplqcltJr8LdE6XLwCkIFs8VDZ2la5IpkCtic1cNIUrXPp7Jv8HL9FbLlxMIN2Ibc5GCuGmAN%2BIty2KZr%2FOvjLxPhKBupEJ1gkoDS%2BPocSZpYv24N7JqjBnfS6yd0%3D' },
                { nombre: 'Omron HEM-7156T', desc: 'Brazo · Bluetooth · Para smartphone',    emoji: '📱', url: 'https://www.mercadolibre.cl/social/guch5652947?matt_word=guch5652947&matt_tool=91729548&forceInApp=true&ref=BIE%2BnToJMEZ7e0Vq52cMe%2BDvMerxBJe9btDYRSRkpBJP3hrslQjdN0pmfWGHygHJ75KSXFlsSdP2Qj4kU6oRN8qfKgGZpqvlm7T8I56NqQiFaJmBJht7LLaScevjmtmNXGc1SuPY9ENOIcGBhiYp2iijrBi9SkVOwW%2BkiYJ2pCa%2Bi%2BQPl4kuVTAftBt9c7u64KZg0eU%3D' },
                { nombre: 'Beurer BM-25',    desc: 'Brazo · Digital · Automático',            emoji: '💙', url: 'https://www.mercadolibre.cl/social/guch5652947?matt_word=guch5652947&matt_tool=91729548&forceInApp=true&ref=BM8mS5KZ3FiNGCYxLQkvxEEgRz7OU3KjPR8ax2KJvRoXn8LiSHR9HezoSA2vJKNtxFmYkA9SV5HyvQ%2FxA2uvwJM7KgMv%2BM%2BCRqWAITeeMoHmlnp8B1MR8Pz9kh3GjlfVlVgh%2FZV%2FxjygoLVnR5Mb9animnrrYx12suCQV6c6%2F%2BntLjrr7nO7FtLieWqz3q%2BOGApFEeI%3D' },
                { nombre: 'Braun BUA-4000',  desc: 'Brazo · Clásico · Fácil de usar',        emoji: '❤️', url: 'https://www.mercadolibre.cl/social/guch5652947?matt_word=guch5652947&matt_tool=91729548&forceInApp=true&ref=BACjWNtp4QuBJr%2FtjezicLK6dtrJ6oyIX7PB33wO9sxEOrGi3E7HXVhS6QmIjIXFTVu73bh2PHSD8qJgqQ8rOG31KF6igIh4s4ntqUS0KiTFN04ECC0jpHo6AOU52YdZ5qEo6q7t75zkCgrGpC2NEonkBRcXAFqDQC7jjoGSqLW1opU7tGzSr%2FwxuZ1c3QBNDuuQo7M%3D' },
              ].map((item, i, arr) => (
                <TouchableOpacity
                  key={item.nombre}
                  style={[styles.afiliadoRow, i < arr.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: Colors.divider }]}
                  onPress={() => Linking.openURL(item.url)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.afiliadoEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.afiliadoNombre}>{item.nombre}</Text>
                    <Text style={styles.afiliadoDesc}>{item.desc}</Text>
                  </View>
                  <Text style={styles.afiliadoBtn}>Ver →</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleBorrarTodo}>
              <Text style={styles.deleteBtnText}>Borrar todos los datos</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>DATOS PERSONALES</Text>
              <EditRow label="Nombre" value={form.nombre} onChangeText={v => setForm(p => ({ ...p, nombre: v }))} styles={styles} Colors={Colors} />
              <EditRow label="Edad" value={form.edad} onChangeText={v => setForm(p => ({ ...p, edad: v }))} keyboard="numeric" last styles={styles} Colors={Colors} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>MEDICACIÓN</Text>
              {form.medicamentos.length === 0 ? (
                <Text style={styles.emptyMed}>Ninguno seleccionado</Text>
              ) : (
                form.medicamentos.map((m, i) => (
                  <InfoRow
                    key={m.nombre + i}
                    label={m.nombre}
                    value={[m.dosis, m.frecuencia].filter(Boolean).join(' · ') || '—'}
                    styles={styles}
                    last={i === form.medicamentos.length - 1}
                  />
                ))
              )}
              <TouchableOpacity style={styles.editMedBtn} onPress={() => setPickerVisible(true)}>
                <Text style={styles.editMedBtnText}>
                  {form.medicamentos.length ? 'Editar selección' : 'Seleccionar medicamentos'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>META DE PRESIÓN</Text>
              <EditRow label="Sistólica (SYS)" value={editMeta.sys} onChangeText={v => setEditMeta(p => ({ ...p, sys: v }))} keyboard="numeric" styles={styles} Colors={Colors} />
              <EditRow label="Diastólica (DIA)" value={editMeta.dia} onChangeText={v => setEditMeta(p => ({ ...p, dia: v }))} keyboard="numeric" last styles={styles} Colors={Colors} />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={guardar}>
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelar}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.disclaimer}>
          Sistola v1.0.0{'\n'}Herramienta de registro personal · No reemplaza el diagnóstico médico
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://gist.github.com/christiangf28/2306a8622350312a58205c122bca7154#file-gistfile1-txt')}>
          <Text style={styles.privacyLink}>Política de privacidad</Text>
        </TouchableOpacity>
      </View>

      <MedicamentoPicker
        visible={pickerVisible}
        initialSelection={form.medicamentos}
        onSelect={meds => setForm(p => ({ ...p, medicamentos: meds }))}
        onClose={() => setPickerVisible(false)}
      />

      <Modal visible={emojiPickerVisible} transparent animationType="fade" onRequestClose={() => setEmojiPickerVisible(false)}>
        <TouchableOpacity style={styles.emojiOverlay} activeOpacity={1} onPress={() => setEmojiPickerVisible(false)}>
          <View style={styles.emojiModal}>
            <Text style={styles.emojiModalTitle}>Elige tu emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS_AVATAR.map(e => (
                <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => handleSeleccionarEmoji(e)}>
                  <Text style={styles.emojiBtnText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

type RowStyles = ReturnType<typeof makeStyles>;

function InfoRow({ label, value, last, styles }: { label: string; value: string; last?: boolean; styles: RowStyles }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EditRow({ label, value, onChangeText, placeholder, keyboard, last, styles, Colors }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboard?: 'numeric'; last?: boolean;
  styles: RowStyles; Colors: ThemeColors;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? '—'}
        placeholderTextColor={Colors.text.placeholder}
        keyboardType={keyboard ?? 'default'}
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: C.background },
    hero:          { backgroundColor: C.primary, padding: 24, paddingTop: 60, paddingBottom: 20 },
    logo:          { color: C.text.onPrimary, fontSize: 30, fontWeight: '700', marginBottom: 16 },
    heroContent:   { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
    heroAvatar:    { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)' },
    heroAvatarImg: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)' },
    heroAvatarText: { color: C.text.onPrimary, fontSize: 26, fontWeight: '700' },
    heroAvatarEmoji:{ fontSize: 36 },
    heroInfo:      { flex: 1 },
    heroNombre:    { color: C.text.onPrimary, fontSize: 22, fontWeight: '700' },
    heroEdad:      { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },
    avatarTouch:   { position: 'relative' },
    avatarCamara:     { position: 'absolute', bottom: 0, right: 0, backgroundColor: C.card, borderRadius: 10, padding: 3, borderWidth: 1.5, borderColor: C.cardBorder },
    avatarCamaraIcon: { fontSize: 11 },
    statsStrip:    { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, padding: 14 },
    statItem:      { flex: 1, alignItems: 'center' },
    statNum:       { color: C.text.onPrimary, fontSize: 22, fontWeight: '700' },
    statLabel:     { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
    statDivider:   { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
    body:          { padding: 16, gap: 12 },
    card:          { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: C.cardBorder },
    sectionLabel:  { fontSize: 11, color: C.sectionLabel, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
    infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    infoRowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.divider },
    infoLabel:     { fontSize: 13, color: C.text.muted },
    infoValue:     { fontSize: 13, fontWeight: '500', color: C.text.primary },
    editInput:     { fontSize: 13, fontWeight: '500', color: C.text.primary, textAlign: 'right', minWidth: 120 },
    emptyMed:      { fontSize: 13, color: C.text.light, paddingVertical: 4 },
    editMedBtn:    { marginTop: 12, borderTopWidth: 0.5, borderTopColor: C.divider, paddingTop: 12, alignItems: 'center' },
    editMedBtnText:{ fontSize: 13, color: C.primary, fontWeight: '600' },
    editBtn:       { backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.primary },
    editBtnText:   { color: C.primary, fontSize: 15, fontWeight: '600' },
    saveBtn:       { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
    saveBtnText:   { color: C.text.onPrimary, fontSize: 15, fontWeight: '600' },
    cancelBtn:     { alignItems: 'center', padding: 12 },
    cancelBtnText: { color: C.text.muted, fontSize: 14 },
    deleteBtn:     { alignItems: 'center', padding: 12 },
    deleteBtnText: { color: C.accent, fontSize: 13 },
    disclaimer:    { marginTop: 8, fontSize: 11, color: C.text.light, textAlign: 'center', lineHeight: 17 },
    privacyLink:   { paddingBottom: 32, fontSize: 11, color: C.primary, textAlign: 'center', textDecorationLine: 'underline', marginTop: 6 },
    afiliadoSub:   { fontSize: 11, color: C.text.muted, marginBottom: 10 },
    afiliadoRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
    afiliadoEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
    afiliadoNombre:{ fontSize: 13, fontWeight: '600', color: C.text.primary },
    afiliadoDesc:  { fontSize: 11, color: C.text.muted, marginTop: 1 },
    afiliadoBtn:   { fontSize: 12, color: C.primary, fontWeight: '700' },
    emojiOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    emojiModal:    { backgroundColor: C.card, borderRadius: 20, padding: 24, width: 300, borderWidth: 0.5, borderColor: C.cardBorder },
    emojiModalTitle:{ fontSize: 15, fontWeight: '700', color: C.text.primary, marginBottom: 16, textAlign: 'center' },
    emojiGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    emojiBtn:      { width: 52, height: 52, borderRadius: 14, backgroundColor: C.subtleBg, alignItems: 'center', justifyContent: 'center' },
    emojiBtnText:  { fontSize: 28 },
  });
}
