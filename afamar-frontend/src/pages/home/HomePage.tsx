import { useEffect, useState } from "react";
import styles from "./Home.module.css";
import { Container } from "@/components/ui/Container";
import { Modal } from "@/components/ui/Modal";
import http from "@/api/http";
import type { ProductPhoto } from "@/types/product";

import slider1 from "@/assets/slider/1.jpg";
import slider2 from "@/assets/slider/2.jpg";
import slider3 from "@/assets/slider/3.jpg";

const slides = [
  {
    title: "Transformamos tus espacios",
    subtitle: "Mesadas, cubiertas y revestimientos en granito, cuarzo y sinterizados",
    image: slider1,
  },
  {
    title: "Calidad y diseño",
    subtitle: "Más de 15 años de experiencia en el mercado de La Plata",
    image: slider2,
  },
  {
    title: "Materiales premium",
    subtitle: "Trabajamos con las mejores marcas y materiales del mercado",
    image: slider3,
  },
];

const materials = [
  {
    name: "Neolith",
    desc: "Neolith es una piedra sinterizada. Es la evolución de un porcelanato o cerámica tradicional. Su composición es 100 % natural, de la más alta calidad y pureza, unidos a un proceso de prensado y cocción de última tecnología, logran un producto con impresionantes características.",
    gradient: "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)",
  },
  {
    name: "Silestone",
    desc: "Silestone está compuesto en un 94% de Cuarzo Natural triturado, resina de poliéster, pigmentos y aditivos. Este aglomerado le proporciona una dureza y una resistencia extraordinarias que, unido a la protección antibacterias, le dotan de unas cualidades de higiene magníficas, bellos y variados colores, extraordinarias texturas, y unas altas prestaciones.",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #e94560 100%)",
  },
  {
    name: "Granito",
    desc: "El granito es una roca ígnea granular de color claro compuesta principalmente por al menos 20% de cuarzo y hasta 65% de feldespato alcalino en volumen, con cantidades menores de mica y minerales anfíboles. Se produce al solidificarse lentamente y a muy alta presión.",
    gradient: "linear-gradient(135deg, #4a4a4a 0%, #8e8e8e 100%)",
  },
  {
    name: "Mármol",
    desc: "El mármol es una roca metamórfica compacta formada a partir de rocas calizas que, sometidas a elevadas temperaturas y presiones, por largos períodos de tiempo alcanzando un alto grado de cristalización. El componente básico del mármol es el carbonato cálcico, cuyo contenido supera el 90%; los demás componentes, considerados impurezas, son los que dan gran variedad de colores en los mármoles y definen sus características físicas.",
    gradient: "linear-gradient(135deg, #d4c5a9 0%, #f5efe0 100%)",
  },
];

const fallbackPortfolio = [
  { image: "/assets/portfolio/portfolio-details-1.jpg" },
];

