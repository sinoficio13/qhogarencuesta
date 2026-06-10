/**
 * Landing page — static selector.
 * Ports the hero section + tab header from the mockup.
 * Links to separate per-survey routes: /compradores and /agentes.
 *
 * T-045: app/page.tsx — static selector, two cards linking to survey slugs.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'QHogar · Elegí tu encuesta',
}

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <svg className="mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11.5 12 3l9 8.5" stroke="#0E7C66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10v10h14V10" stroke="#0F2A2C" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="12" cy="14" r="2.4" fill="#EE6C4D" />
            </svg>
            <span>Q<b>Hogar</b></span>
          </div>
          <span className="tag">Validación de producto · 2026</span>
        </div>
      </header>

      <section className="hero">
        {/* Isochrone decorative SVG */}
        <svg className="iso" viewBox="0 0 520 520" aria-hidden="true">
          <g className="hexgroup">
            <polygon className="hex" points="260,150 300,173 300,219 260,242 220,219 220,173" />
            <polygon className="hex" points="340,150 380,173 380,219 340,242 300,219 300,173" />
            <polygon className="hex" points="180,150 220,173 220,219 180,242 140,219 140,173" />
            <polygon className="hex" points="300,219 340,242 340,288 300,311 260,288 260,242" />
            <polygon className="hex" points="220,219 260,242 260,288 220,311 180,288 180,242" />
            <polygon className="hex" points="260,288 300,311 300,357 260,380 220,357 220,311" />
          </g>
          <circle className="ring" cx="260" cy="265" r="160" />
          <circle className="ring dash" cx="260" cy="265" r="118" />
          <circle className="ring" cx="260" cy="265" r="76" />
          <circle className="pulse" cx="260" cy="265" r="54" fill="#EE6C4D" opacity=".3" />
          <path className="pin" d="M260 238c-13 0-23 10-23 23 0 17 23 38 23 38s23-21 23-38c0-13-10-23-23-23z" />
          <circle cx="260" cy="261" r="7.5" fill="#0F2A2C" />
        </svg>

        <div className="hero-inner">
          <p className="eyebrow">Investigación de usuarios</p>
          <h1>Cómo busca la gente <em>su próxima casa</em>.</h1>
          <p className="lead">
            Dos encuestas cortas para validar lo que diferencia a QHogar: búsqueda por
            proximidad, filtros por amenidades y el asistente por WhatsApp.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="n">2</span><span className="l">públicos</span></div>
            <div className="stat"><span className="n"><span>5</span>+1</span><span className="l">preguntas · compradores</span></div>
            <div className="stat"><span className="n">~2<span> min</span></span><span className="l">tiempo de respuesta</span></div>
            <div className="stat"><span className="n">9</span><span className="l">preguntas · agentes</span></div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="tabs" role="tablist" aria-label="Encuestas">
          <Link href="/buyers" className="tab" role="tab" aria-selected="false">
            <span className="num">01 — público final</span>
            <span className="ttl">Compradores</span>
            <span className="sub">Quien ya compró vivienda en el último año</span>
          </Link>
          <Link href="/agents" className="tab" role="tab" aria-selected="false">
            <span className="num">02 — primero en responder</span>
            <span className="ttl">Agentes inmobiliarios</span>
            <span className="sub">Agencias, franquicias y agentes autónomos</span>
          </Link>
        </div>
      </div>

      {/* TODO-confirm: wording pending client approval */}
      <footer className="site">
        QHogar · Encuesta de validación de producto — de parte de{' '}
        <strong>Angel Pinto</strong>. Los datos son recogidos por QHogar para
        investigación de mercado interna.
      </footer>
    </>
  )
}
