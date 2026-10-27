/** Shown instead of the game when a phone is held sideways (see .sg-rotate in styles.css). */
export function RotateNotice() {
  return (
    <div className="sg-rotate" role="alert">
      <span className="sg-rotate-icon" aria-hidden="true">📱</span>
      <p>Turn your phone upright to play.</p>
    </div>
  );
}
