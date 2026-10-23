import './InnovationCampus.css';

// A fully static, low-overhead rendered campus illustration.
// Intentionally no pointer listeners, animation frames or hover effects.
export default function InnovationCampus() {
  return <div className="innovation-campus" aria-hidden="true">
    <div className="innovation-campus__aura" />
    <img className="innovation-campus__image" src="/ai-club-campus-realistic.webp"
      alt="" draggable="false" loading="eager" decoding="async"/>
  </div>;
}
