import { db } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

// Guardar una nueva fórmula
export const saveFormula = async (company, formulaData) => {
  try {
    await addDoc(collection(db, "Formulas"), {
      ...formulaData,
      company: company,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error al guardar fórmula:", error);
  }
};

// Obtener fórmulas por empresa
export const getFormulas = async (company) => {
  const q = query(collection(db, "Formulas"), where("company", "==", company));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};