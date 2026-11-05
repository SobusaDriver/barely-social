# Spec: BarelySocial — Safari Web Extension

## Resumen
Extensión de Safari (macOS + iOS) que elimina las superficies adictivas de Instagram, YouTube, Reddit, LinkedIn y TikTok en su versión web, dejando solo contenido seguido, mensajería y búsqueda. Reproduce el modelo de bloqueo de SocialLite sin backends, sin login y sin monetización.

## Problema / Valor
Las redes sociales exponen feeds algorítmicos, video corto, ads y recomendados que consumen tiempo en sesiones involuntarias. BarelySocial da a un usuario individual una experiencia de red social "boring but social": lo que sigues, mensajes, y nada más.

## Usuarios y escenarios
**Actor único**: el usuario del dispositivo (dueño del proyecto). Un nivel de privilegio.

- **Escenario 1 (alimentación de feed)**: el usuario abre instagram.com → el feed que se muestra es Siguiendo; no existen Reels, Explore ni sugeridos como superficies. Análogo en TikTok (Siguiendo), YouTube (home = suscripciones), Reddit (solo comunidades unidas).
- **Escenario 2 (superficie bloqueada)**: el usuario toca una tab bloqueada (p. ej. Reels en IG) → se muestra un overlay "BarelySocial: bloqueado" con instrucción de no navegar a esa surface, en lugar del contenido.
- **Escenario 3 (allowance)**: contador local de movidas (ej. reels vistos el día) se decrementa via toggle off en el popup; al valor 0, la superficie bloqueada (no queda user-visible).
- **Escenario 4 (control)**: usuario abre popup por sitio, enciende/apaga el transform de cada plataforma.
- **Escenario 5 (ads en red)**: requests a dominios de ads/tracking de las plataformas no producen descargas ni render.

## Requisitos funcionales
1. **F1 Alimentación de feed solo-seguidos**: instagram.com, tiktok.com, youtube.com, reddit.com abren en la vista de contenido seguido; el feed de descubrimiento (For You/Reels/Shorts/Popular/recomendados) no es alcanzable por navegación ni por scroll. LinkedIn: feed home ausente por completo; LinkedIn sin feed.
2. **F2 Superficies bloqueadas con overlay**: toda superficie core (Reels, Shorts, For You, Explore, Discover, Spotlight, Watch, Popular, News, lives, shopping) se reemplaza por un overlay inline que informa "Bloqueado por BarelySocial" y sugiere volver.
3. **F3 Ads "todas las maneras"**: ocultación de DOM (CSS) y bloqueo de red declarativo de dominios de ads/tracking de las 5 plataformas (googleads/googlevideo ads de YouTube incluidos); cualquiera con éxito cero puedes fallar open — si el selector no matchea, no rompe el sitio.
4. **F4 Solo DMs opcional**: toggle por sitio que sustituye redirect: tiktok.com → /messages, linkedin.com → home sin feed, instagram.com → /direct/ (op = apertura de feed).
5. **F5 Allowance diario**: contador de klik superblade slots por sitio con opción de límite configurable; límite 0 = toggle sin efecto.
6. **F6 Control por sitio**: popup de toolbar con switch por sitio (on/off) y allowance visible.
7. **F7 Higiene**: redirect de URLs de superficie bloqueada → bofeto de la red seguido (ha de reescribir la URL en v1, no history en serviron).
8. **F8 Guardrail de registro**: historial local, sin red, de cuantos slots guardo que se incrementa con el contador; no se envía.

## Requisitos no funcionales
- **N1 Sin permisos invasivos**: solo host_permissions de los 5 dominios, storage, declarativeNetRequest.
- **N2 Sin red propia**: extension hace 0 requests fuera de los sitios servidos por el usuario (los sitios load normalmente; las reglas la filtran).
- **N3 Liviana**: vanilla JS, sin frameworks, empaquetado < 500 KB.
- **N4 CSS-first, fail-open**: cada sitio con su CSS y selectores independientes; la rotura de uno no afecta a otros; selector fail-open.
- **N5 Diferida-duración**: payload injectado en document_start para superficies core, con MutationObserver para contenido dinámico.
- **N6 Privacidad**: todo en storage local; sin sincronización; desinstalación = borrado.
- **N7 Mantenibilidad**: reglas y selectores por sitio en archivos con fecha de última verificación.

## Criterios de éxito
- En sesión de navegación normal de 10 min por sitio: 0 ads visibles, 0 elementos ad load en red (auditable), 0 superficie descubrible.
- El feed home de IG/YT/Reddit/TikTok muestra solo contenido de seguidos/propius (verificación visual) y LinkedIn sin feed home.
- Extension empaqueta y se ejecuta en Safari con éxito mediante Xcode build.
- Permitir usuario apagar por sitio en 2 clics.

## Fuera de scope
- Apps nativas, contenedores web propios, webviews custom, Post Mode, Sleep Mode nativo (Tiempo en pantalla del SO lo cubre), Facebook/X/Snapchat, telemetría, parentales, monetización.

## Supuestos
- Usuario usa Safari en los 5 sitios (no apps nativas).
- MV3 de Safari (soporta declarativeNetRequest + background event page, no service worker).
- Las plataformas cambian HTML → las reglas duran while; plan de mantenimiento manual.
