import { href } from "../router.ts";

export function NotFound({ what = "This page" }: { what?: string }) {
  return (
    <section className="page empty">
      <h1 className="page-title">Not found</h1>
      <p>{what} doesn't exist, or isn't published any more.</p>
      <a className="btn" href={href.home()}>Back to stories</a>
    </section>
  );
}
