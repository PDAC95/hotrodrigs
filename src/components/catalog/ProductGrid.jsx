import ProductCard from "@/components/catalog/ProductCard";

/**
 * Responsive grid of parent cards (server component). Bootstrap row/col:
 * 1 col on xs, 2 on sm, 3 on lg — replacing ShopSection's static grid.
 *
 * `truckActive` forwards to each card so it can show the Fits/Universal badge
 * (03-05). The empty state honors CONTEXT: when a truck is active, a missing
 * result set is a "no parts for your truck" situation — the page passes a
 * richer `emptyState` node for that case; otherwise we show the generic copy.
 */
const ProductGrid = ({ products = [], truckActive = false, emptyState = null }) => {
  if (!products.length) {
    return (
      emptyState ?? (
        <div className='text-center py-80 text-gray-500'>
          No hay productos en esta categoría.
        </div>
      )
    );
  }

  return (
    <div className='row gy-4'>
      {products.map((product) => (
        <div key={product.id} className='col-lg-4 col-sm-6 col-12'>
          <ProductCard product={product} truckActive={truckActive} />
        </div>
      ))}
    </div>
  );
};

export default ProductGrid;
