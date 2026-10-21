// Keyframes for the cart, checkout and order pages. Rendered as a hoisted, de-duplicated
// <style> (React 19 `href` + `precedence`), so any component can include <CommerceMotion />
// without touching the global stylesheet. Everything is switched off for reduced motion.

const css = `
@keyframes jdc-in-right { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
@keyframes jdc-in-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes jdc-pop { 0% { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
@keyframes jdc-shake { 0%,100% { transform: none; } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
@keyframes jdc-grow { from { transform: scaleX(0); } to { transform: scaleX(var(--p, 1)); } }
@keyframes jdc-grow-y { from { transform: scaleY(0); } to { transform: scaleY(var(--p, 1)); } }
@keyframes jdc-ping { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes jdc-shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
@keyframes jdc-fall {
  0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--dx, 0px), 105vh, 0) rotate(var(--rot, 720deg)); opacity: .9; }
}
@keyframes jdc-burst { 0% { transform: translate(-50%, -50%) scale(.2); opacity: .9; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
@keyframes jdc-spark {
  0% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scaleY(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(calc(var(--r) * -1)) scaleY(.3); opacity: 0; }
}
@keyframes jdc-draw { from { stroke-dashoffset: var(--len, 60); } to { stroke-dashoffset: 0; } }
@keyframes jdc-leave {
  0% { opacity: 1; transform: none; }
  40% { opacity: 0; transform: translateX(60px) scale(.96); }
  100% { opacity: 0; transform: translateX(60px) scale(.96); }
}

.jdc-in-right { animation: jdc-in-right .5s cubic-bezier(.2,.8,.2,1) both; }
.jdc-in-up { animation: jdc-in-up .55s cubic-bezier(.2,.8,.2,1) both; }
.jdc-pop { animation: jdc-pop .5s cubic-bezier(.3,1.6,.5,1) both; }
.jdc-shake { animation: jdc-shake .45s ease both; }
.jdc-grow { transform-origin: left center; animation: jdc-grow 1.2s cubic-bezier(.2,.8,.2,1) .2s both; }
.jdc-grow-y { transform-origin: center top; animation: jdc-grow-y 1.2s cubic-bezier(.2,.8,.2,1) .2s both; }
.jdc-ping { animation: jdc-ping 1.6s cubic-bezier(0,0,.2,1) infinite; }
.jdc-skeleton {
  background: linear-gradient(90deg, #eeeeee 25%, #f7f7f7 37%, #eeeeee 63%);
  background-size: 400% 100%;
  animation: jdc-shimmer 1.4s ease infinite;
}
.jdc-collapse { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .35s cubic-bezier(.2,.8,.2,1) .12s; }
.jdc-collapse > * { min-height: 0; overflow: hidden; }
.jdc-collapse[data-leaving="true"] { grid-template-rows: 0fr; }
.jdc-collapse[data-leaving="true"] > * { animation: jdc-leave .5s ease both; }
.jdc-check path { stroke-dasharray: var(--len, 60); animation: jdc-draw .6s cubic-bezier(.65,0,.35,1) .35s both; }
.jdc-bar { transition: width .7s cubic-bezier(.2,.8,.2,1); }

@media (prefers-reduced-motion: reduce) {
  .jdc-in-right, .jdc-in-up, .jdc-pop, .jdc-shake, .jdc-grow, .jdc-grow-y, .jdc-ping, .jdc-skeleton,
  .jdc-collapse[data-leaving="true"] > *, .jdc-check path { animation: none !important; }
  .jdc-collapse, .jdc-bar { transition: none !important; }
  .jdc-grow { transform: scaleX(var(--p, 1)); }
  .jdc-grow-y { transform: scaleY(var(--p, 1)); }
}
`;

export function CommerceMotion() {
  return (
    <style href="jd-commerce-motion" precedence="default">
      {css}
    </style>
  );
}
