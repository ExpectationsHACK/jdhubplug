// Keyframes and classes for the offer experience (hero entrance, flip-clock digits,
// banner, toast). Rendered as a React 19 hoisted <style> (deduped by href), so any
// offer component can include <OfferStyles /> without touching app/globals.css.
// Every animation is switched off under prefers-reduced-motion.

const css = `
@keyframes jdo-hero-in {
  0% { opacity: 0; transform: perspective(900px) translateY(60px) scale(.55) rotate(-16deg) rotateY(35deg); filter: blur(14px) brightness(1.8); }
  55% { opacity: 1; transform: perspective(900px) translateY(-10px) scale(1.06) rotate(3deg) rotateY(-6deg); filter: blur(0) brightness(1.15); }
  75% { transform: perspective(900px) translateY(4px) scale(.98) rotate(-1deg) rotateY(2deg); filter: brightness(1); }
  100% { opacity: 1; transform: none; filter: none; }
}
@keyframes jdo-float {
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-14px) rotate(-1.2deg); }
}
@keyframes jdo-glow {
  0%, 100% { opacity: .55; transform: scale(.92); }
  50% { opacity: 1; transform: scale(1.08); }
}
@keyframes jdo-spin { to { transform: rotate(360deg); } }
@keyframes jdo-ring {
  0% { opacity: .8; transform: scale(.6); }
  100% { opacity: 0; transform: scale(1.5); }
}
@keyframes jdo-rise {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: none; }
}
@keyframes jdo-shine {
  0%, 60% { transform: translateX(-120%) skewX(-20deg); }
  100% { transform: translateX(220%) skewX(-20deg); }
}
@keyframes jdo-pop {
  0% { opacity: 0; transform: scale(.4) rotate(-12deg); }
  60% { opacity: 1; transform: scale(1.12) rotate(4deg); }
  100% { opacity: 1; transform: scale(1) rotate(-4deg); }
}
@keyframes jdo-flip-top {
  0% { transform: rotateX(0); }
  100% { transform: rotateX(-90deg); }
}
@keyframes jdo-flip-bottom {
  0% { transform: rotateX(90deg); }
  100% { transform: rotateX(0); }
}
@keyframes jdo-banner-in {
  from { opacity: 0; transform: translateY(-100%); }
  to { opacity: 1; transform: none; }
}
@keyframes jdo-toast-in {
  0% { opacity: 0; transform: translateY(24px) scale(.96); }
  100% { opacity: 1; transform: none; }
}
@keyframes jdo-sparkle {
  0%, 100% { opacity: 0; transform: scale(.2) rotate(0); }
  50% { opacity: 1; transform: scale(1) rotate(90deg); }
}
@keyframes jdo-marquee { to { transform: translateX(-50%); } }

.jdo-hero-in { animation: jdo-hero-in 1.4s cubic-bezier(.2,.9,.25,1) both; }
.jdo-float { animation: jdo-float 6s ease-in-out 1.4s infinite; }
.jdo-glow { animation: jdo-glow 4s ease-in-out infinite; }
.jdo-spin { animation: jdo-spin 14s linear infinite; }
.jdo-ring { animation: jdo-ring 3.2s cubic-bezier(.2,.7,.3,1) infinite; }
.jdo-rise { animation: jdo-rise .8s cubic-bezier(.2,.8,.2,1) both; }
.jdo-pop { animation: jdo-pop .9s cubic-bezier(.3,1.5,.5,1) .5s both; }
.jdo-sparkle { animation: jdo-sparkle 2.4s ease-in-out infinite; }
.jdo-banner-in { animation: jdo-banner-in .5s cubic-bezier(.2,.8,.2,1) both; }
.jdo-toast-in { animation: jdo-toast-in .45s cubic-bezier(.2,.9,.3,1.2) both; }
.jdo-marquee { animation: jdo-marquee 30s linear infinite; }
.jdo-shine { position: relative; overflow: hidden; isolation: isolate; }
.jdo-shine::after {
  content: ""; position: absolute; inset: 0; z-index: -1; width: 45%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  animation: jdo-shine 3.2s ease-in-out 1.2s infinite;
}

/* Flip-clock digit: a static top/bottom half plus two animated flaps. */
.jdo-digit { position: relative; display: inline-block; width: 1em; height: 1.4em; perspective: 300px; }
.jdo-half { position: absolute; left: 0; right: 0; height: 50%; overflow: hidden; background: #fff; color: #000; }
.jdo-half > span { position: absolute; left: 0; right: 0; height: 200%; display: grid; place-items: center; }
.jdo-top { top: 0; border-radius: .14em .14em 0 0; transform-origin: bottom; }
.jdo-top > span { top: 0; }
.jdo-bottom { bottom: 0; border-radius: 0 0 .14em .14em; transform-origin: top; background: #f4f4f4; }
.jdo-bottom > span { bottom: 0; }
.jdo-flap-top { animation: jdo-flip-top .3s ease-in both; z-index: 2; backface-visibility: hidden; }
.jdo-flap-bottom { animation: jdo-flip-bottom .3s ease-out .3s both; z-index: 2; backface-visibility: hidden; }
.jdo-digit::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,.18); z-index: 3; }

.jdo-tilt { transition: transform .25s ease-out; transform-style: preserve-3d; will-change: transform; }

@media (prefers-reduced-motion: reduce) {
  .jdo-hero-in, .jdo-float, .jdo-glow, .jdo-spin, .jdo-ring, .jdo-rise, .jdo-pop, .jdo-sparkle,
  .jdo-banner-in, .jdo-toast-in, .jdo-marquee, .jdo-flap-top, .jdo-flap-bottom, .jdo-shine::after {
    animation: none !important;
  }
  .jdo-flap-top, .jdo-flap-bottom { display: none; }
  .jdo-tilt { transition: none; transform: none !important; }
}
`;

export function OfferStyles() {
  return (
    <style href="jd-offer-styles" precedence="default">
      {css}
    </style>
  );
}
