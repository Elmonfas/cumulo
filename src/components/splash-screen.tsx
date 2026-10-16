import { LOGO_CIRCLES } from "@/components/logo";

/**
 * Pantalla de entrada de ~1 s con el logo: las burbujas de la "c" aparecen una
 * tras otra y todo se desvanece. Se pinta en el HTML del servidor, así se ve
 * desde el primer fotograma, y la animación es solo CSS (no espera a React).
 * Solo sale al abrir la app: `splashInitScript` la desactiva en las recargas
 * de la misma sesión. Con movimiento reducido no se muestra.
 */
export function SplashScreen() {
  return (
    <div className="splash" aria-hidden>
      <div className="splash-content">
        <svg viewBox="0 0 64 64" className="size-20 fill-accent">
          {LOGO_CIRCLES.map(([cx, cy, r], i) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              className="splash-bubble"
              style={{ animationDelay: `${i * 40}ms`, transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
        </svg>
        <span className="splash-word">cúmulo</span>
      </div>
    </div>
  );
}

/** Marca la sesión: si ya se vio la pantalla de entrada, no se repite al recargar. */
export const splashInitScript = `(function(){try{if(sessionStorage.getItem("cumulo:splash")){document.documentElement.dataset.splash="off"}else{sessionStorage.setItem("cumulo:splash","1")}}catch(e){}})()`;
