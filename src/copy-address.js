/* ==========================================================================
   Copy the address

   The email address copies to the clipboard on click rather than opening a mail
   client. A mailto is a guess about how someone reads their mail; the address
   itself is not.

   Every instance of the same address moves together. There are three on the
   landing page — the print's correspondence line, the bar's collected copy, and
   the footer's below 768 — and two of them can be on screen at once. One saying
   "copied" while its twin still shows the address reads as two addresses rather
   than as one in two places.

   The label is the address, so confirming a copy means replacing what was just
   copied. That is the right trade at this size — there is nowhere to put a
   separate note that would not be louder than the line itself — and it comes
   back after a beat. Screen readers get a live region instead, because swapping
   a link's own text is not something to announce by surprise.
   ========================================================================== */

const REVERT = 1600;
const DONE = 'Copied';

/* The async clipboard first, then the old selection trick. The modern API needs
   a secure context and a permission that can be refused, and neither is worth a
   dead button: on a plain http host, which is exactly where someone previewing
   this will be, only the fallback works. */
async function toClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* refused, insecure, or not focused — fall through */
    }
  }

  // execCommand needs a real, selectable, on-page element. Off to the side
  // rather than display:none, which cannot hold a selection. readonly so a
  // mobile keyboard does not appear for the instant it exists.
  const pen = document.createElement('textarea');
  pen.value = text;
  pen.setAttribute('readonly', '');
  pen.style.cssText =
    'position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0';
  document.body.append(pen);
  pen.select();
  pen.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  pen.remove();
  return ok;
}

// Last resort: if neither path worked, leave the address selected so it can be
// copied by hand. Better than a button that silently does nothing.
function select(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function mountCopyAddress() {
  const buttons = [...document.querySelectorAll('[data-copy]')];
  if (!buttons.length) return;

  // One announcement for the page, added here rather than in the markup: it
  // exists only because this module does.
  const status = document.createElement('p');
  status.className = 'u-sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  document.body.append(status);

  const parts = buttons.map((button) => {
    const label = button.querySelector('[data-copy-label]') ?? button;
    return { button, label, address: button.dataset.copy, was: label.textContent };
  });

  let timer;

  for (const part of parts) {
    part.button.addEventListener('click', async () => {
      const ok = await toClipboard(part.address);

      // Every copy of this address, not just the one clicked.
      const family = parts.filter((p) => p.address === part.address);

      clearTimeout(timer);
      for (const p of family) {
        p.label.textContent = ok ? DONE : p.was;
        p.button.classList.toggle('is-copied', ok);
      }
      status.textContent = ok
        ? `${part.address} copied to the clipboard`
        : `Could not copy. ${part.address} is selected instead.`;

      if (!ok) select(part.label);

      timer = setTimeout(() => {
        for (const p of family) {
          p.label.textContent = p.was;
          p.button.classList.remove('is-copied');
        }
        status.textContent = '';
      }, REVERT);
    });
  }
}
