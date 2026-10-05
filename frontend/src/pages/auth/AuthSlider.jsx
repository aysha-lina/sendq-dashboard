import { useEffect, useMemo, useState } from 'react';

// Auto-looping promo slider shown on the right side of the auth pages.
// Slides + autoplay/interval/dots come from the admin "Login Slider" settings;
// falls back to the bundled illustrations when none are configured.
const DEFAULT_SLIDES = ['/assets/login_picture1.png', '/assets/login_picture2.png'];

const AuthSlider = ({ settings = {} }) => {
  const slides = useMemo(() => {
    const configured = [1, 2, 3, 4, 5].map((n) => settings[`slide_image_${n}`]).filter(Boolean);
    return configured.length ? configured : DEFAULT_SLIDES;
  }, [settings]);

  const autoplay = (settings.slider_autoplay ?? '1') !== '0';
  const interval = Math.max(1, Number(settings.slider_interval) || 5) * 1000;
  const showDots = (settings.slider_show_dots ?? '1') !== '0';
  const activeColor = settings.d_pager_active || settings.d_slider_accent || '#d32f2f';
  const dotColor = settings.d_pager_dot || '#d1d5db';

  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [slides.length]);

  useEffect(() => {
    if (!autoplay || slides.length < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(timer);
  }, [autoplay, interval, slides.length]);

  return (
    <div className="login-slider">
      <div className="login-slider-track">
        {slides.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            className={`login-slide ${i === index ? 'active' : ''}`}
            aria-hidden={i !== index}
          />
        ))}
      </div>

      {showDots && slides.length > 1 && (
        <div className="login-slider-dots">
          {slides.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              className={i === index ? 'active' : ''}
              style={{ background: i === index ? activeColor : dotColor }}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AuthSlider;
