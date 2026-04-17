import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugData() {
  console.log('--- Debugging Firestore Data ---');
  
  const configSnap = await getDoc(doc(db, 'configuracion', 'reglasTurnos'));
  console.log('Config rules:', JSON.stringify(configSnap.data(), null, 2));

  const empSnap = await getDocs(collection(db, 'employees'));
  const emps = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  console.log('Employees found:', emps.length);
  emps.forEach(e => console.log(`- ${e.name} (${e.role})`));

  process.exit(0);
}

debugData();
