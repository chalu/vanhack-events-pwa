export const rAF = (opts = {}) => {
  const { waitUntil } = opts;
  return new Promise((resolve) => {
    if (waitUntil) {
      setTimeout(() => {
        window.requestAnimationFrame(resolve);
      }, waitUntil);
      return;
    }

    window.requestAnimationFrame(resolve);
  });
};

export const select = document.querySelector.bind(document);
export const selectAll = document.querySelectorAll.bind(document);
export const useElement = (selector) => {
  const node = select(selector);
  const setText = (text) => {
    rAF().then(() => {
      node.textContent = text;
    });
  };
  return [node, setText];
};

export const dateFormat = new Intl.DateTimeFormat('default', {
  month: 'short',
  day: '2-digit',
  year: 'numeric'
});

export const dateTimeFormat = new Intl.DateTimeFormat('default', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  timeZoneName: 'short'
});

export const displayDialog = async (dialog, isNotice = false) => {
  if (!dialog) return;

  await rAF();
  if (isNotice === true) {
    dialog.show();
  } else {
    dialog.showModal();
  }

  await rAF({ waitUntil: 500 });
  dialog.classList.add('in');
};

export const displayBanner = (img, url) => {
  rAF().then(() => {
    img.classList.add('on');
    img.src = url;
  });
};

export const loadBanner = (url) => new Promise((resolve, reject) => {
  const loader = new Image();
  loader.addEventListener('error', reject);
  loader.addEventListener('load', () => resolve(loader, url));
  loader.src = url;
});

export const getRoute = () => (window.location.hash || '#').substring(1);
export const hasActiveRoute = () => getRoute() !== '';

export const responseCanErr = (response) => {
  if (!response.ok) throw Error(`fetch failed with status : (${response.status})`);
  return response;
};
