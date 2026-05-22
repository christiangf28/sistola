export type Medicamento = { nombre: string; clase: string; dosis: string[] };
export type Medicacion  = { nombre: string; dosis: string; frecuencia?: string };

export const FRECUENCIAS = ['cada 24h', 'cada 12h', 'cada 8h', 'cada 6h'];
export const UNIDADES    = ['mg', 'mcg', 'g', 'mL', 'UI'];

export const MEDICAMENTOS: Medicamento[] = [
  // IECA — primera línea OMS/ESC 2018
  { nombre: 'Enalapril',          clase: 'IECA',                     dosis: ['2.5mg', '5mg', '10mg', '20mg'] },
  { nombre: 'Ramipril',           clase: 'IECA',                     dosis: ['2.5mg', '5mg', '10mg'] },
  { nombre: 'Lisinopril',         clase: 'IECA',                     dosis: ['5mg', '10mg', '20mg'] },
  { nombre: 'Captopril',          clase: 'IECA',                     dosis: ['12.5mg', '25mg', '50mg'] },
  { nombre: 'Perindopril',        clase: 'IECA',                     dosis: ['4mg', '8mg'] },
  { nombre: 'Fosinopril',         clase: 'IECA',                     dosis: ['10mg', '20mg'] },

  // ARA-II — primera línea OMS/ESC 2018
  { nombre: 'Losartán',           clase: 'ARA-II',                   dosis: ['25mg', '50mg', '100mg'] },
  { nombre: 'Valsartán',          clase: 'ARA-II',                   dosis: ['80mg', '160mg', '320mg'] },
  { nombre: 'Irbesartán',         clase: 'ARA-II',                   dosis: ['75mg', '150mg', '300mg'] },
  { nombre: 'Telmisartán',        clase: 'ARA-II',                   dosis: ['20mg', '40mg', '80mg'] },
  { nombre: 'Olmesartán',         clase: 'ARA-II',                   dosis: ['10mg', '20mg', '40mg'] },
  { nombre: 'Candesartán',        clase: 'ARA-II',                   dosis: ['4mg', '8mg', '16mg', '32mg'] },

  // Calcioantagonistas — primera línea OMS/ESC 2018
  { nombre: 'Amlodipino',         clase: 'Calcioantagonista',        dosis: ['2.5mg', '5mg', '10mg'] },
  { nombre: 'Nifedipino',         clase: 'Calcioantagonista',        dosis: ['10mg', '20mg', '30mg'] },
  { nombre: 'Lercanidipino',      clase: 'Calcioantagonista',        dosis: ['10mg', '20mg'] },
  { nombre: 'Verapamilo',         clase: 'Calcioantagonista',        dosis: ['80mg', '120mg', '180mg', '240mg'] },
  { nombre: 'Diltiazem',          clase: 'Calcioantagonista',        dosis: ['60mg', '90mg', '120mg', '180mg'] },

  // Diuréticos — primera línea OMS/ESC 2018
  { nombre: 'Hidroclorotiazida',  clase: 'Diurético',                dosis: ['12.5mg', '25mg'] },
  { nombre: 'Clortalidona',       clase: 'Diurético',                dosis: ['12.5mg', '25mg'] },
  { nombre: 'Indapamida',         clase: 'Diurético',                dosis: ['1.25mg', '2.5mg'] },
  { nombre: 'Furosemida',         clase: 'Diurético',                dosis: ['20mg', '40mg', '80mg'] },
  { nombre: 'Espironolactona',    clase: 'Diurético',                dosis: ['25mg', '50mg', '100mg'] },

  // Betabloqueadores
  { nombre: 'Bisoprolol',         clase: 'Betabloqueador',           dosis: ['2.5mg', '5mg', '10mg'] },
  { nombre: 'Atenolol',           clase: 'Betabloqueador',           dosis: ['25mg', '50mg', '100mg'] },
  { nombre: 'Carvedilol',         clase: 'Betabloqueador',           dosis: ['3.125mg', '6.25mg', '12.5mg', '25mg'] },
  { nombre: 'Metoprolol',         clase: 'Betabloqueador',           dosis: ['25mg', '50mg', '100mg', '200mg'] },
  { nombre: 'Nebivolol',          clase: 'Betabloqueador',           dosis: ['2.5mg', '5mg'] },

  // Antihipertensivos centrales
  { nombre: 'Metildopa',          clase: 'Antihipertensivo central', dosis: ['250mg', '500mg'] },
  { nombre: 'Doxazosina',         clase: 'Antihipertensivo central', dosis: ['1mg', '2mg', '4mg'] },
  { nombre: 'Clonidina',          clase: 'Antihipertensivo central', dosis: ['75mcg', '150mcg', '200mcg'] },
];

export const CLASES = [...new Set(MEDICAMENTOS.map(m => m.clase))];
