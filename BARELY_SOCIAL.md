# BarelySocial

> Usa las redes sin caer en el scroll. Proyecto personal, no comercial, sin backend, sin monetización.

## Qué es

Una **extensión de Safari (iOS + macOS)** que limpia Instagram, YouTube, Reddit, LinkedIn y TikTok al estilo SocialLite: elimina lo adictivo, conserva lo social. Nada de apps nativas ni contenedores propios — Safari es el contenedor y la extensión limpia el DOM y bloquea la red.

## Filosofía única

El feed de descubrimiento no se "filtra": **no existe**.

- Reels, Shorts, For You, Explore, livestreams, shopping, ads, sugeridos → bloqueados (core, no opcional).
- DMs, perfiles que visitas a propósito, búsqueda, postear → intactos.
- El feed home siempre es **Siguiendo** (Instagram, TikTok, YouTube, Reddit); LinkedIn sin feed.

Ver requisitos completos en [REQUIREMENTS.md](REQUIREMENTS.md).

## Plataformas (orden de ataque)

1. Instagram
2. YouTube
3. Reddit
4. LinkedIn
5. TikTok

## Stack

- Safari Web Extension (Xcode template oficial de Apple)
- JS vanilla + CSS por sitio + `declarativeNetRequest` para bloqueo de red
- Sin frameworks, sin servidor, sin login, todo on-device
- Cuenta Apple Developer pagada → TestFlight para dispositivos propios/familia

## Privacidad

Cero backend. Cero analytics. Cero fetch externo. La sesión vive en el browser. Tu atención es tuya.

---

Detalles de requisitos y MVP: [REQUIREMENTS.md](REQUIREMENTS.md)
