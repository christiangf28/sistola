import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme-color';
import { CLASES, FRECUENCIAS, Medicacion, MEDICAMENTOS, UNIDADES } from '@/utils/medicamentos';

type Props = {
  visible: boolean;
  initialSelection?: Medicacion[];
  onSelect: (medicamentos: Medicacion[]) => void;
  onClose: () => void;
};

export function MedicamentoPicker({ visible, initialSelection, onSelect, onClose }: Props) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [selected, setSelected]         = useState<Medicacion[]>([]);
  const [query, setQuery]               = useState('');
  const [expandedMed, setExpandedMed]   = useState<string | null>(null);
  const [tempDosis, setTempDosis]       = useState('');
  const [tempFrec, setTempFrec]         = useState('');
  const [manualNombre, setManualNombre] = useState('');
  const [manualDosis, setManualDosis]   = useState('');
  const [manualUnidad, setManualUnidad] = useState('mg');
  const [manualFrec, setManualFrec]     = useState('cada 24h');

  useEffect(() => {
    if (visible) {
      setSelected(initialSelection ?? []);
      setQuery('');
      setExpandedMed(null);
      setTempDosis('');
      setTempFrec('');
      setManualNombre('');
      setManualDosis('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo resetear al abrir el modal
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return MEDICAMENTOS;
    return MEDICAMENTOS.filter(
      m => m.nombre.toLowerCase().includes(q) || m.clase.toLowerCase().includes(q)
    );
  }, [query]);

  const clasesVisibles = query.trim() ? [...new Set(filtered.map(m => m.clase))] : CLASES;

  const isSelected       = (nombre: string) => selected.some(s => s.nombre === nombre);
  const getSelected      = (nombre: string) => selected.find(s => s.nombre === nombre);

  const finalizeMed = (nombre: string, dosis: string, frecuencia: string) => {
    setSelected(prev => [...prev.filter(s => s.nombre !== nombre), { nombre, dosis, frecuencia }]);
    setExpandedMed(null);
    setTempDosis('');
    setTempFrec('');
  };

  const handleTapMed = (med: typeof MEDICAMENTOS[number]) => {
    if (isSelected(med.nombre)) {
      setSelected(prev => prev.filter(s => s.nombre !== med.nombre));
      if (expandedMed === med.nombre) { setExpandedMed(null); setTempDosis(''); setTempFrec(''); }
      return;
    }
    if (expandedMed === med.nombre) { setExpandedMed(null); setTempDosis(''); setTempFrec(''); return; }
    setExpandedMed(med.nombre);
    setTempDosis(med.dosis.length === 1 ? med.dosis[0] : '');
    setTempFrec('');
  };

  const handlePickDosis = (dosis: string) => {
    setTempDosis(dosis);
    if (tempFrec && expandedMed) finalizeMed(expandedMed, dosis, tempFrec);
  };

  const handlePickFrecuencia = (frecuencia: string) => {
    setTempFrec(frecuencia);
    if (tempDosis && expandedMed) finalizeMed(expandedMed, tempDosis, frecuencia);
  };

  const handleAgregarManual = () => {
    const nombre = manualNombre.trim();
    if (!nombre) return;
    const dosisStr = manualDosis.trim() ? `${manualDosis.trim()}${manualUnidad}` : '';
    setSelected(prev => [...prev.filter(s => s.nombre !== nombre), { nombre, dosis: dosisStr, frecuencia: manualFrec }]);
    setManualNombre('');
    setManualDosis('');
  };

  const handleConfirmar = () => { onSelect(selected); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Medicamentos para HTA</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre o clase..."
              placeholderTextColor={Colors.text.placeholder}
              clearButtonMode="while-editing"
            />
          </View>

          {selected.length > 0 && (
            <View style={styles.chipsWrap}>
              {selected.map(s => (
                <TouchableOpacity
                  key={s.nombre}
                  style={styles.chip}
                  onPress={() => setSelected(prev => prev.filter(x => x.nombre !== s.nombre))}
                >
                  <View style={styles.chipBody}>
                    <Text style={styles.chipNombre}>
                      {s.nombre}{s.dosis ? ` ${s.dosis}` : ''}
                    </Text>
                    {s.frecuencia ? <Text style={styles.chipFrec}>{s.frecuencia}</Text> : null}
                  </View>
                  <Text style={styles.chipX}>✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fuente}>Fuente: OMS · ESC 2018 · MINSAL</Text>

            {clasesVisibles.map(clase => {
              const meds = filtered.filter(m => m.clase === clase);
              if (!meds.length) return null;
              return (
                <View key={clase}>
                  <Text style={styles.claseLabel}>{clase}</Text>
                  {meds.map(med => {
                    const sel      = isSelected(med.nombre);
                    const expanded = expandedMed === med.nombre;
                    const selData  = getSelected(med.nombre);
                    return (
                      <View key={med.nombre}>
                        <TouchableOpacity style={styles.medRow} onPress={() => handleTapMed(med)}>
                          <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                            {sel && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <View style={styles.medInfo}>
                            <Text style={styles.medNombre}>{med.nombre}</Text>
                            <Text style={[styles.medDosis, sel && { color: Colors.primary }]}>
                              {sel
                                ? [selData?.dosis, selData?.frecuencia].filter(Boolean).join(' · ')
                                : med.dosis.join(' · ')}
                            </Text>
                          </View>
                          {!sel && <Text style={styles.medArrow}>{expanded ? '∧' : '›'}</Text>}
                        </TouchableOpacity>

                        {expanded && (
                          <View style={styles.expandPanel}>
                            {med.dosis.length > 1 && (
                              <View style={styles.expandSection}>
                                <Text style={styles.expandHint}>Dosis:</Text>
                                <View style={styles.expandChips}>
                                  {med.dosis.map(d => (
                                    <TouchableOpacity
                                      key={d}
                                      style={[styles.expandChip, tempDosis === d && styles.expandChipOn]}
                                      onPress={() => handlePickDosis(d)}
                                    >
                                      <Text style={[styles.expandChipText, tempDosis === d && styles.expandChipTextOn]}>{d}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                            <View style={styles.expandSection}>
                              <Text style={styles.expandHint}>Frecuencia:</Text>
                              <View style={styles.expandChips}>
                                {FRECUENCIAS.map(f => (
                                  <TouchableOpacity
                                    key={f}
                                    style={[styles.expandChip, tempFrec === f && styles.expandChipOn]}
                                    onPress={() => handlePickFrecuencia(f)}
                                  >
                                    <Text style={[styles.expandChipText, tempFrec === f && styles.expandChipTextOn]}>{f}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                            {med.dosis.length === 1 && !tempFrec && (
                              <Text style={styles.expandHintMuted}>Selecciona la frecuencia para agregar</Text>
                            )}
                            {med.dosis.length > 1 && (!tempDosis || !tempFrec) && (
                              <Text style={styles.expandHintMuted}>
                                {!tempDosis ? 'Selecciona dosis y frecuencia' : 'Selecciona la frecuencia'}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <View style={styles.manualSection}>
              <Text style={styles.claseLabel}>AGREGAR MANUALMENTE</Text>
              <TextInput
                style={styles.manualInput}
                value={manualNombre}
                onChangeText={setManualNombre}
                placeholder="Nombre del medicamento"
                placeholderTextColor={Colors.text.placeholder}
              />
              <View style={styles.manualDosisRow}>
                <TextInput
                  style={[styles.manualInput, { flex: 1 }]}
                  value={manualDosis}
                  onChangeText={setManualDosis}
                  placeholder="Cantidad"
                  placeholderTextColor={Colors.text.placeholder}
                  keyboardType="decimal-pad"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                  <View style={styles.unitChips}>
                    {UNIDADES.map(u => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setManualUnidad(u)}
                        style={[styles.unitChip, manualUnidad === u && styles.unitChipOn]}
                      >
                        <Text style={[styles.unitChipText, manualUnidad === u && styles.unitChipTextOn]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={styles.manualFrecRow}>
                {FRECUENCIAS.map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setManualFrec(f)}
                    style={[styles.expandChip, manualFrec === f && styles.expandChipOn]}
                  >
                    <Text style={[styles.expandChipText, manualFrec === f && styles.expandChipTextOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.manualAddBtn, !manualNombre.trim() && { opacity: 0.4 }]}
                onPress={handleAgregarManual}
                disabled={!manualNombre.trim()}
              >
                <Text style={styles.manualAddBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, !selected.length && { opacity: 0.4 }]}
              onPress={handleConfirmar}
              disabled={!selected.length}
            >
              <Text style={styles.confirmBtnText}>
                {selected.length ? `Confirmar (${selected.length})` : 'Selecciona al menos uno'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:             { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
    header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: C.divider },
    headerTitle:       { fontSize: 15, fontWeight: '600', color: C.text.primary },
    closeBtn:          { fontSize: 18, color: C.text.muted, paddingHorizontal: 4 },
    searchWrap:        { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.divider },
    searchInput:       { backgroundColor: C.inputBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.text.primary },
    chipsWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, borderBottomWidth: 0.5, borderBottomColor: C.divider },
    chip:              { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
    chipBody:          { flexShrink: 1 },
    chipNombre:        { color: C.text.onPrimary, fontSize: 13, fontWeight: '600' },
    chipFrec:          { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
    chipX:             { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
    list:              { paddingHorizontal: 16 },
    fuente:            { fontSize: 10, color: C.text.light, marginTop: 12, marginBottom: 4 },
    claseLabel:        { fontSize: 10, fontWeight: '700', color: C.sectionLabel, letterSpacing: 1, marginTop: 16, marginBottom: 4 },
    medRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.divider, gap: 10 },
    checkbox:          { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: C.inputBg },
    checkboxOn:        { backgroundColor: C.primary, borderColor: C.primary },
    checkMark:         { color: C.text.onPrimary, fontSize: 12, fontWeight: '700' },
    medInfo:           { flex: 1 },
    medNombre:         { fontSize: 15, fontWeight: '500', color: C.text.primary },
    medDosis:          { fontSize: 12, color: C.text.muted, marginTop: 2 },
    medArrow:          { fontSize: 18, color: C.text.light, marginLeft: 4 },
    expandPanel:       { backgroundColor: C.inputBg, borderRadius: 12, padding: 12, marginBottom: 4, marginLeft: 32, gap: 10 },
    expandSection:     { gap: 6 },
    expandHint:        { fontSize: 11, fontWeight: '600', color: C.sectionLabel, letterSpacing: 0.5 },
    expandHintMuted:   { fontSize: 11, color: C.text.light, fontStyle: 'italic', marginTop: 2 },
    expandChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    expandChip:        { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.primary, backgroundColor: C.card },
    expandChipOn:      { backgroundColor: C.primary },
    expandChipText:    { fontSize: 13, fontWeight: '500', color: C.primary },
    expandChipTextOn:  { color: C.text.onPrimary },
    manualSection:     { marginTop: 4 },
    manualInput:       { backgroundColor: C.inputBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text.primary, marginBottom: 8 },
    manualDosisRow:    { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
    unitScroll:        { flex: 1 },
    unitChips:         { flexDirection: 'row', gap: 6, alignItems: 'center' },
    unitChip:          { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.card },
    unitChipOn:        { backgroundColor: C.primary, borderColor: C.primary },
    unitChipText:      { fontSize: 13, fontWeight: '500', color: C.text.secondary },
    unitChipTextOn:    { color: C.text.onPrimary },
    manualFrecRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    manualAddBtn:      { backgroundColor: C.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
    manualAddBtnText:  { color: C.text.onPrimary, fontSize: 14, fontWeight: '600' },
    footer:            { padding: 16, borderTopWidth: 0.5, borderTopColor: C.divider },
    confirmBtn:        { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
    confirmBtnText:    { color: C.text.onPrimary, fontSize: 15, fontWeight: '600' },
  });
}
