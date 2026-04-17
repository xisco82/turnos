import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, addDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const Role = {
  Jefe: 'Jefe',
  Subjefe: '2ª Jefa',
  Recepcionista: 'Recepcionista',
  Ayudante: 'Ayudante',
  Conserje: 'Conserje'
};

const employees = [
  { name: 'Xisco', role: Role.Jefe, postNightBehaviour: 'Off', isNightRotationMember: false, isWeekendRotationMember: true, fixedWeekendOff: true },
  { name: 'ALIZ', role: Role.Subjefe, postNightBehaviour: 'Off', isNightRotationMember: false, isWeekendRotationMember: true, fixedWeekendOff: true },
  { name: 'JAVI', role: Role.Recepcionista, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'TONI', role: Role.Recepcionista, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'CARLOS', role: Role.Recepcionista, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'JOSEP', role: Role.Recepcionista, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'MIRIAM', role: Role.Recepcionista, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'INES', role: Role.Ayudante, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'JAKELINE', role: Role.Ayudante, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'LORENA', role: Role.Ayudante, postNightBehaviour: 'Off', isNightRotationMember: true, isWeekendRotationMember: true, fixedWeekendOff: false },
  { name: 'Oscar', role: Role.Conserje, postNightBehaviour: 'Off', isNightRotationMember: false, isWeekendRotationMember: false, fixedWeekendOff: false },
];

async function seed() {
  console.log('--- Iniciando carga de empleados (Web SDK) ---');
  
  try {
    const collectionRef = collection(db, 'employees');
    
    // Limpiar existentes
    const snapshot = await getDocs(collectionRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log('Personal anterior eliminado.');

    for (const emp of employees) {
      await addDoc(collectionRef, emp);
      console.log(`Añadido: ${emp.name} (${emp.role})`);
    }
    console.log('--- Carga completada con éxito ---');
  } catch (error) {
    console.error('Error durante la carga:', error);
    console.log('\nIMPORTANTE: Asegúrate de que las Reglas de Seguridad de Firestore permitan escritura temporalmente.');
    console.log('Ejemplo de regla abierta para pruebas:');
    console.log('match /{document=**} { allow read, write: if true; }');
  }
  process.exit(0);
}

seed();
