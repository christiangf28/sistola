export const Colors = {
  primary:     '#7F77DD',
  accent:      '#D85A30',
  background:  '#F8F7FF',
  card:        '#fff',
  cardBorder:  '#E5E3F8',
  sectionLabel:'#3C3489',
  inputBg:     '#F4F3FF',
  subtleBg:    '#EEEDF8',
  divider:     '#F0EEF8',
  dotEmpty:    '#EEE',
  warning:     '#EF9F27',
  success:     '#2E7D32',
  neutralBg:   '#F5F5F5',

  text: {
    primary:     '#1a1a2e',
    secondary:   '#444',
    muted:       '#888',
    light:       '#aaa',
    subtle:      '#666',
    placeholder: '#ccc',
    onPrimary:   '#fff',
  },

  bp: {
    critica:    { bg: '#FFD6D6', color: '#6B0000' },
    alta:       { bg: '#FCEBEB', color: '#501313' },
    elevada:    { bg: '#FAEEDA', color: '#633806' },
    normalAlta: { bg: '#FFF3CC', color: '#5C4000' },
    normal:     { bg: '#E1F5EE', color: '#085041' },
  },
};

export const DarkColors: typeof Colors = {
  primary:     '#9890E8',
  accent:      '#E06B40',
  background:  '#0E0D1A',
  card:        '#1A1929',
  cardBorder:  '#2D2B45',
  sectionLabel:'#B0ADEE',
  inputBg:     '#24223A',
  subtleBg:    '#201E35',
  divider:     '#28263D',
  dotEmpty:    '#2D2B45',
  warning:     '#EF9F27',
  success:     '#4CAF50',
  neutralBg:   '#1A1929',

  text: {
    primary:     '#ECEAFF',
    secondary:   '#C0BEDF',
    muted:       '#7A789A',
    light:       '#504E70',
    subtle:      '#9896B8',
    placeholder: '#4A4868',
    onPrimary:   '#fff',
  },

  bp: {
    critica:    { bg: '#3B0000', color: '#FFAAAA' },
    alta:       { bg: '#2D0A0A', color: '#FF9898' },
    elevada:    { bg: '#2D1800', color: '#FFD070' },
    normalAlta: { bg: '#252000', color: '#FFE566' },
    normal:     { bg: '#003322', color: '#66CC99' },
  },
};

export type ThemeColors = typeof Colors;
