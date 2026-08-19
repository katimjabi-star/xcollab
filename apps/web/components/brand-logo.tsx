/** XCollab wordmark: outlined X, solid "Collab", brand bar over the b.
    Always LTR — the wordmark is a fixed lockup, not translatable text. */
export function BrandLogo() {
  return (
    <span className="logo" dir="ltr" aria-label="XCollab">
      <span className="logo-x" aria-hidden>
        X
      </span>
      Colla
      <span className="logo-b" aria-hidden>
        b<span className="logo-bar" />
      </span>
    </span>
  );
}
