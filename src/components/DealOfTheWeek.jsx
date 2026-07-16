"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import "@/styles/deal-week.css";

/**
 * Deal of the Week — real product, real countdown (replaces the template's
 * DealsOne demo banner).
 *
 * Server page fetches the active deal (lib/catalog/deals.js) and passes it
 * down; without one the section renders nothing (the brand never fakes
 * urgency). Display-only highlight: the countdown targets the deal's true
 * ends_at, the CTA goes to the product PDP, prices are untouched.
 */

function timeLeft(endsAt) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    over: false,
  };
}

const priceLabel = (p) => {
  const min = Number(p.price_min);
  const max = Number(p.price_max);
  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    return (
      <>
        From <strong>${min.toFixed(2)}</strong>
      </>
    );
  }
  return Number.isFinite(min) ? <strong>${min.toFixed(2)}</strong> : null;
};

const DealOfTheWeek = ({ deal }) => {
  // Tick AFTER mount only, so SSR and first client paint agree ("—").
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!deal) return;
    const tick = () => setLeft(timeLeft(deal.endsAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deal]);

  if (!deal || left?.over) return null;

  const { product } = deal;
  const endsLabel = new Date(deal.endsAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const chips = [
    { n: left ? left.days : null, l: "Days" },
    { n: left ? left.hours : null, l: "Hours" },
    { n: left ? left.minutes : null, l: "Min" },
    { n: left ? left.seconds : null, l: "Sec" },
  ];

  return (
    <section className='deal-of-week mt-32'>
      <div className='container container-lg'>
        <div className='border border-gray-100 p-24 rounded-16'>
          <div className='section-heading mb-24'>
            <div className='flex-between flex-wrap gap-8'>
              <h5 className='mb-0'>Deal of The Week</h5>
            </div>
          </div>

          <div className='dow-box'>
            <Link
              href={`/product/${product.slug}`}
              className='dow-well'
              aria-label={product.name}
            >
              <img src={product.cover_image_url} alt={product.name} />
            </Link>

            <div className='dow-info'>
              <span className='dow-caption'>
                <span className='dow-caption__dot' aria-hidden='true' />
                {deal.headline || "This week only"}
              </span>
              <Link href={`/product/${product.slug}`} className='d-block'>
                <h3 className='dow-name'>{product.name}</h3>
              </Link>
              <div className='dow-price'>{priceLabel(product)}</div>
            </div>

            <div className='dow-right'>
              <div className='dow-count' aria-label='Deal ends in'>
                {chips.map((c) => (
                  <div key={c.l} className='dow-chip'>
                    <span className='dow-chip__n'>
                      {c.n == null ? "—" : String(c.n).padStart(2, "0")}
                    </span>
                    <span className='dow-chip__l'>{c.l}</span>
                  </div>
                ))}
              </div>
              <span className='dow-ends'>Ends {endsLabel}</span>
              <Link
                href={`/product/${product.slug}`}
                className='btn bg-main-two-600 hover-bg-main-two-700 text-white py-12 px-24 rounded-pill d-inline-flex align-items-center gap-8'
              >
                Shop this deal
                <i className='ph ph-arrow-right' />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DealOfTheWeek;
