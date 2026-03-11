/* global console, process */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const cierresDir = path.resolve(process.cwd(), "docs", "cierres");
const fileNamePattern =
  /^ETAPA_(M1|[0-9]{2}|[0-9]{2}_[0-9]{2})_(CIERRE|REAPERTURA_TECNICA|EVIDENCIA_RELEASE)\.md$/;
const datePattern = /^Fecha:\s\d{4}-\d{2}-\d{2}\b/m;
const statusPattern = /^Estado:\s.+/m;
const allowedFiles = new Set([
  "ETAPA_00_01_CIERRE.md",
  "ETAPA_02_CIERRE.md",
  "ETAPA_02_REAPERTURA_TECNICA.md",
  "ETAPA_03_CIERRE.md",
  "ETAPA_04_CIERRE.md",
  "ETAPA_04_REAPERTURA_TECNICA.md",
  "ETAPA_05_CIERRE.md",
  "ETAPA_06_CIERRE.md",
  "ETAPA_07_CIERRE.md",
  "ETAPA_08_CIERRE.md",
  "ETAPA_09_CIERRE.md",
  "ETAPA_10_CIERRE.md",
  "ETAPA_11_CIERRE.md",
  "ETAPA_11_EVIDENCIA_RELEASE.md",
  "ETAPA_12_CIERRE.md",
]);

const errors = [];
const cierresById = new Map();

let files;
try {
  files = readdirSync(cierresDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
} catch (error) {
  console.error(`[docs:cierres:validate] No se pudo leer ${cierresDir}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

for (const file of files) {
  if (!allowedFiles.has(file)) {
    errors.push(
      `Documento no permitido en docs/cierres: ${file}. ` +
        "Agregar nuevos archivos requiere actualizar la politica de gobernanza y este validador.",
    );
    continue;
  }

  const match = file.match(fileNamePattern);

  if (!match) {
    errors.push(
      `Nombre invalido en docs/cierres: ${file}. Esperado: ETAPA_{ID}_{TIPO}.md`,
    );
    continue;
  }

  const [, id, type] = match;
  if (type === "CIERRE") {
    if (cierresById.has(id)) {
      errors.push(`Existe mas de un cierre canonico para la etapa ${id}.`);
    } else {
      cierresById.set(id, file);
    }
  }

  if (type !== "CIERRE") {
    continue;
  }

  const fullPath = path.join(cierresDir, file);
  const content = readFileSync(fullPath, "utf8");

  if (!datePattern.test(content)) {
    errors.push(`${file}: falta 'Fecha: YYYY-MM-DD'.`);
  }

  if (!statusPattern.test(content)) {
    errors.push(`${file}: falta linea 'Estado: ...'.`);
  }
}

for (const file of allowedFiles) {
  if (!files.includes(file)) {
    errors.push(`Falta documento canonico esperado en docs/cierres: ${file}.`);
  }
}

if (errors.length > 0) {
  console.error("[docs:cierres:validate] Fallo de nomenclatura/gobernanza:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[docs:cierres:validate] OK");
console.log(`[docs:cierres:validate] Archivos validados: ${files.length}`);
