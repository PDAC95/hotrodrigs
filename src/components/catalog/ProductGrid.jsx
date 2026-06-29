import ProductCard from "@/components/catalog/ProductCard";

/**
 * Responsive grid of parent cards (server component). Bootstrap row/col:
 * 1 col on xs, 2 on sm, 3 on lg — replacing ShopSection's static grid.
 * Empty state in Spanish per project copy conventions.
 */
const ProductGrid = ({ products = [] }) => {
  if (!products.length) {
    return (
      <div className='text-center py-80 text-gray-500'>
        No hay productos en esta categoría.
      </div>
    );
  }

  return (
    <div className='row gy-4'>
      {products.map((product) => (
        <div key={product.id} className='col-lg-4 col-sm-6 col-12'>
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
};

export default ProductGrid;
