// permissions.js
// Archivo centralizado para manejo de roles y permisos en la aplicación.

// 1. Lista de todos los usuarios autorizados
const ALL_AUTHORIZED = [
  'miguesilva.1985@outlook.es',
  'miguesilva.1985@gmail.com',
  'produccion@h2ocontrol.com.ar',
  'francovanucci1995@gmail.com',
  'francovanuccilemmi@gmail.com',
  'eugeniofangareggi@gmail.com',
  'ivancamuzzimdp@gmail.com',
  'g.haritchet@gmail.com',
  'bduville@h2ocontrol.com.ar',
  'jmalvasio@h2ocontrol.com.ar',
  'nachoracing.02@gmail.com',
  'acostaeduardoa@outlook.com',
  'juanpae.mdp@gmail.com',
  'eig.seguridadysalud@gmail.com',
  'tester@h2ocontrol.com',
];

// 2. Roles Definidos
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
  
  // Creadores de Órdenes (OP, OE, OD) — todos los autorizados por ahora
  ORDER_CREATORS: ALL_AUTHORIZED,

  // Administradores Globales
  ADMINS: [
    'miguesilva.1985@outlook.es',
    'miguesilva.1985@gmail.com',
    'francovanuccilemmi@gmail.com',
    'tester@h2ocontrol.com',
  ]
};

// 3. Funciones de Verificación
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

// Para compatibilidad con PackagingOrderScreen
export const canChangeStatus = (email) => {
  if (!email) return false;
  return ALL_AUTHORIZED.includes(email.toLowerCase());
};
