class TaskQueue {
  constructor({ minRunTime = 0 } = {}) {
    this.queue = [];
    this.isRunning = false;
    this.runLimit = minRunTime;

    this.run = this.run.bind(this);
  }

  put(...tasks) {
    this.queue.push(...tasks);
    this.scheduleRun();
  }

  hasPending() {
    return this.queue.length >= 1;
  }

  async run(deadline) {
    if (!this.isRunning) {
      this.isRunning = true;

      while (this.canRun(deadline)) {
        const task = this.queue.shift();
        task();
      }

      this.isRunning = false;
      if (this.hasPending()) this.scheduleRun();
    }
  }

  canRun(deadline) {
    return this.hasPending() && deadline.timeRemaining() > this.runLimit;
  }

  scheduleRun() {
    if (!this.isRunning) requestIdleCallback(this.run);
  }
}

const STATE = {};
const queue = new TaskQueue();
const domParser = new DOMParser();

let scheduledMoreEventsFetch = false;
const select = document.querySelector.bind(document);
const selectAll = document.querySelectorAll.bind(document);
const dateFormat = new Intl.DateTimeFormat('default', {
  month: 'short',
  day: '2-digit',
  year: 'numeric'
});
const dateTimeFormat = new Intl.DateTimeFormat('default', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  timeZoneName: 'short'
});
const rAF = ({ waitUntil } = {}) => new Promise((resolve) => {
    if (waitUntil) {
      setTimeout(() => {
        window.requestAnimationFrame(resolve);
      }, waitUntil);
    } else {
      window.requestAnimationFrame(resolve);
    }
  });

