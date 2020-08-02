import {
  select, dateFormat, dateTimeFormat,
  displayDialog, loadBanner, displayBanner
} from './ui-utils';

import { STATE } from './state';

const showEventDetails = (eventId) => {
  const event = STATE.events.find(({ id }) => id === eventId);
  if (!event) return;

  const dialog = select('[event-details-dialog]');
  const {
    id, title, type, entry, about, banner, preview, when, applyDeadline
  } = event;

  if (!dialog.dataset.uid || id !== dialog.dataset.uid) {
    dialog.setAttribute('data-uid', id);
    dialog.querySelector('h3').setAttribute('title', '');
    dialog.querySelector('[title-txt]').textContent = title;
    dialog.querySelector('[type]').textContent = type;
    dialog.querySelector('[entry]').textContent = entry;
    dialog.querySelector('[about]').textContent = about;
    dialog.querySelector('[date]').textContent = `Date: ${dateFormat.format(new Date(when))}`;

    const deadline = dateTimeFormat.format(new Date(applyDeadline));
    dialog.querySelector('[apply-deadline]').textContent = `Apply Before: ${deadline}`;

    const img = dialog.querySelector('img');
    img.src = preview;
    loadBanner(banner).then(() => displayBanner(img, banner));
  }

  const now = Date.now();
  const isPastEvent = now > new Date(when).getTime();
  if (isPastEvent) {
    dialog.classList.add('event-held');
  }

  if (dialog.hasAttribute('open')) return;

  displayDialog(dialog);
};

export default showEventDetails;
