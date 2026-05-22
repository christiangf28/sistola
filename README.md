# Sistola — Monitor de Presión Arterial

> App móvil para monitorear la presión arterial, registrar hábitos de bienestar y mantener la adherencia a medicamentos. Disponible en Android.

## Capturas de pantalla

<!-- Agrega tus screenshots aquí -->
<!-- ![Home](screenshots/home.png) ![Registro](screenshots/registro.png) -->

## Funcionalidades

- **Registro de presión arterial** — validación clínica (ESC/ESH 2018), alerta de presión crítica con llamada de emergencias
- **Dashboard inteligente** — insight de tendencia, racha semanal, comparativa con semana anterior
- **Gráfico de tendencia** — sistólica, diastólica y pulso en los últimos 14 días con línea de meta
- **Check-in diario** — sueño, estrés y actividad con feedback contextual de bienestar
- **Historial completo** — filtros por clasificación y período, swipe-to-delete, export a texto/CSV/PDF
- **Gamificación** — sistema de aura, niveles progresivos y 8 logros desbloqueables
- **Recordatorios push** — notificación diaria con hora configurable
- **Modo oscuro** — toggle manual, tema-aware en todos los componentes
- **Copia de seguridad** — export/import JSON con validación
- **Perfil personalizable** — foto o emoji de avatar, adherencia a medicamentos

## Stack técnico

| Tecnología | Uso |
|---|---|
| React Native 0.81 + Expo SDK 54 | Framework principal |
| Expo Router 6 | Navegación file-based |
| TypeScript estricto | Tipado completo |
| AsyncStorage | Persistencia local (sin backend) |
| react-native-svg | Gráficos de línea |
| expo-notifications | Recordatorios push |
| expo-print + expo-sharing | Export PDF/CSV |
| expo-image-picker | Avatar de perfil |
| react-native-gesture-handler | Swipe-to-delete |
| react-native-view-shot | Captura de gráficos como imagen |

## Arquitectura

```
app/
  _layout.tsx          # Root layout con ThemeSchemeProvider
  onboarding.tsx       # Wizard 3 pasos con picker de medicamentos
  (tabs)/
    index.tsx          # Dashboard principal
    explore.tsx        # Registro de presión arterial
    historial.tsx      # Historial con stats y export
    perfil.tsx         # Perfil y configuración
components/
  bp-chart.tsx         # Gráfico BP tema-aware
  checkin-chart.tsx    # Gráfico sueño/estrés
  medicamento-picker.tsx
contexts/
  theme.tsx            # ThemeSchemeProvider + useAppScheme()
utils/
  notifications.ts
  insights.ts          # Tendencia, correlación sueño, racha
  gamificacion.ts      # Cálculo de aura, niveles, logros
  medicamentos.ts      # Lista WHO/ESC 2018
constants/
  theme.ts             # Tokens de color (claro y oscuro)
hooks/
  use-theme-color.ts   # useColors() — retorna tema activo
```

## Lógica de clasificación BP (ESC/ESH 2018)

```
SYS ≥ 180 | DIA ≥ 110  →  Crítica      (HTA Grado 3)
SYS ≥ 160 | DIA ≥ 100  →  Alta         (HTA Grado 2)
SYS ≥ 140 | DIA ≥  90  →  Elevada      (HTA Grado 1)
SYS ≥ 130 | DIA ≥  85  →  Normal-alta
resto                   →  Normal
```

## Instalar y correr

```bash
npm install
npx expo start
```

Para build en dispositivo físico (requiere EAS):

```bash
eas build --profile preview --platform android
```

## Diseño

- Color primario: `#7F77DD` (púrpura)
- Modo claro y oscuro completos
- Sin dependencias de UI externas — estilos con StyleSheet + tokens de tema propios

## Licencia

MIT
