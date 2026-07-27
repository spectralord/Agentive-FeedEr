import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DetailHeaderSkeleton,
  FeedCardSkeleton,
  FormFieldSkeleton,
  GridSkeleton,
  ListSkeleton,
} from "./skeletons";

// T18.8 (§10.2): the shared skeleton primitives used by every route's
// loading.tsx. These are pure presentation with no data dependency, so the
// tests just prove each shape renders and never reaches for a reserved
// ADR 0016 color (--gold/--caution) that would misrepresent a loading state
// as a mastered/caveat signal.
describe("skeleton primitives", () => {
  it("FeedCardSkeleton renders one full-height snap section", () => {
    const html = renderToStaticMarkup(<FeedCardSkeleton />);
    expect(html).toContain("h-[calc(100dvh-var(--tabbar-h))]");
    expect(html).toContain("snap-start");
  });

  it("ListSkeleton renders exactly `rows` row outlines", () => {
    const html = renderToStaticMarkup(<ListSkeleton rows={4} />);
    expect(html.match(/<li/g)).toHaveLength(4);
  });

  it("GridSkeleton renders exactly `tiles` tile outlines", () => {
    const html = renderToStaticMarkup(<GridSkeleton tiles={5} />);
    // Each tile is one shrink-0 ring circle — count those instead of divs.
    expect(html.match(/rounded-full bg-surface-raised/g)).toHaveLength(5);
  });

  it("DetailHeaderSkeleton renders a ring circle only when withRing is set", () => {
    const withoutRing = renderToStaticMarkup(<DetailHeaderSkeleton />);
    const withRing = renderToStaticMarkup(<DetailHeaderSkeleton withRing />);
    expect(withoutRing).not.toContain("rounded-full bg-surface-raised");
    expect(withRing).toContain("rounded-full bg-surface-raised");
  });

  it("FormFieldSkeleton grows taller when tall is set", () => {
    const plain = renderToStaticMarkup(<FormFieldSkeleton />);
    const tall = renderToStaticMarkup(<FormFieldSkeleton tall />);
    expect(plain).toContain("h-9");
    expect(tall).toContain("h-24");
  });

  it("no skeleton reaches for a reserved ADR 0016 color", () => {
    const htmls = [
      renderToStaticMarkup(<FeedCardSkeleton />),
      renderToStaticMarkup(<ListSkeleton />),
      renderToStaticMarkup(<GridSkeleton />),
      renderToStaticMarkup(<DetailHeaderSkeleton withRing />),
      renderToStaticMarkup(<FormFieldSkeleton />),
    ];
    for (const html of htmls) {
      expect(html).not.toMatch(/text-gold|bg-gold|text-caution|bg-caution/);
    }
  });
});
