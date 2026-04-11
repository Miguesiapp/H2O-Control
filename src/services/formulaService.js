import { db } from '../config/firebase';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, orderBy } from 'firebase/firestore';

// ============================================================================
// 1. GESTIÓN DE RECETAS MAESTRAS (La teoría)
// ============================================================================

/**
 * Guarda la plantilla base de una fórmula (Porcentajes teóricos)
 */
export const saveMasterFormula = async (userEmail, company, formulaData) => {
  try {
    const docRef = await addDoc(collection(db, "Formulas_Maestras"), {
      productName: formulaData.productName.trim().toUpperCase(),
      companyTarget: company.trim().toUpperCase(),
      phObjetivo: Number(formulaData.ph),
      densidadObjetivo: Number(formulaData.density),
      ingredients: formulaData.ingredients.map(ing => ({
        name: ing.name.trim().toUpperCase(),
        percentage: Number(ing.percentage)
      })),
      createdBy: userEmail,
      createdAt: serverTimestamp(), // PRO: Hora inalterable del servidor
      status: 'ACTIVA' // Permite "borrado lógico" a futuro sin perder el historial
    });
    return docRef.id;
  } catch (error) {
    console.error("Error crítico al guardar Fórmula Maestra:", error);
    throw error; // PRO: Lanzamos el error para que la UI muestre la alerta
  }
};

/**
 * Obtiene el catálogo de fórmulas de una empresa
 */
export const getMasterFormulas = async (company) => {
  try {
    const q = query(
      collection(db, "Formulas_Maestras"), 
      where("companyTarget", "==", company.trim().toUpperCase()),
      where("status", "==", "ACTIVA")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error al obtener Fórmulas Maestras:", error);
    throw error;
  }
};


// ============================================================================
// 2. GESTIÓN DE LOTES PRODUCIDOS (La práctica y trazabilidad)
// ============================================================================

/**
 * Obtiene el historial de producción (Lotes fabricados) para auditoría
 */
export const getProductionHistory = async (companyTarget, limitDays = 30) => {
  try {
    // Calculamos la fecha límite para no traer toda la base de datos y saturar la memoria
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - limitDays);

    const q = query(
      collection(db, "Produccion_Lotes"),
      where("companyTarget", "==", companyTarget.trim().toUpperCase()),
      where("fechaFabricacion", ">=", pastDate),
      orderBy("fechaFabricacion", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error al obtener Historial de Producción:", error);
    throw error;
  }
};


// ============================================================================
// 3. MOTOR INTELIGENTE (Cálculo Predictivo para la IA)
// ============================================================================

/**
 * PRO FEATURE: Calcula cuántos KG/Lts de cada Materia Prima necesitas 
 * para fabricar "X" litros de un producto terminado.
 */
export const calculateBatchRequirements = async (formulaId, targetLiters) => {
  try {
    const formulaDoc = await getDoc(doc(db, "Formulas_Maestras", formulaId));
    
    if (!formulaDoc.exists()) {
      throw new Error("La fórmula maestra no existe.");
    }

    const formula = formulaDoc.data();
    
    // El targetLiters es el volumen. Para saber el peso total a preparar (masa), 
    // multiplicamos los Litros por la Densidad (Masa = Volumen * Densidad)
    const targetKilos = Number(targetLiters) * formula.densidadObjetivo;

    const requirements = formula.ingredients.map(ing => {
      // Regla de 3 simple para sacar cuánto pesa cada componente en este lote
      const kilosNeeded = (ing.percentage / 100) * targetKilos;
      return {
        mpName: ing.name,
        kilosRequired: kilosNeeded.toFixed(2), // Redondeo a 2 decimales
        porcentaje: ing.percentage
      };
    });

    return {
      product: formula.productName,
      targetLiters: targetLiters,
      totalKilos: targetKilos.toFixed(2),
      requirements: requirements
    };

  } catch (error) {
    console.error("Error calculando requerimientos de lote:", error);
    throw error;
  }
};