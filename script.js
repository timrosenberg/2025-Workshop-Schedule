async function loadSchedule() {
  const response = await fetch('schedule.json');
  const data = await response.json();
  const container = document.getElementById('schedule-container');

  data.days.forEach(day => {
    const details = document.createElement('details');
    details.className = 'day';
    details.id = day.id;

    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${day.title}</span>`;
    details.appendChild(summary);

    if (day.theme) {
      const p = document.createElement('p');
      p.className = 'theme-description';
      p.textContent = day.theme;
      details.appendChild(p);
    }

    const ul = document.createElement('ul');
    ul.id = `schedule-${day.id}`;
    day.items.forEach((item, i) => {
      const li = document.createElement('li');
      li.setAttribute('data-id', `${day.id}-${i + 1}`);
      li.id = `${day.id}-${i + 1}`;

      const time = document.createElement('time');
      time.textContent = item.time;
      li.appendChild(time);

      li.append(`: ${item.text}`);
      ul.appendChild(li);
    });

    details.appendChild(ul);
    container.appendChild(details);
  });
}

function parseTimeString(timeStr) {
  const parts = timeStr.split(' - ');
  const parsePart = str => {
    const match = str.match(/(\d+):(\d+)?\s*(AM|PM)/i);
    if (!match) return new Date(1970, 0, 1, 0, 0);
    let [, h, m = "0", ampm] = match;
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

function localDateFromISO(isoStr) {
  const [date, time] = isoStr.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('highlighted');
  setTimeout(() => target.classList.remove('highlighted'), 2000);
}

function updateNowNextFromSchedule() {
  const testSelect = document.getElementById('test-mode-select');
  const testTime = testSelect?.value;
  const now = testTime ? localDateFromISO(testTime) : new Date();

  const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = now.getDate();
  const dayId = `${month}-${day}`;
  const details = document.getElementById(dayId);
  if (!details) return;

  document.querySelectorAll('details').forEach(d => d.removeAttribute('open'));
  details.setAttribute('open', '');

  const lis = details.querySelectorAll('li');
  const currentTime = new Date(1970, 0, 1, now.getHours(), now.getMinutes());

  let current = null, next = null;

  for (let i = 0; i < lis.length; i++) {
    const timeText = lis[i].querySelector('time')?.textContent.trim();
    if (!timeText) continue;

    const [start, end] = parseTimeString(timeText);
    if (currentTime >= start && currentTime < end) {
      current = lis[i];
      next = lis[i + 1] || null;
      break;
    }
    if (!current && currentTime < start && !next) {
      next = lis[i];
    }
  }

  function setBox(id, item) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!item || !item.id) {
      el.textContent = '—';
      el.removeAttribute('href');
      return;
    }
    el.textContent = item.textContent.trim().split('\n')[0];
    el.href = `#${item.id}`;
    el.onclick = e => {
      e.preventDefault();
      scrollToId(item.id);
    };
  }

  setBox('current-activity', current);
  setBox('next-activity', next);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  updateNowNextFromSchedule();
  setInterval(updateNowNextFromSchedule, 60000);
  document.getElementById('test-mode-select')?.addEventListener('change', updateNowNextFromSchedule);
});