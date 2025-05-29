async function loadSchedule() {
  const response = await fetch('schedule.json');
  const data = await response.json();

  const scheduleContainer = document.getElementById('schedule');
  data.days.forEach((day, dayIndex) => {
    const details = document.createElement('details');
    details.className = 'day';
    details.id = day.id;

    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${day.name}</span>`;
    details.appendChild(summary);

    const theme = document.createElement('p');
    theme.className = 'theme-description';
    theme.innerHTML = day.description;
    details.appendChild(theme);

    const ul = document.createElement('ul');
    ul.id = `schedule-${day.id}`;

    day.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.setAttribute('data-id', `${day.id}-${index + 1}`);
      li.id = `${day.id}-${index + 1}`;
      
      const time = document.createElement('time');
      time.textContent = item.time;
      li.appendChild(time);
      li.appendChild(document.createTextNode(`: ${item.title}`));

      if (item.notes) {
        const notesUl = document.createElement('ul');
        item.notes.forEach(note => {
          const noteLi = document.createElement('li');
          noteLi.innerHTML = note;
          notesUl.appendChild(noteLi);
        });
        li.appendChild(notesUl);
      }

      ul.appendChild(li);
    });

    details.appendChild(ul);
    scheduleContainer.appendChild(details);
  });
}

function parseTimeString(timeStr) {
  const parts = timeStr.split(' - ');
  const parsePart = str => {
    const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) {
      console.warn("Invalid time format:", str);
      return new Date(1970, 0, 1, 0, 0);
    }
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
  let target = document.querySelector('details[open] li#' + id) || document.getElementById(id);
  if (!target) return;

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('highlighted');
    setTimeout(() => target.classList.remove('highlighted'), 2000);
  });
}

function localDateFromISO(isoStr) {
  const [date, time] = isoStr.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function updateNowNextFromHiddenData() {
  const testModeSelect = document.getElementById('test-mode-select');
  const testValue = testModeSelect?.value;
  const now = testValue ? localDateFromISO(testValue) : new Date();

  const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = now.getDate();
  const scheduleId = `schedule-${month}-${day}`;
  const detailsId = `${month}-${day}`;

  const scheduleList = document.getElementById(scheduleId);
  const visibleDetails = document.getElementById(detailsId);
  if (!scheduleList || !visibleDetails) return;

  visibleDetails.setAttribute('open', '');
  visibleDetails.querySelectorAll('li').forEach(li => {
    const dataId = li.getAttribute('data-id');
    if (dataId) li.id = dataId;
  });

  const items = Array.from(visibleDetails.querySelectorAll('li'));
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

document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  updateNowNextFromHiddenData();
  setInterval(updateNowNextFromHiddenData, 60000);
  document.getElementById('test-mode-select')?.addEventListener('change', updateNowNextFromHiddenData);
});