// permissions.js
// Archivo centralizado para manejo de roles y permisos en la aplicación.

// 1. Roles Definidos
export const ROLES = {
  // BBS Calidad: Pueden firmar análisis de calidad
  QUALITY_CONTROL: [
    'juanpae.mdp@gmail.com',
    'francovanuccilemmi@gmail.com',
    'g.haritchet@gmail.com',
    'miguesilva.1985@gmail.com',
    'miguesilva.1985@outlook.es',
    'bduville@h2ocontrol.com.ar',
    'tester@h2ocontrol.com',
  ],
  
  // Creadores de Órdenes (OP, OE, OD) — Gerencia únicamente
  ORDER_CREATORS: [
    'miguesilva.1985@gmail.com',
    'miguesilva.1985@outlook.es',
    'jmalvasio@h2ocontrol.com.ar',
    'tester@h2ocontrol.com',
  ],

  // Administradores Globales
  ADMINS: [
    'miguesilva.1985@outlook.es',
    'miguesilva.1985@gmail.com',
    'tester@h2ocontrol.com',
  ]
};

// 2. Funciones de Verificación
export const canAccessQualityControl = (email) => {
  if (!email) return false;
  return ROLES.QUALITY_CONTROL.includes(email.toLowerCase());
};

export const canCreateOrders = (email) => {
  if (!email) return false;
  return ROLES.ORDER_CREATORS.includes(email.toLowerCase());
};

export const isAdmin = (email) => {
  if (!email) return false;
  return ROLES.ADMINS.includes(email.toLowerCase());
};