export function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [modalImg, setModalImg] = useState<string | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<{ image: string }[]>(fallbackPortfolio);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  useEffect(() => {
    setPortfolioLoading(true);
    http.get("/product-photos/latest?limit=12").then((res) => {
      const photos: ProductPhoto[] = res.data?.data || res.data || [];
      if (photos.length > 0) {
        setPortfolioItems(photos.map((p) => ({ image: p.file_path })));
      }
    }).catch(() => {}).finally(() => setPortfolioLoading(false));
  }, []);

  const goTo = (i: number) => {
    setActiveSlide(i);
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slides.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* ─── Navbar ─── */}
      <nav className={styles.nav}>
        <Container className={styles.nav__inner}>
        <a href="#" className={styles.nav__logo} onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          AFAMAR
        </a>
        <ul className={styles.nav__links}>
          <li><a className={styles.nav__link} onClick={() => scrollTo("hero")}>HOME</a></li>
          <li><a className={styles.nav__link} onClick={() => scrollTo("materiales")}>MATERIALES</a></li>
          <li><a className={styles.nav__link} onClick={() => scrollTo("about")}>QUIENES SOMOS</a></li>
          <li><a className={styles.nav__link} onClick={() => scrollTo("productos")}>PRODUCTOS</a></li>
          <li><a className={styles.nav__link} onClick={() => scrollTo("contact")}>CONTACTO</a></li>
        </ul>
        </Container>
      </nav>

      {/* ─── Hero Carousel ─── */}
      <section id="hero" className={styles.hero}>
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`${styles.hero__slide} ${i === activeSlide ? styles["hero__slide--active"] : ""}`}
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            <div className={styles.hero__slideContent}>
              <h1 className={styles.hero__slideTitle}>{slide.title}</h1>
              <p className={styles.hero__slideSubtitle}>{slide.subtitle}</p>
            </div>
          </div>
        ))}
        <div className={styles.hero__dots}>
          {slides.map((_, i) => (
            <button
              key={i}
              className={`${styles.hero__dot} ${i === activeSlide ? styles["hero__dot--active"] : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button className={styles.hero__arrow + " " + styles["hero__arrow--left"]} onClick={prevSlide} aria-label="Anterior">
          ‹
        </button>
        <button className={styles.hero__arrow + " " + styles["hero__arrow--right"]} onClick={nextSlide} aria-label="Siguiente">
          ›
        </button>
      </section>

      {/* ─── Materiales ─── */}
      <section id="materiales" className={`${styles.section} ${styles.materials}`}>
        <Container>
        <h2 className={styles.section__title}>Materiales que utilizamos</h2>
        <p className={styles.section__subtitle}>Trabajamos con marcas registradas Neolith y Silestone. Original. Y toda la gama de granitos y mármoles nacionales e importados.</p>
        <div className={styles.materials__grid}>
          {materials.map((m, i) => (
            <div key={i} className={styles.material__card}>
              <div className={styles.material__header} style={{ background: m.gradient }}>
                <h3 className={styles.material__name}>{m.name}</h3>
              </div>
              <div className={styles.material__body}>
                <p className={styles.material__desc}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.materials__extra}>
          <div className={styles.materials__extraBlock}>
            <h3 className={styles.materials__extraTitle}>Trabajos</h3>
            <p>Mesadas, hogares, revestimiento de frentes, marmetas para pisos, diseños especiales.</p>
            <p><strong>Rapidez en la confección</strong></p>
            <p><strong>Medición:</strong> Nuestro personal se encarga de medir y asesorar en la obra, viendo si todo lo que se quería hacer, se puede hacer y como realizarlo.</p>
            <p><strong>Medidas y entregas sin cargo.</strong></p>
          </div>
          <div className={styles.materials__extraBlock}>
            <h3 className={styles.materials__extraTitle}>Servicios</h3>
            <p><strong>Atención personalizada:</strong> Si quiere visitarnos puede pedir una cita y la atenderemos en nuestro showroom.</p>
            <p><strong>Asesoramiento:</strong> Cuéntanos sus ideas, nosotros te aconsejamos que nuestros mejores materiales, texturas y terminaciones.</p>
            <p><strong>Presupuesto:</strong> Una vez definidos todos los detalles le realizamos un presupuesto pormenorizado.          </p>
          </div>
        </div>
        </Container>
      </section>

      {/* ─── About ─── */}
      <section id="about" className={`${styles.section} ${styles.about}`}>
        <Container>
        <h2 className={styles.section__title}>Quiénes Somos</h2>
        <p className={styles.section__subtitle}>Conocé nuestra historia</p>
        <div className={styles.about__content}>
          <p>
            En <strong>AFAMAR</strong> somos una empresa familiar con más de 15 años de trayectoria en la ciudad de La Plata.
            Nos especializamos en la fabricación e instalación de mesadas, cubiertas y revestimientos en granito, cuarzo,
            mármol y sinterizados de alta calidad.
          </p>
          <br />
          <p>
            Trabajamos con tecnología de vanguardia y un equipo de profesionales altamente capacitados para brindar
            soluciones a medida para cada proyecto. Nuestro compromiso es la excelencia en cada detalle, desde la
            selección de materiales hasta la instalación final.
          </p>
          <br />
          <p>
            Nos enorgullece ofrecer un servicio personalizado, asesorando a nuestros clientes en cada etapa del proceso
            para garantizar resultados que superen sus expectativas.
          </p>
        </div>
        </Container>
      </section>

      {/* ─── Productos ─── */}
      <section id="productos" className={`${styles.section} ${styles.portfolio}`}>
        <Container>
        <h2 className={styles.section__title}>Nuestros Productos</h2>
        <p className={styles.section__subtitle}>Algunos de nuestros trabajos realizados</p>
        {portfolioLoading ? (
          <div className={styles.portfolio__loading}>Cargando fotos...</div>
        ) : (
        <div className={styles.portfolio__grid}>
          {portfolioItems.map((item, i) => (
            <div
              key={i}
              className={styles.portfolio__card}
              style={{ backgroundImage: `url(${item.image})` }}
              onClick={() => setModalImg(item.image)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setModalImg(item.image); }}
            >
              <div className={styles.portfolio__overlay} />
            </div>
          ))}
        </div>
        )}

        <Modal open={!!modalImg} onClose={() => setModalImg(null)} maxWidth="900px">
          <img src={modalImg ?? ""} alt="Producto" style={{ width: "100%", height: "auto", display: "block", borderRadius: "12px" }} />
        </Modal>
        </Container>
      </section>

      {/* ─── Contact ─── */}
      <section id="contact" className={`${styles.section} ${styles.contact}`}>
        <Container>
        <h2 className={styles.section__title}>Contacto</h2>
        <p className={styles.section__subtitle}>Estamos para ayudarte</p>
        <div className={styles.contact__grid}>
          <div className={styles.contact__map}>
            <iframe
              title="Ubicación AFAMAR"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3271.0538151506666!2d-57.95915052357695!3d-34.92289157369655!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95a2e8a5b3b3b3b3%3A0x3b3b3b3b3b3b3b3b!2sAv.%2072%201438%2C%20La%20Plata%2C%20Provincia%20de%20Buenos%20Aires!5e0!3m2!1ses!2sar!4v1"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className={styles.contact__info}>
            <p className={styles.contact__prompt}>Ante cualquier pregunta, no dude en consultarnos!</p>
            <div className={styles.contact__item}>
              <span className={styles.contact__icon}>📍</span>
              <span>Av. 72 1438 e/ 23 y 24, La Plata</span>
            </div>
            <div className={styles.contact__item}>
              <span className={styles.contact__icon}>📞</span>
              <span>
                <a href="tel:02214579935" className={styles.contact__link}>0221 457-9935</a>
                {" / "}
                <a href="tel:2214111348" className={styles.contact__link}>221 411 1348</a>
              </span>
            </div>
            <div className={styles.contact__item}>
              <span className={styles.contact__icon}>🕐</span>
              <span>
                Lunes a Viernes de 08:00 a 18:00 hs.<br />
                Sábado de 08:00 a 13:00 hs.
              </span>
            </div>
            <div className={styles.contact__item}>
              <span className={styles.contact__icon}>🌐</span>
              <a href="https://www.afamar.com.ar" target="_blank" rel="noopener noreferrer" className={styles.contact__link}>
                www.afamar.com.ar
              </a>
            </div>
          </div>
        </div>
        </Container>
      </section>

      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} AFAMAR. Todos los derechos reservados.
      </footer>
    </>
  );
}
