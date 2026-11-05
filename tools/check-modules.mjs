// Chequeo estructural del split modular (sin dependencias):
//   node tools/check-modules.mjs
// Verifica que el manifest cargue lib/sites.js + lib/core.js antes de cada
// módulo de sitio, que todos los archivos referenciados existan, y que cada
// módulo solo use helpers que core realmente expone.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "extension");
const read = (p) => readFileSync(join(ext, p), "utf8");
const fail = (msg) => { console.error("FAIL:", msg); process.exitCode = 1; };

const manifest = JSON.parse(read("manifest.json"));

for (const cs of manifest.content_scripts) {
  for (const f of [...(cs.js || []), ...(cs.css || [])]) {
    if (!existsSync(join(ext, f))) fail(`falta ${f}`);
  }
  // el entry MAIN-world (ads.js) va aparte; el resto debe cargar core por sitio
  if (!cs.js.includes("lib/core.js")) continue;
  const iSites = cs.js.indexOf("lib/sites.js");
  const iCore = cs.js.indexOf("lib/core.js");
  const iModule = cs.js.findIndex((f) => f.startsWith("sites/"));
  if (iSites !== 0 || iCore !== 1 || iModule !== 2 || cs.js.length !== 3) {
    fail(`orden de carga incorrecto: ${cs.js.join(", ")}`);
  }
}
if (manifest.background.scripts[0] !== "lib/sites.js") {
  fail("background.scripts debe empezar por lib/sites.js");
}
if (!read("popup/popup.html").includes('src="../lib/sites.js"')) {
  fail("popup.html no carga ../lib/sites.js");
}

// ejecutar el runtime real en un DOM mínimo para obtener la superficie __BS
const ctx = {
  location: { hostname: "www.youtube.com" },
  document: { documentElement: { dataset: {} } },
  console, setTimeout, Promise, Date,
};
vm.createContext(ctx);
vm.runInContext("globalThis.window = globalThis", ctx);
vm.runInContext(read("lib/sites.js"), ctx);
vm.runInContext(read("lib/core.js"), ctx);

const BS = ctx.__BS;
const required = ["site", "state", "setStore", "retry", "findTab", "allowanceFor", "consumeAllowance", "boot", "RETRY_WINDOW_MS"];
for (const k of required) if (!(k in (BS || {}))) fail(`__BS no expone "${k}"`);
if (ctx.__BS_SITE !== "youtube") fail(`__BS_SITE = ${ctx.__BS_SITE}`);

for (const f of manifest.content_scripts.flatMap((cs) => cs.js).filter((f) => f.startsWith("sites/"))) {
  const src = read(f);
  for (const [, key] of src.matchAll(/(?:\bBS|__BS)\.(\w+)/g)) {
    if (!required.includes(key)) fail(`${f} usa __BS.${key} (inexistente)`);
  }
  if (!src.includes("__BS.boot") && !src.includes("BS.boot")) fail(`${f} no arranca con __BS.boot()`);
}
console.log(process.exitCode ? "check-modules: ERRORES" : "check-modules: OK");