const displayDialog = async (dialog, isNotice = false) => {
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

const notify = async (msg, duration = 5000) => {
  const dialog = select('dialog[notice]');
  dialog.querySelector('[title]').innerHTML = msg;
  displayDialog(dialog, true);

  await rAF({ waitUntil: duration });
  dialog.classList.remove('in');
  dialog.close();
};

const getRoute = () => (window.location.hash || '#').substring(1);
const hasActiveRoute = () => getRoute() !== '';

const displayBanner = (img, url) => {
  rAF().then(() => {
    img.classList.add('on');
    img.src = url;
  });
};

const loadBanner = (url) => new Promise((resolve, reject) => {
    const loader = new Image();
    loader.addEventListener('error', reject);
    loader.addEventListener('load', () => resolve(loader, url));
    loader.src = url;
  });

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

const routeApp = () => {
  const route = getRoute();
  if (route === 'auth') {
    if (STATE.user && STATE.user.isAuthenticated === true) return;
    const dialog = select('[auth-dialog]');
    displayDialog(dialog);
  }

  if (route.startsWith('event-')) {
    const id = route.substring(route.indexOf('-') + 1);
    showEventDetails(id);
  }

  if (route === 'premium-info') {
    select('#premium-info').scrollTo({
      behavior: 'smooth'
    });
  }

  const openDialog = select('dialog[open]');
  if (route === '' && openDialog) {
    openDialog.close();
  }
};

const responseCanErr = (response) => {
  if (!response.ok) throw Error(`fetch failed with status : (${response.status})`);
  return response;
};

const fetchEvents = (dimension = '') => new Promise((resolve) => {
    const api = '4k91l7py';
    const apiKey = 'LEIX-GF3O-AG7I-6J84';
    const apiBase = 'https://randomapi.com/api';

    let request = `${apiBase}/${api}?key=${apiKey}`;
    if (dimension && dimension !== '') request = `${request}&dimension=${dimension}`;

    fetch(request)
      .then(responseCanErr)
      .then((response) => {
        queue.put(async () => {
          const {
            results: [{ events }]
          } = await response.json();
          resolve(events);
        });
      })
      .catch(() => {
        notify('Error loading events. Pls retry');
      });
  });

const sortEventsByStartDate = (dir = 'ASC') => (a, b) => {
  const elapsedA = new Date(a.when).getTime();
  const elapsedB = new Date(b.when).getTime();
  return dir === 'ASC' ? elapsedA - elapsedB : elapsedB - elapsedA;
};

const saveUserState = (update = {}) => {
  const { email } = STATE.user;
  const data = JSON.parse(localStorage.getItem('vanhackevents') || '{}');
  data[email] = Object.assign(data[email] || {}, update);
  localStorage.setItem('vanhackevents', JSON.stringify(data));
  STATE.user = data[email];
};

const isDuplicateApplication = (eventId) => new Promise((resolve) => {
    queue.put(() => {
      const { email } = STATE.user;
      const data = JSON.parse(localStorage.getItem('vanhackevents') || '{}');
      const userEvents = data[email].events || [];
      resolve(userEvents.includes(eventId));
    });
  });

const applyToEvent = (eventId) => new Promise((resolve) => {
    queue.put(() => {
      let applied = false;
      const event = STATE.events.find(({ id }) => id === eventId);
      if (!event) return resolve(applied);

      if (event.entry === 'Premium' && !STATE.user.isPremium) {
        notify('You are not eligible. Activate <a href="#premium-info">premium</a> to apply');
        return resolve(applied);
      }

      if (!STATE.user.events) STATE.user.events = [];

      STATE.user.events.push(eventId);
      saveUserState(STATE.user);
      applied = true;
      return resolve(applied);
    });
  });

const handleShareEvent = () => {
  const deepLink = `${window.location.href}`;
  const text = 'Check out this @GoVanHack event that helps techies make the most of job opportunities:';
  const url = `https://twitter.com/intent/tweet?text=${text}&url=${deepLink}`;
  window.open(url, '', 'resizable,width=650,height=370');
};

const handleApplyToEvent = async (eventId, btn) => {
  const { user } = STATE;
  if (!user || !user.isAuthenticated) {
    window.history.pushState(null, null, '#auth');
    routeApp();
    return;
  }

  if (user && user.isAuthenticated === true) {
    const isDuplicate = await isDuplicateApplication(eventId);

    if (isDuplicate === true) {
      notify('you already applied for this event');
      return;
    }
    const userApplied = await applyToEvent(eventId);
    if (userApplied === true) {
      btn.querySelector('[call-to-action]').textContent = 'You Applied';

      // the above button might be from within the modal
      // make sure the apply button on the event listing
      // is updated to reflect that the user has applied for the event

      // const eventNode = [...selectAll(`[events] > div`)]
      // .find((el) => el.dataset.uid === eventId);
      const eventNode = select(`[events] [uid=${eventId}]`);
      if (eventNode) {
        const relatedCTA = eventNode.querySelector('[apply-btn] [call-to-action]');
        if (relatedCTA) {
          relatedCTA.textContent = 'You Applied';
        }
      }

      notify('you have successfully applied');
    }
  }
};

const userWillEngageEventDetails = ({ target }) => {
  const applyBtn = target.closest('[apply-btn]');
  const shareBtn = target.closest('[share]');
  const idNode = target.closest('[data-uid]');
  if (idNode) {
    const eventId = idNode.dataset.uid;
    if (applyBtn) {
      handleApplyToEvent(eventId, applyBtn);
    }

    if (shareBtn) {
      handleShareEvent(eventId);
    }
  }
};

const eventDomTemplate = (event) => {
  const {
    id, title, type, entry, banner, preview, when, applyDeadline
  } = event;

  let badge = '';
  const ribbon = entry === 'Premium' ? `<div class="ribbon-premium"><span>${entry}</span></div>` : '';
  if (['Leap', 'Recruiting Mission', 'VanHackathon'].includes(type)) {
    let typeTxt;
    if (type === 'Recruiting Mission') {
      typeTxt = 'RM';
    } else {
      typeTxt = type.toUpperCase();
      typeTxt = `${typeTxt.charAt(0)}${typeTxt.charAt(3)}`;
    }
    badge = `<div class="badge">${typeTxt}</div>`;
  }

  const now = Date.now();
  const deadline = new Date(applyDeadline).getTime();
  const canApply = deadline > now;
  const applyBtn = canApply
    ? '<button apply-btn><span class="material-icons">perm_contact_calendar</span><span call-to-action>Login To Apply</span></button>'
    : '';

  const tpl = `
        <div data-uid="${id}">
            ${ribbon} ${badge}
            <img src="${preview}" alt="${title}" data-src="${banner}">
            <div summary>
                <h2><a href="#event-${id}">${title}</a></h2>
                <div dates>
                    <p>
                        <span class="material-icons">event</span>
                        <span>${dateFormat.format(new Date(when))}</span>
                    </p>
                    ${applyBtn}
                </div>
            </div>
        </div>
    `;

  return tpl;
};

const makeEventForDisplay = (event, view) => {
  const doc = domParser.parseFromString(eventDomTemplate(event), 'text/html');
  const eventNode = doc.body.firstChild;
  view.appendChild(eventNode);
};

const lazyLoadEventBannersFor = (...selectors) => {
  const banners = selectors.reduce((pool, imgs) => {
    pool.push(...selectAll(imgs));
    return pool;
  }, []);

  banners.forEach((image) => {
    const img = image;
    const url = img.dataset.src;
    loadBanner(url).then(() => displayBanner(img, url));
  });
};

const displayEvents = (containerSelector, events) => {
  const container = select(containerSelector);
  const fragmeent = document.createDocumentFragment();
  events.forEach((evt) => makeEventForDisplay(evt, fragmeent));
  container.innerHTML = '';
  container.appendChild(fragmeent);

  container.addEventListener('click', userWillEngageEventDetails);
};

const displayHeroEvents = async (promoted, theRest) => {
  await rAF();
  displayEvents('[promoted-events] [events]', promoted);

  await rAF();
  displayEvents('[upcoming-events] [events]', theRest);

  const heroImages = ['[promoted-events] [events] img', '[upcoming-events] [events] img'];
  queue.put(() => lazyLoadEventBannersFor(heroImages));
};

const displayRemainingEvents = (events) => {
  rAF().then(() => {
    displayEvents('[more-events-wrap] [events]', events.slice(0, 12));
  });
};

const handleRemainingEvents = async (events) => {
  queue.put(() => {
    const sorted = events.sort(sortEventsByStartDate('DSC'));
    displayRemainingEvents(sorted);
    sorted.forEach((evt) => STATE.events.push(evt));
  });
};

const moreEventsFetcher = new IntersectionObserver(async (entries) => {
  const triggerView = entries.find((e) => e.isIntersecting === true);
  if (triggerView) {
    moreEventsFetcher.unobserve(select('footer'));
    moreEventsFetcher.unobserve(select('[upcoming-events]'));
    scheduledMoreEventsFetch = false;

    const moreEvents = await fetchEvents();
    await handleRemainingEvents(moreEvents);
  }
});

const handleHeroEvents = async (events) => {
  queue.put(() => {
    const sorted = events.sort(sortEventsByStartDate('ASC'));
    const promoted = sorted.slice(0, 2);
    const theRest = sorted.slice(2, 8);
    displayHeroEvents(promoted, theRest);

    if (!scheduledMoreEventsFetch) {
      moreEventsFetcher.observe(select('[upcoming-events]'));
      moreEventsFetcher.observe(select('footer'));
      scheduledMoreEventsFetch = true;
    }
    STATE.events.push(...sorted);
  });
};

const signUserIn = () => {
  const emailInput = select('[auth-dialog] [type=email]');
  const email = emailInput.value;

  // TODO provide better email validation
  if (!email || `${email}`.trim() === '' || email.indexOf('@') === -1) {
    notify('to login, pls enter email with a valid format');
    return;
  }

  STATE.user = {
    email,
    isAuthenticated: true,
    isPremium: select('[auth-dialog] [type=checkbox]').checked
  };

  queue.put(() => saveUserState(STATE.user));

  rAF().then(() => {
    const nav = select('header nav');
    const avatar = nav.querySelector('[profile] img');
    avatar.onload = () => {
      nav.setAttribute('authenticated', '');
    };
    avatar.src = `https://api.adorable.io/avatars/36/${email}.png`;
    avatar.setAttribute('alt', email);
    avatar.setAttribute('title', email);
  });

  queue.put(() => {
    const userEvents = STATE.user.events || [];
    rAF().then(() => {
      const applyCTA = [...selectAll('[apply-btn] [call-to-action]')];
      applyCTA.forEach((cta) => {
        const eventId = cta.closest('[data-uid]').dataset.uid;
        if (userEvents.includes(eventId)) {
          cta.textContent = 'You Applied';
        } else {
          cta.textContent = 'APPLY';
          if (cta.closest('dialog')) {
            cta.textContent = 'Apply To Event';
          }
        }
      });
    });
  });
};

const setupUI = () => {
  window.onpopstate = () => routeApp();
  selectAll('dialog[interactive]').forEach((dialog) => {
    dialog.addEventListener('click', ({ target }) => {
      if (target.tagName === 'DIALOG') {
        dialog.close();
        return;
      }

      if (dialog.hasAttribute('event-details-dialog')) {
        dialog.addEventListener('click', userWillEngageEventDetails);
      }
    });

    dialog.addEventListener('close', () => {
      dialog.classList.remove('in', 'event-held');
      window.history.back();
    });
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  });
};

const setupAuth = () => {
  const loginBtn = select('[auth-dialog] [login]');
  loginBtn.addEventListener('click', signUserIn);
};

const startApp = async () => {
  setupUI();
  setupAuth();
  STATE.events = [];

  const heroEvents = await fetchEvents('above-fold');
  await handleHeroEvents(heroEvents);
  if (hasActiveRoute()) routeApp();
};
document.addEventListener('DOMContentLoaded', startApp);
