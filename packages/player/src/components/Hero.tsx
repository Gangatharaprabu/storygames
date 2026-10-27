import type { ReactNode } from "react";
import { packUrl } from "../data/catalog.ts";

/** Full-bleed poster at the top of a story or series page, fading into the page. */
export function Hero({ cover, kicker, title, meta, children }: { cover?: string; kicker?: ReactNode; title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <header className="hero">
      {cover && <img className="hero-art" src={packUrl(cover)} alt="" />}
      <div className="hero-body">
        {kicker && <p className="hero-kicker">{kicker}</p>}
        <h1>{title}</h1>
        {meta && <p className="hero-meta">{meta}</p>}
        {children}
      </div>
    </header>
  );
}
