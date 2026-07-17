// Tema de dai: DefaultTheme de VitePress + paleta argentina (custom.css) + animaciones.
// Vive en .vitepress/theme/ (raíz, fuera de "files") → no viaja en npm.
//
// Tres animaciones, todas con guarda SSR (inBrowser) y respeto por reduced-motion:
//   1. Toggle dark/light → reveal circular  (View Transitions API + Web Animations API)
//   2. Navegación entre páginas → fade del contenido  (Web Animations API — universal)
//   3. Entrada del hero en la home → fade-up escalonado  (Web Animations API)
import DefaultTheme from "vitepress/theme";
import { inBrowser, useData } from "vitepress";
import { nextTick, onMounted, provide } from "vue";
import "./custom.css";

// ¿El usuario NO pidió menos movimiento? Solo animamos si es así.
const okMotion = () =>
  inBrowser && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

// View Transitions solo donde existe (Chrome/Edge/Safari 18+). Firefox → sin animar.
const canViewTransition = () => okMotion() && "startViewTransition" in document;

const isHome = () => inBrowser && !!document.querySelector(".VPHome");

// Hero + tarjetas de la home aparecen con un fade-up escalonado.
function animateHome() {
  if (!okMotion()) return;
  requestAnimationFrame(() => {
    const els = document.querySelectorAll(
      ".VPHero .name, .VPHero .text, .VPHero .tagline, .VPHero .actions, .VPFeature",
    );
    els.forEach((el, i) =>
      el.animate(
        [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: i * 60, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" },
      ),
    );
  });
}

// Al navegar entre docs, el contenido entra con un fade corto.
function fadeContent() {
  if (!okMotion()) return;
  const el = document.querySelector(".VPContent");
  if (el) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
}

export default {
  extends: DefaultTheme,

  enhanceApp({ router }) {
    if (!inBrowser) return;
    router.onAfterRouteChanged = () => (isHome() ? animateHome() : fadeContent());
  },

  setup() {
    // Home: animar también en la carga inicial (onAfterRouteChanged no dispara ahí).
    onMounted(() => { if (isHome()) animateHome(); });

    // Reveal circular del dark/light. VitePress inyecta 'toggle-appearance' en su
    // switch de tema si se lo proveemos: acá lo reemplazamos por el efecto.
    const { isDark } = useData();
    provide("toggle-appearance", async ({ clientX, clientY }) => {
      const x = clientX || innerWidth / 2;
      const y = clientY || innerHeight / 2;
      if (!canViewTransition()) { isDark.value = !isDark.value; return; }

      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`];

      // Si la transición se aborta (toggles rápidos, estado inválido), `.ready`
      // rechaza: el tema igual cambió dentro del callback, solo no animamos el clip.
      try {
        await document.startViewTransition(async () => {
          isDark.value = !isDark.value;
          await nextTick();
        }).ready;

        document.documentElement.animate(
          { clipPath: isDark.value ? clip.reverse() : clip },
          {
            duration: 350,
            easing: "ease-in",
            pseudoElement: `::view-transition-${isDark.value ? "old" : "new"}(root)`,
          },
        );
      } catch {
        /* transición abortada: el toggle ya surtió efecto, sin reveal */
      }
    });
  },
};
