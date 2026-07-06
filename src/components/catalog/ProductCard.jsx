import Link from "next/link";
import FitsBadge from "@/components/fitment/FitsBadge";

// Format a parent price range from the denormalized price_min/price_max aggregates.
// Single price when both ends match; an en-dash range otherwise. Null prices -> "—".
function formatRange(min, max) {
  if (min == null && max == null) return "—";
  const fmt = (n) =>
    `$${Number(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  if (min == null) return fmt(max);
  if (max == null) return fmt(min);
  if (Number(min) === Number(max)) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

// Fitment badge rule (03-05): a product flagged fits_all is "universal" everywhere;
// otherwise, when a truck is active every listed row is a fit (search_products already
// filtered by p_truck_model), so it shows "fits". No truck active -> no badge.
function badgeKind(product, truckActive) {
  if (!product) return null;
  if (product.fits_all) return "universal";
  if (truckActive) return "fits";
  return null;
}

/**
 * Parent product card (server component). Reuses the template's design-2 card markup,
 * fed by real catalog data. Computes the Fits/Universal badge from `truckActive`
 * (03-05); an explicit `badge` node still overrides for any custom slot use.
 */
const ProductCard = ({ product, truckActive = false, badge = undefined }) => {
  if (!product) return null;
  const href = `/product/${product.slug}`;
  const resolvedBadge =
    badge !== undefined ? badge : (
      <FitsBadge kind={badgeKind(product, truckActive)} />
    );

  return (
    <div className='product-card h-100 p-16 border border-gray-100 hover-border-main-600 rounded-16 position-relative transition-2'>
      <Link
        href={href}
        className='product-card__thumb flex-center rounded-8 position-relative'
      >
        {resolvedBadge}
        <img
          src={product.cover_image_url}
          alt={product.name}
          style={{ maxWidth: "100%", maxHeight: "200px" }}
        />
      </Link>
      <div className='product-card__content mt-16'>
        <h6 className='title text-lg fw-semibold mt-12 mb-8'>
          <Link href={href} className='link text-line-2' tabIndex={0}>
            {product.name}
          </Link>
        </h6>
        <div className='product-card__price my-20'>
          <span className='text-heading text-md fw-semibold'>
            {formatRange(product.price_min, product.price_max)}
          </span>
        </div>
        <Link
          href={href}
          className='product-card__cart btn bg-gray-50 text-heading hover-bg-main-600 hover-text-white py-11 px-24 rounded-8 flex-center gap-8 fw-medium'
          tabIndex={0}
        >
          View product <i className='ph ph-arrow-right' />
        </Link>
      </div>
    </div>
  );
};

export default ProductCard;
export { formatRange };
