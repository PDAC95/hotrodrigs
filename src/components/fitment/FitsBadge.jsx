/**
 * Compatibility badge for product cards / PDP (SRCH-03).
 *
 * Presentational only — no data access. The caller decides `kind` from the
 * fitment match (the active truck on the URL vs. the product's compat rows or
 * fits_all flag), so this component stays render-deterministic on the server.
 *
 *   kind="fits"      -> green "Le queda"  (matches the active truck)
 *   kind="universal" -> blue  "Universal" (fits_all)
 *   kind=null/other  -> renders nothing
 */
const FitsBadge = ({ kind = null }) => {
  if (kind === "fits") {
    return (
      <span className='position-absolute top-0 start-0 m-12 z-1 bg-success-600 text-white text-sm fw-medium py-4 px-12 rounded-pill flex-align gap-4'>
        <i className='ph ph-check-circle' />
        Le queda
      </span>
    );
  }
  if (kind === "universal") {
    return (
      <span className='position-absolute top-0 start-0 m-12 z-1 bg-info-600 text-white text-sm fw-medium py-4 px-12 rounded-pill flex-align gap-4'>
        <i className='ph ph-globe' />
        Universal
      </span>
    );
  }
  return null;
};

export default FitsBadge;
