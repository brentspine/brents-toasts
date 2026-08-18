/*
  How a toast enters/leaves the snackbar, and how it moves later when a
  sibling toast is added/removed/resized. Each named animation is a small
  set of DOM hooks (a `ToastAnimationDefinition`) run by `Toasts.ts` at the
  right point in a toast's lifecycle - nothing here talks to `Toasts`
  directly, this module only owns the hook contract, the built-in
  definitions, and the registry consumers extend via
  `registerToastAnimation`.

  `containerTransition` is the key piece: it's applied once, inline, to the
  toast's own `.bt-toast-container` at creation, and stays there for the
  toast's whole lifetime - this is what governs the toast's own
  entrance/exit, and any later reflow triggered by *its own* resize (e.g.
  a details toggle growing it).

  Reflow caused by a SIBLING entering or exiting is different: the toast
  that's entering/exiting is what's causing that particular reflow, so its
  `containerTransition` - not each displaced toast's own - governs how the
  displaced toasts move. `Toasts.ts` passes it through to
  `ToastStacking.ts`'s `stackExistingAway`/`recalculatePositions` as
  `causingTransition`, which temporarily overrides each displaced toast's
  `transition` just long enough to commit that one move (see `applyOffset`
  in `ToastStacking.ts`), then restores it. This is what fixes a `NONE`
  toast appearing/disappearing instantly without leaving `SLIDE` siblings
  visibly still gliding out of its way.
*/

export const ToastAnimation = {
    SLIDE: 'slide',
    FADE: 'fade',
    NONE: 'none',
} as const;

// Widened so a custom name registered via `registerToastAnimation` still
// type-checks in `ToastOptions`/`ToastBuilder.withAnimation()`/`configure()`
// without a cast, while `slide`/`fade`/`none` still autocomplete. The
// `& {}` is what stops TS from collapsing the union down to plain `string`.
export type ToastAnimationValue = typeof ToastAnimation[keyof typeof ToastAnimation] | (string & {});

export interface ToastAnimationHookContext {
    /** The toast's outer positioned element (`.bt-toast-container`) - safe to read/set styles on directly. */
    container: HTMLElement;
    /** Which viewport edge this toast's position anchors to - see `POSITION_EDGE` in `ToastPosition.ts`. */
    edge: 'top' | 'bottom';
}

export interface ToastAnimationDefinition {
    /**
     * Applied once, inline, to `.bt-toast-container` at creation. Governs
     * the transition speed for `enterFrom` -> `enterTo`, this toast's own
     * exit, and any reflow caused by this toast's own resize. It's also
     * used (passed through as `causingTransition`) to govern how OTHER
     * toasts move out of the way when this toast enters or exits - see the
     * top-of-file comment and `applyOffset` in `ToastStacking.ts`.
     */
    containerTransition: string;
    /**
     * Called synchronously once the toast's resting stack offset is known,
     * right before the entrance becomes visible - set the "from" (hidden)
     * styles here.
     */
    enterFrom(ctx: ToastAnimationHookContext, targetOffsetPx: number): void;
    /**
     * Called one animation frame later - set the "to" (resting) styles
     * here. Whatever `containerTransition` is active animates between the
     * two.
     */
    enterTo(ctx: ToastAnimationHookContext, targetOffsetPx: number): void;
    /**
     * How long (ms) the entrance visual (`enterFrom` → `enterTo`) takes - drives when
     * `Toasts.ts` fires its `'visible'` lifecycle event (see `ToastEventMap.visible` in
     * `Toasts.ts`, and `docs/guide/lifecycle.md`'s "Lifecycle events" section), which is meant to
     * mean "the toast is now actually on screen", not just mounted. Optional - defaults to `0`
     * (fires on the next tick after mounting) for a custom animation that doesn't set it, so
     * omitting it is safe, just less precise than matching it to `containerTransition`'s actual
     * duration the way the built-ins below do.
     */
    enterDurationMs?: number;
    /** Called once, synchronously, when the toast starts being removed - set its exiting styles here. */
    exit(ctx: ToastAnimationHookContext): void;
    /**
     * How long (ms) the exit visual takes - the toast's DOM node is removed
     * after this delay. Should match whatever duration `containerTransition`/
     * `exit()` relies on.
     */
    exitDurationMs: number;
}

const SLIDE_TRANSITION =
    'opacity 300ms ease-in-out, bottom 0.2s ease-in-out, top 0.2s ease-in-out, transform 300ms ease-in-out';

// Today's original animation: slides in/out from its stacking edge while
// fading. `transform` is included in the shared transition string (even
// though slide/fade never set it themselves) so a custom animation that
// layers a `transform` gets a sensible default transition for free.
const slideDefinition: ToastAnimationDefinition = {
    containerTransition: SLIDE_TRANSITION,
    enterFrom(ctx) {
        ctx.container.style[ctx.edge] = '0px';
        ctx.container.style.opacity = '0';
    },
    enterTo(ctx, targetOffsetPx) {
        ctx.container.style[ctx.edge] = `${targetOffsetPx}px`;
        ctx.container.style.opacity = '1';
    },
    enterDurationMs: 300,
    exit(ctx) {
        ctx.container.style.opacity = '0';
    },
    exitDurationMs: 300,
};

// Opacity-only: starts already at its final resting offset (set once,
// immediately, so nothing slides) and only fades in/out - the "skip the
// bottom animation" path referenced in ROADMAP.md.
const fadeDefinition: ToastAnimationDefinition = {
    containerTransition: SLIDE_TRANSITION,
    enterFrom(ctx, targetOffsetPx) {
        ctx.container.style[ctx.edge] = `${targetOffsetPx}px`;
        ctx.container.style.opacity = '0';
    },
    enterTo(ctx) {
        ctx.container.style.opacity = '1';
    },
    enterDurationMs: 300,
    exit(ctx) {
        ctx.container.style.opacity = '0';
    },
    exitDurationMs: 300,
};

// No transition at all: appears/disappears/reflows instantly. Useful for
// reduced-motion preferences, tests, or a deliberately snappy stack.
const noneDefinition: ToastAnimationDefinition = {
    containerTransition: 'none',
    enterFrom(ctx, targetOffsetPx) {
        ctx.container.style[ctx.edge] = `${targetOffsetPx}px`;
        ctx.container.style.opacity = '1';
    },
    enterTo() {
        // Nothing left to animate to - enterFrom already set the resting state.
    },
    enterDurationMs: 0,
    exit(ctx) {
        ctx.container.style.opacity = '0';
    },
    exitDurationMs: 0,
};

const registry = new Map<string, ToastAnimationDefinition>([
    [ToastAnimation.SLIDE, slideDefinition],
    [ToastAnimation.FADE, fadeDefinition],
    [ToastAnimation.NONE, noneDefinition],
]);

/**
 * Registers a custom named animation, usable anywhere `animation` is
 * accepted (`ToastOptions`, `configure()`, `ToastBuilder.withAnimation()`)
 * by passing its `name`. See `docs/guide/animations.md` for a worked
 * example. Overwriting a built-in name (e.g. `'slide'`) is allowed, and
 * replaces its behavior for every toast that requests it afterwards.
 */
export function registerToastAnimation(name: string, definition: ToastAnimationDefinition): void {
    registry.set(name, definition);
}

/** Looks up a registered animation by name - `undefined` if nothing is registered under it. */
export function getToastAnimation(name: string): ToastAnimationDefinition | undefined {
    return registry.get(name);
}
