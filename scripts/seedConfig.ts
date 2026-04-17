import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const reglasTurnosData = {
  jefeViernesSabadoLibre: "Xisco",
  jefeDomingoLunesLibre: "Aliz",
  recepcionistas: ["Javi", "Toni", "Josep", "Carlos", "Miriam"],
  ayudantesRecepcion: ["Inés", "Lorena", "Jakeline"],
  conserjeNoche: "Oscar",
  capacidad: {
    "Lunes-Jueves": {
      manana: 3,
      tarde: 2
    },
    "Viernes-Domingo": {
      manana: 4,
      tarde: 2
    }
  },
  horariosBase: {
    manana: "08:00-16:00",
    tarde: "16:00-00:00"
  },
  horariosExtra: ["10:00-18:00", "10:30-18:30"],
  rotacionFindeLibre: {
    activo: true,
    empleadosParticipantes: ["Javi", "Toni", "Josep", "Carlos", "Miriam", "Inés", "Lorena", "Jakeline", "Oscar"],
    empleadoActual: "Ninguno",
    frecuencia: "semanal",
    diasLibres: ["Sábado", "Domingo"]
  },
  rotacionCoberturaConserje: {
    activo: true,
    conserje: "Oscar",
    diasLibresConserje: ["Lunes", "Martes"],
    empleadosCobertura: ["Javi", "Toni", "Josep", "Carlos", "Miriam"],
    empleadoActual: "Ninguno",
    frecuencia: "semanal"
  },
  restriccionesTurnos: {
    noDosAyudantesJuntosTarde: true,
    recepcionistasNocheDescanso: ["Miriam", "Toni"],
    turnoDiaSiguiente: "tarde",
    diasLibresFijos: {
      Javi: 2,
      Josep: 2,
      Carlos: 2
    }
  },
  objetivosSemanales: {
    diasTrabajo: 5,
    diasLibres: 2,
    libresConsecutivos: true
  },
  preferenciasEmpleados: [
    {
      nombre: "Inés",
      turnoPreferido: "T",
      diasAfectados: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
    }
  ],
  reglasComplejas: [
    {
      id: "lorena-v-16-20",
      empleado: "Lorena",
      dia: "Viernes",
      accion: "RESTRINGIR_HORAS",
      turno: "T",
      startTime: "16:00",
      endTime: "20:00"
    },
    {
      id: "lorena-findes",
      empleado: "Lorena",
      dia: "Fin de semana",
      accion: "SOLO",
      turno: "DISPONIBLE"
    }
  ]
};

async function seedConfig() {
  console.log('--- Iniciando configuración de reglas de turnos ---');
  try {
    const docRef = doc(db, 'configuracion', 'reglasTurnos');
    await setDoc(docRef, reglasTurnosData);
    console.log('Documento "reglasTurnos" creado con éxito en la colección "configuracion".');
    console.log('--- Configuración completada ---');
  } catch (error) {
    console.error('Error al configurar la base de datos:', error);
  }
  process.exit(0);
}

seedConfig();
