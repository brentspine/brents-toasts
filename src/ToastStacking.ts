import { POSITION_EDGE, type ToastPositionValue } from './ToastPosition';

const TOAST_GAP = 8;
// Distance from the anchor edge (top or bottom, per POSITION_EDGE) a toast
// rests at once its entrance animation finishes.
export const TOAST_EDGE_OFFSET = 22;

// The snackbar element's own `data-position` (set by Toasts._getSnackbar) is
// the single source of truth for which CSS property ('top' or 'bottom') its
// toasts stack away from — read it back here instead of threading an `edge`
// parameter through every stacking call site.
export function edgeFor(snackbar: HTMLElement): 'top' | 'bottom' {
    return POSITION_EDGE[snackbar.dataset.position as ToastPositionValue] ?? 'bottom';
}

// Moves one toast to its new stacking offset. When `causingTransition` is
// given (the animation of whichever toast entered/exited and caused this
// reflow), the move is temporarily forced to animate with THAT transition
// instead of the toast's own — snapshot own transition, override, apply the
// offset, force a layout read (this is what locks the transition's
// duration/easing in for this move, since an already-started CSS transition
// isn't retroactively affected by a later `transition` property change),
// then restore the toast's own transition so any *other* future reflow
// (e.g. a resize) still uses it.
function applyOffset(toastEl: HTMLElement, edge: 'top' | 'bottom', offsetPx: number, causingTransition?: string): void {
    if (causingTransition === undefined) {
        toastEl.style[edge] = `${offsetPx}px`;
        return;
    }
    const ownTransition = toastEl.style.transition;
    toastEl.style.transition = causingTransition;
    toastEl.style[edge] = `${offsetPx}px`;
    void toastEl.offsetHeight;
    toastEl.style.transition = ownTransition;
}

// Repositions all remaining toasts nearest-DOM-position-last-first (matching
// the insertion order established when each toast was added — see the
// `reverseOrder` branch in Toasts.showToast), using each toast's actual
// rendered height so variable-height toasts (e.g. with a title) don't
// overlap their neighbors. Stacks away from the snackbar's anchor edge (top
// or bottom) — see edgeFor. `causingTransition`, when passed, is the exiting
// toast's animation transition — see applyOffset.
export function recalculatePositions(snackbar: HTMLElement, causingTransition?: string): void {
    const edge = edgeFor(snackbar);
    let offset = TOAST_EDGE_OFFSET;
    Array.from(snackbar.children)
        .filter(el => !el.classList.contains('bt-hiding'))
        .reverse()
        .forEach((el) => {
            const toastEl = el as HTMLElement;
            applyOffset(toastEl, edge, offset, causingTransition);
            offset += toastEl.getBoundingClientRect().height + TOAST_GAP;
        });
}

// Pushes every toast other than `newToast` away from the snackbar's anchor
// edge to make room for it, walking DOM order back-to-front by each toast's
// actual rendered height. `causingTransition`, when passed, is the entering
// toast's animation transition — see applyOffset.
export function stackExistingAway(snackbar: HTMLElement, newToast: HTMLElement, causingTransition?: string): void {
    const edge = edgeFor(snackbar);
    let offset = TOAST_EDGE_OFFSET + newToast.getBoundingClientRect().height + TOAST_GAP;
    Array.from(snackbar.children)
        .filter(el => el !== newToast)
        .reverse()
        .forEach((el) => {
            const toastEl = el as HTMLElement;
            applyOffset(toastEl, edge, offset, causingTransition);
            offset += toastEl.getBoundingClientRect().height + TOAST_GAP;
        });
}

// Total distance from the anchor edge occupied by every toast other than
// `excludeEl` — used to land a `reverseOrder` toast beyond all of them,
// instead of nearest the edge. Mirrors stackExistingAway's loop (same
// `.bt-hiding` treatment — a fading-out toast still reserves its space) but
// sums instead of assigning a per-element offset, since none of the other
// toasts need to move for this case.
export function totalStackedExtent(snackbar: HTMLElement, excludeEl: HTMLElement): number {
    let offset = TOAST_EDGE_OFFSET;
    Array.from(snackbar.children)
        .filter(el => el !== excludeEl)
        .forEach((el) => {
            offset += (el as HTMLElement).getBoundingClientRect().height + TOAST_GAP;
        });
    return offset;
}
