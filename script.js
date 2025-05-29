// script.js

async function loadSchedule() {
  const response = await fetch('schedule.json');
  const scheduleData = await response.json();

  const main = document.querySelector('main');

  scheduleData.days.forEach(day => {
    const details = document.createElement('details');
    details.className = 'day';
    details.id = day.id;

    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${day.title}</span>`;
    details.appendChild(summary);

    if (day.themeDescription) {
      const desc = document.createElement('p');
      desc.className = 'theme-description';
      desc.innerHTML = day.themeDescription;
      details.appendChild(desc);
    }

    const ul = document.createElement('ul');
    day.events.forEach(event => {
      const li = document.createElement('li');
      li.setAttribute('data-id', event.id);
      li.id = event.id;

      const time = document.createElement('time');
      time.textContent = event.time;
      li.appendChild(time);
      li.innerHTML += `: ${event.description}`;

      if (event.subEvents) {
        const subUl = document.createElement('ul');
        event.subEvents.forEach(sub => {
          const subLi = document.createElement('li');
          subLi.innerHTML = sub;
          subUl.appendChild(subLi);
        });
        li.appendChild(subUl);
      }

      ul.appendChild(li);
    });

    details.appendChild(ul);
    main.appendChild(details);
  });
}

function parseTimeString(timeStr) {
  const parts = timeStr.split(' - ');
  const parsePart = str => {
    const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return new Date(1970, 0, 1, 0, 0);
    let [, h, m, ampm] = match;
    h = parseInt(h, 10);
    m = parseInt(m, 10);
    if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    return new Date(1970, 0, 1, h, m);
  };
  const start = parsePart(parts[0]);
  const end = parts[1] ? parsePart(parts[1]) : new Date(1970, 0, 1, 23, 59);
  return [start, end];
}

function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('highlighted');
  setTimeout(() => target.classList.remove('highlighted'), 2000);
}

function localDateFromISO(isoStr) {
  const [date, time] = isoStr.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function updateNowNext() {
  const testValue = document.getElementById('test-mode-select')?.value;
  const now = testValue ? localDateFromISO(testValue) : new Date();

  const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = now.getDate();
  const detailsId = `${month}-${day}`;
  const details = document.getElementById(detailsId);
  if (!details) return;

  document.querySelectorAll('details').forEach(d => d.removeAttribute('open'));
  details.setAttribute('open', '');

  const items = Array.from(details.querySelectorAll('li'));
  const currentTime = new Date(1970, 0, 1, now.getHours(), now.getMinutes());

  let current = null;
  let next = null;

  for (let i = 0; i < items.length; i++) {
    const timeText = items[i].querySelector('time')?.textContent.trim();
    if (!timeText) continue;

    const [start, end] = parseTimeString(timeText);

    if (currentTime >= start && currentTime < end) {
      current = items[i];
      next = items[i + 1] || null;
      break;
    }

    if (!current && currentTime < start && !next) {
      next = items[i];
    }
  }

  function applyTo(el, item) {
    if (!el) return;
    if (!item || !item.id) {
      el.textContent = '—';
      el.removeAttribute('href');
      el.onclick = null;
      return;
    }

    const id = item.id;
    el.textContent = item.textContent.trim().split('\n')[0];
    el.href = `#${id}`;
    el.onclick = e => {
      e.preventDefault();
      scrollToId(id);
    };
  }

  applyTo(document.getElementById('current-activity'), current);
  applyTo(document.getElementById('next-activity'), next);
}

function setupBannerDismiss() {
  const banner = document.getElementById('studentNotice');
  const closeBtn = banner?.querySelector('.close-banner');
  const messageId = banner?.getAttribute('data-id');
  const dismissedId = localStorage.getItem('dismissedNotice');

  if (messageId !== dismissedId) {
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }

  closeBtn?.addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem('dismissedNotice', messageId);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  updateNowNext();
  setupBannerDismiss();

  document.getElementById('test-mode-select')?.addEventListener('change', updateNowNext);
  setInterval(updateNowNext, 60000);
});
