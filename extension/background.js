// BarelySocial MV3 background (non-persistent event page, Safari-compatible)
const SITES = ["instagram", "youtube", "reddit", "linkedin", "tiktok"];

const api = typeof browser !== "undefined" ? browser : chrome;

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function defaults() {
  const sites = {}, allowance = {};
  for (const s of SITES) {
    sites[s] = { on: true, onlyDMs: false };
    allowance[s] = { date: today(), used: 0, limit: 0 };
  }
  return { sites, allowance };
}

async function getStore() {
  const { sites, allowance } = await api.storage.local.get(["sites", "allowance"]);
  const def = defaults();
  return {
    sites: Object.assign(def.sites, sites || {}),
    allowance: Object.assign(def.allowance, allowance || {}),
  };
}

async function rollover(state) {
  const t = today();
  for (const s of SITES) {
    if (state.allowance[s].date !== t) {
      state.allowance[s] = { date: t, used: 0, limit: state.allowance[s].limit || 0 };
    }
  }
}

api.runtime.onInstalled.addListener(init);
api.runtime.onStartup.addListener(init);

async function init() {
  const { sites, allowance } = await getStore();
  await api.storage.local.set({ sites, allowance });
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const state = await getStore();
      await rollover(state);
      const site = msg && msg.site;
      if (site && !SITES.includes(site)) throw new Error("unknown site: " + site);

      switch (msg && msg.type) {
        case "get-state": {
          await api.storage.local.set({ allowance: state.allowance });
          return { sites: state.sites, allowance: state.allowance[site], today: today() };
        }
        case "consume": {
          const a = state.allowance[site];
          a.used += 1;
          await api.storage.local.set({ allowance: state.allowance });
          return { ok: true, used: a.used, limit: a.limit, blocked: a.limit > 0 && a.used >= a.limit };
        }
        case "set-site": {
          state.sites[site] = Object.assign({}, state.sites[site], msg.patch);
          await api.storage.local.set({ sites: state.sites });
          return { ok: true, sites: state.sites };
        }
        case "set-limit": {
          state.allowance[site].limit = Number(msg.limit) || 0;
          await api.storage.local.set({ allowance: state.allowance });
          return { ok: true, allowance: state.allowance[site] };
        }
        case "toggle-site": {
          state.sites[site].on = !state.sites[site].on;
          await api.storage.local.set({ sites: state.sites });
          return { ok: true, sites: state.sites };
        }
        default:
          return { ok: false, error: "unknown type" };
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  })();
  return true; // async sendResponse
});
