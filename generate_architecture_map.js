const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getFiles(SRC_DIR);
const nodes = [];
const edges = [];
const nodeMap = new Map();

let idCounter = 1;

function getFolderType(filePath) {
  if (filePath.includes('screens')) return 'screen';
  if (filePath.includes('services')) return 'service';
  if (filePath.includes('components')) return 'component';
  if (filePath.includes('config')) return 'config';
  return 'core';
}

function getColor(type) {
  switch(type) {
    case 'screen': return { background: '#3b82f6', border: '#2563eb' }; // Blue
    case 'service': return { background: '#10b981', border: '#059669' }; // Green
    case 'component': return { background: '#f59e0b', border: '#d97706' }; // Orange
    case 'config': return { background: '#8b5cf6', border: '#7c3aed' }; // Purple
    default: return { background: '#64748b', border: '#475569' }; // Slate
  }
}

// Create nodes
allFiles.forEach(file => {
  const name = path.basename(file, '.js');
  const type = getFolderType(file);
  const id = idCounter++;
  
  let level = 4;
  if (type === 'config') level = 1;
  else if (type === 'service') level = 2;
  else if (type === 'core') level = 3;
  else if (type === 'screen') level = 4;
  else if (type === 'component') level = 5;

  nodeMap.set(name, id);
  nodes.push({
    id: id,
    label: name,
    group: type,
    color: getColor(type),
    shape: 'box',
    level: level,
    font: { color: '#ffffff', size: 14 }
  });
});

// Firebase and React Nodes
const FIREBASE_ID = idCounter++;
nodes.push({ id: FIREBASE_ID, label: 'Firebase DB/Auth', shape: 'database', level: 0, color: { background: '#f97316', border: '#ea580c' }, font: { color: '#fff' }});

// Create edges by parsing imports
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const sourceName = path.basename(file, '.js');
  const sourceId = nodeMap.get(sourceName);
  
  if (content.includes('firebase/firestore') || content.includes('firebase/auth')) {
    edges.push({ from: sourceId, to: FIREBASE_ID, color: { color: '#475569', opacity: 0.5 }, arrows: 'to' });
  }

  // Find local imports
  const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const importedName = path.basename(importPath, '.js');
      const targetId = nodeMap.get(importedName);
      if (targetId) {
        edges.push({
          from: sourceId,
          to: targetId,
          color: { color: '#cbd5e1', opacity: 0.6 },
          arrows: 'to',
          smooth: { type: 'continuous' }
        });
      }
    }
  }
});

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>H2O Control - Mapa Arquitectónico</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style>
    body, html { margin: 0; padding: 0; height: 100%; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; overflow: hidden; }
    #mynetwork { width: 100%; height: 100vh; }
    #legend { position: absolute; top: 20px; left: 20px; background: rgba(30, 41, 59, 0.9); padding: 15px; border-radius: 12px; color: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
    .legend-item { display: flex; align-items: center; margin-bottom: 8px; }
    .legend-color { width: 16px; height: 16px; border-radius: 50%; margin-right: 10px; }
    h1 { margin: 0 0 15px 0; font-size: 18px; color: #f8fafc; }
  </style>
</head>
<body>
  <div id="legend">
    <h1>H2O Control App</h1>
    <div class="legend-item"><div class="legend-color" style="background: #3b82f6;"></div>Pantallas (Screens)</div>
    <div class="legend-item"><div class="legend-color" style="background: #10b981;"></div>Servicios / Funciones</div>
    <div class="legend-item"><div class="legend-color" style="background: #f59e0b;"></div>Componentes UI</div>
    <div class="legend-item"><div class="legend-color" style="background: #8b5cf6;"></div>Configuración / Constantes</div>
    <div class="legend-item"><div class="legend-color" style="background: #f97316;"></div>Firebase</div>
  </div>
  <div id="mynetwork"></div>

  <script type="text/javascript">
    const nodes = new vis.DataSet(${JSON.stringify(nodes)});
    const edges = new vis.DataSet(${JSON.stringify(edges)});
    const container = document.getElementById('mynetwork');
    const data = { nodes: nodes, edges: edges };
    const options = {
      nodes: {
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        width: 1.5,
        shadow: true,
        smooth: {
          type: 'cubicBezier',
          forceDirection: 'none',
          roundness: 0.5
        }
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: 'UD',
          sortMethod: 'directed',
          levelSeparation: 150,
          nodeSpacing: 250,
          treeSpacing: 200
        }
      },
      physics: {
        enabled: false
      },
      interaction: {
        dragNodes: true,
        hover: true,
        zoomView: true,
      }
    };
    new vis.Network(container, data, options);
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'mapa_arquitectura.html'), htmlContent);
console.log('Mapa generado con éxito en mapa_arquitectura.html');
