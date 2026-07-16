import { useEffect, useState } from 'react';
import slider1 from '@/assets/slider/1.jpg';
import slider2 from '@/assets/slider/2.jpg';
import slider3 from '@/assets/slider/3.jpg';
import styles from './HeroCarousel.module.css';

const s = styles as unknown as Record<string, string>;

const slides = [
  {
    title: 'Transformamos tus espacios',
    subtitle: 'Mesadas, cubiertas y revestimientos en granito, cuarzo y sinterizados',
    image: slider1,
  },
  {
    title: 'Calidad y diseño',
    subtitle: 'Más de 15 años de experiencia en el mercado de La Plata',
    image: slider2,
  },
  {
    title: 'Materiales premium',
    subtitle: 'Trabajamos con las mejores marcas y materiales del mercado',
    image: slider3,
  },
];

export function HeroCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);

  const goTo = (i: number) => setActiveSlide(i);
  const prevSlide = () => setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  const nextSlide = () => setActiveSlide((prev) => (prev + 1) % slides.length);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className={s['hero']}>
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`${s['hero__slide']} ${i === activeSlide ? s['hero__slide--active'] : ''}`}
          style={{ backgroundImage: `url(${slide.image})` }}
        >
          <div className={s['hero__slideContent']}>
            <h1 className={s['hero__slideTitle']}>{slide.title}</h1>
            <p className={s['hero__slideSubtitle']}>{slide.subtitle}</p>
          </div>
        </div>
      ))}
      <div className={s['hero__dots']}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={`${s['hero__dot']} ${i === activeSlide ? s['hero__dot--active'] : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
      <button className={`${s['hero__arrow']} ${s['hero__arrow--left']}`} onClick={prevSlide} aria-label="Anterior">
        ‹
      </button>
      <button className={`${s['hero__arrow']} ${s['hero__arrow--right']}`} onClick={nextSlide} aria-label="Siguiente">
        ›
      </button>
    </section>
  );
}
