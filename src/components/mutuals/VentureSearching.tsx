import logoMark from "@/assets/logo-mark.svg";

/**
 * The branded transition into Ventures.
 *
 * A generic spinner says "software is busy". This says "we are looking", which
 * is the actual thing happening and the thing the app is for. It reuses the
 * MEUTUALS eye as the emitter, so the loading state is a brand moment rather
 * than a gap in one — the screens people wait on are the screens they remember.
 *
 * Its orbit and expanding rings follow the rhythm of the loading reference
 * chosen for this screen, while the focal shape is the MEUTUALS eye. Pure CSS
 * keeps the state local, fast and available offline without adding an
 * animation runtime.
 */
export function VentureSearching({
  label = "Getting Ventures ready…",
  detail = "Gathering fresh plans and your latest updates.",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div
      className="flex min-h-[58svh] flex-col items-center justify-center pb-16 pt-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="venture-loader relative flex h-52 w-52 items-center justify-center"
        aria-hidden
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="venture-loader-ring absolute h-20 w-20 rounded-full"
            style={{ animationDelay: `${index * 0.36}s` }}
          />
        ))}

        <span className="venture-loader-orbit absolute inset-0">
          {[0, 120, 240].map((angle, index) => (
            <span
              key={angle}
              className="venture-loader-arm absolute left-1/2 top-1/2 h-px w-[4.4rem] origin-left"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <span
                className="venture-loader-trail absolute inset-y-0 left-0 w-full origin-left rounded-full"
                style={{ animationDelay: `${index * -0.42}s` }}
              />
              <span className="venture-loader-node absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full" />
            </span>
          ))}
        </span>

        <span className="venture-loader-core relative flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full">
          <img src={logoMark} alt="" className="h-16 w-16 object-contain" />
        </span>
      </div>

      <p className="font-display text-lg font-bold text-foreground">{label}</p>
      <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
