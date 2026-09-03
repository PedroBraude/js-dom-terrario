# Terrario DOM

Juego educativo para aprender a manipular el DOM con JavaScript. Estilo Flexbox Froggy: 15 niveles en 4 capítulos, con historia (un terrario abandonado que el jugador reabre), una guía (Doña Vaquita) y una "familia" de bichos que se acumula.

## Estructura

- `index.html`: todo el juego (HTML, CSS y JS). Tiene que seguir siendo deployable arrastrando la carpeta a cualquier hosting estático.
- Si el JS crece demasiado, como máximo se separa en `levels.js` y `game.js` cargados con `<script>` normales.
- `test/levels.test.js`: tests con jsdom que resuelven cada nivel con su `solution`.
- `docs/`: capturas e imagen Open Graph.

## Reglas que no se negocian

- Sin frameworks, sin bundler, sin build step. Vanilla JS, HTML y CSS.
- No cambiar la historia, los nombres de los personajes ni el orden de los niveles.
- Textos en español rioplatense (voseo): "escribí", "tocá", "podés". Nunca "puedes", "vosotros", "haz clic".
- El código del jugador corre con `new Function` contra un `document` falso (`makeDocument`) que solo expone el terrario del jugador. Nunca pasarle el `document` real.
- Progreso siempre en `localStorage`. La nube (Supabase, magic link) es opcional y `CLOUD` queda vacío en el repo.
- Nada de atribución de IA en commits. Conventional commits.

## Cómo correr

- Local: abrir `index.html` o `npx serve .`
- Tests: `npm test` (los 15 niveles tienen que pasar).
