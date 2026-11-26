// permissions.js
// Archivo centralizado para manejo de roles y permisos en la aplicación.

// 1. Lista de todos los usuarios autorizados
export const ALL_AUTHORIZED = [
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

// Helper para verificar autorización sin exclusiones
export const isUserAuthorized = (email) => {
  if (!email || typeof email !== 'string') return false;
  return ALL_AUTHORIZED.includes(email.trim().toLowerCase());
};

// 2. Roles Definidos - Todos los autorizados tienen acceso a todas las funciones
export const ROLES = {
  // BBS Calidad: Todos los usuarios autorizados
  QUALITY_CONTROL: ALL_AUTHORIZED,
  
  // Creadores de Órdenes (OP, OE, OD) — Todos los autorizados
  ORDER_CREATORS: ALL_AUTHORIZED,

  // Administradores Globales — Todos los autorizados
  ADMINS: ALL_AUTHORIZED,
};

// 3. Funciones de Verificación sin reglas excluyentes
export const canAccessQualityControl = (email) => {
  return isUserAuthorized(email);
};

export const canCreateOrders = (email) => {
  return isUserAuthorized(email);
};

export const isAdmin = (email) => {
  return isUserAuthorized(email);
};

// Para compatibilidad con PackagingOrderScreen y cambios de estado
export const canChangeStatus = (email) => {
  return isUserAuthorized(email);
};
