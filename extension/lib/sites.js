// BarelySocial — registro único de sitios.
// Lo consumen los content scripts (lib/core.js), background.js y popup.js;
// añadir una web = una fila aquí + sites/<id>.js + rules/<id>.css.
// dms = la web tiene superficie de mensajes donde aterrizar (toggle "Solo DMs").
globalThis.BS_SITES = [
  { id: "instagram", dms: true },
  { id: "youtube", dms: false },
  { id: "reddit", dms: false },
  { id: "linkedin", dms: false },
  { id: "tiktok", dms: true },
];
