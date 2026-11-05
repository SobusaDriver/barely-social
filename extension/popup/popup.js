const api = typeof browser !== "undefined" ? browser : chrome;

function send(msg) {
  return api.runtime.sendMessage(msg);
}

async function init() {
  const cards = document.getElementById("cards");
  cards.innerHTML = "";
  for (const { id, dms } of globalThis.BS_SITES) {
    const res = await send({ type: "get-state", site: id });
    const site = res.sites[id];
    const a = res.allowance;

    const card = document.createElement("div");
    card.className = "card";

    const r1 = document.createElement("div");
    r1.className = "row1";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = id;
    const master = document.createElement("input");
    master.type = "checkbox";
    master.checked = site.on;
    master.title = "Activar/desactivar";
    master.addEventListener("change", () => send({ type: "set-site", site: id, patch: { on: master.checked } }));
    r1.append(name, master);

    card.append(r1);

    if (dms) {
      const d = document.createElement("label");
      d.className = "dms";
      const dm = document.createElement("input");
      dm.type = "checkbox";
      dm.checked = site.onlyDMs;
      dm.addEventListener("change", () => send({ type: "set-site", site: id, patch: { onlyDMs: dm.checked } }));
      d.append(dm, document.createTextNode("Solo DMs"));
      card.append(d);
    }

    const r2 = document.createElement("div");
    r2.className = "row2";
    r2.append(document.createTextNode("Límite"));
    const num = document.createElement("input");
    num.type = "number";
    num.min = "0";
    num.value = a.limit;
    num.addEventListener("change", () => send({ type: "set-limit", site: id, limit: Math.max(0, Number(num.value) || 0) }));
    const used = document.createElement("span");
    used.className = "used";
    used.textContent = a.limit > 0 ? `usados ${a.used}/${a.limit}` : "sin límite";
    if (a.limit > 0 && a.used >= a.limit) used.textContent += " (bloqueado)";
    r2.append(num, used);
    card.append(r2);

    cards.append(card);
  }
}

init().catch((e) => {
  const cards = document.getElementById("cards");
  cards.textContent = "Error: " + e.message;
});
