/**
 * LoadingSpinner - simple centred loading indicator.
 * @module LoadingSpinner
 */

/**
 * Displays a centred loading spinner.
 */
export function LoadingSpinner() {
  return (
    <div className="spinner-container">
      <div className="spinner" role="status" aria-label="Loading…"></div>
    </div>
  );
}

export default LoadingSpinner;
