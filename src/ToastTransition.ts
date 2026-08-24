/*
  How `Toasts.updateToast` visually applies a patch to an already-rendered
  toast: the whole `.bt-toast` card (content + color + actions - not just the
  message) rebuilt all-at-once mid-transition, e.g. for a `promise()`
  loading->success/error swap. Mirrors `ToastAnimation.ts`'s shape (a plain
  registry keyed by name, extensible via `registerToastTransition`) rather
  than inventing a second convention - `NONE`/`FADE`/`SHAKE_LR` are just the
  built-in entries.

  Unlike `ToastAnimation`'s `containerTransition`, which is set once at
  creation and lives for the toast's whole lifetime, a transition here is a
  one-shot directive: passed per `updateToast`/`promise()` call, never stored
  as persistent toast state - see `ToastOptions.transition` in `Toasts.ts`.
*/

export const ToastTransition = {
    NONE: 'none',
    FADE: 'fade',
    SHAKE_LR: 'shake-lr',
} as const;

// Widened so a custom name registered via `registerToastTransition` still
// type-checks in `ToastOptions`/`ToastBuilder.withTransition()` without a
// cast, while `none`/`fade`/`shake-lr` still autocomplete - same trick as
// `ToastAnimationValue`.
export type ToastTransitionValue = typeof ToastTransition[keyof typeof ToastTransition] | (string & {});

export interface ToastTransitionDefinition {
    /**
     * Runs the transition against `toast` (the `.bt-toast` card), calling
     * `mutate` at whatever point the new content should actually appear -
     * once, synchronously or later (e.g. after a fade-out completes).
     * `mutate` applies every visual field the update touched
     * (content/color/progress/actions) in one go, so multi-field patches
     * (e.g. message AND color changing together) read as one clean change
     * rather than pieces settling at different times.
     */
    run(toast: HTMLElement, mutate: () => void): void;
    /** Total wall-clock time (ms) the transition visually takes from start to finish - what
     *  `Toasts.getToastState()`'s `transitioning` field uses to report whether this transition
     *  is still playing, without needing a completion callback threaded back through `run`.
     *  Omit (or `0`) for a transition with no visible duration (e.g. `NONE`) - `transitioning`
     *  then never reports `true` for it. A custom transition registered via
     *  `registerToastTransition` without this set simply never shows up as `transitioning`
     *  either - there's no way to infer how long an arbitrary `run()` takes. */
    durationMs?: number;
}

// No transition at all: applies the patch instantly. Registered (rather
// than short-circuited before reaching the registry) so it behaves exactly
// like any other named transition - including being overridable via
// `registerToastTransition('none', ...)` if a consumer really wants that.
const noneDefinition: ToastTransitionDefinition = {
    run(_toast, mutate) {
        mutate();
    },
};

// Duration (ms) of each half of the crossfade - deliberately not exposed as
// an option, same reasoning as the animation module's hardcoded timings
// (SLIDE/FADE's 300ms): one sensible default beats a knob nobody asked to
// tune.
const FADE_DURATION_MS = 150;

// Fades `toast`'s opacity to 0, runs `mutate` once fully invisible, then
// fades back to 1 - a crossfade of the whole card rather than the message
// alone, so e.g. a promise() loading->success patch (message AND color
// changing together) doesn't look mismatched.
const fadeDefinition: ToastTransitionDefinition = {
    durationMs: FADE_DURATION_MS * 2,
    run(toast, mutate) {
        const previousTransition = toast.style.transition;
        toast.style.transition = `opacity ${FADE_DURATION_MS}ms ease-in-out`;
        toast.style.opacity = '0';
        window.setTimeout(() => {
            mutate();
            void toast.offsetHeight; // force reflow so the fade-in below animates from the opacity:0 just set, not a no-op
            toast.style.opacity = '1';
            window.setTimeout(() => {
                toast.style.transition = previousTransition;
            }, FADE_DURATION_MS);
        }, FADE_DURATION_MS);
    },
};

// Left-right shake to draw attention to an update, rather than hiding it -
// `mutate` runs immediately (there's nothing to hide first) and the shake
// plays over the new content. Offsets end back at 0 so the card is never
// left visually displaced.
const SHAKE_STEP_MS = 60;
const SHAKE_OFFSETS_PX = [-8, 8, -6, 6, -3, 3, 0];

const shakeLrDefinition: ToastTransitionDefinition = {
    durationMs: SHAKE_OFFSETS_PX.length * SHAKE_STEP_MS,
    run(toast, mutate) {
        mutate();
        const previousTransition = toast.style.transition;
        toast.style.transition = `transform ${SHAKE_STEP_MS}ms ease-in-out`;
        let i = 0;
        const step = () => {
            toast.style.transform = `translateX(${SHAKE_OFFSETS_PX[i]}px)`;
            i++;
            if (i < SHAKE_OFFSETS_PX.length) {
                window.setTimeout(step, SHAKE_STEP_MS);
            } else {
                window.setTimeout(() => {
                    toast.style.transition = previousTransition;
                    toast.style.transform = '';
                }, SHAKE_STEP_MS);
            }
        };
        step();
    },
};

const registry = new Map<string, ToastTransitionDefinition>([
    [ToastTransition.NONE, noneDefinition],
    [ToastTransition.FADE, fadeDefinition],
    [ToastTransition.SHAKE_LR, shakeLrDefinition],
]);

/**
 * Registers a custom named transition, usable anywhere `transition` is
 * accepted (`ToastOptions`/`updateToast`, `ToastBuilder.withTransition()`,
 * `promise()`) by passing its `name`. Overwriting a built-in name (e.g.
 * `'fade'`) is allowed, and replaces its behavior for every update that
 * requests it afterwards.
 */
export function registerToastTransition(name: string, definition: ToastTransitionDefinition): void {
    registry.set(name, definition);
}

/** Looks up a registered transition by name - `undefined` if nothing is registered under it. */
export function getToastTransition(name: string): ToastTransitionDefinition | undefined {
    return registry.get(name);
}
