let scheduleData = [];
let globalBannerData = {};

function localDateFromISO(isoStr) {
  const [date, time] = isoStr.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h = 0, min = 0] = (time || '').split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function getEffectiveNow() {
  const testValue = document.getElementById('test-mode-select')?.value;
  return testValue ? localDateFromISO(testValue) : new Date();
}
async function loadSchedule() {
  const res = await fetch('schedule.json');
  scheduleData = await res.json();
  renderSchedule();
}

function renderSchedule() {
  const container = document.getElementById('schedule-container');
  container.innerHTML = '';

  for (const day of scheduleData) {
    const section = document.createElement('details');
    section.id = day.date;
    section.open = true;

    const summary = document.createElement('summary');
    summary.textContent = `${day.day}, ${day.date} — ${day.theme || ''}`;
    section.appendChild(summary);

    if (day.themeDescription) {
      const desc = document.createElement('div');
      desc.className = 'theme-description';
      desc.innerHTML = day.themeDescription;
      section.appendChild(desc);
    }

    const ul = document.createElement('ul');
    for (const act of day.activities) {
      const li = document.createElement('li');

      const time = document.createElement('time');
      time.textContent = act.time;
      li.appendChild(time);
      li.append(`: ${act.title}`);

      if (act.location) {
        const loc = document.createElement('div');
        loc.innerHTML = `<strong>Location:</strong> ${act.location}`;
        li.appendChild(loc);
      }

      if (act.notes && act.notes.length) {
        const sub = document.createElement('ul');
        for (const note of act.notes) {
          const subItem = document.createElement('li');
          subItem.innerHTML = note;
          sub.appendChild(subItem);
        }
        li.appendChild(sub);
      }

      ul.appendChild(li);
    }

    section.appendChild(ul);
    container.appendChild(section);
  }
}

function updateNowNext() {
  const now = getEffectiveNow();
  const dateStr = now.toISOString().split('T')[0];
  const today = scheduleData.find(d => d.date === dateStr);
  if (!today) return;

  let nowActivity = null;
  let nextActivity = null;

  for (const act of today.activities) {
    const range = act.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
    if (!range) continue;

    let [ , sh, sm, sap, eh, em, eap ] = range;
    sh = parseInt(sh); sm = parseInt(sm); eh = parseInt(eh || sh); em = parseInt(em || sm);

    if (sap === 'PM' && sh < 12) sh += 12;
    if (sap === 'AM' && sh === 12) sh = 0;
    if (eap === 'PM' && eh < 12) eh += 12;
    if (eap === 'AM' && eh === 12) eh = 0;

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em);

    if (now >= start && now <= end) {
      nowActivity = act;
    } else if (now < start && !nextActivity) {
      nextActivity = act;
    }
  }

  document.getElementById('now-box').innerHTML = nowActivity
    ? `<h3>Now</h3><p><time>${nowActivity.time}</time>: ${nowActivity.title}</p>`
    : '';

  document.getElementById('next-box').innerHTML = nextActivity
    ? `<h3>Next</h3><p><time>${nextActivity.time}</time>: ${nextActivity.title}</p>`
    : '';
}
async function loadBanners() {
  const res = await fetch('banners.json');
  globalBannerData = await res.json();
  updateBanner();
}

function updateBanner() {
  const now = getEffectiveNow();
  const key = now.toISOString().split('T')[0];

  const bannerText = globalBannerData.banners?.[key];
  const bannerEl = document.getElementById('daily-banner');
  if (!bannerText || localStorage.getItem(`bannerDismissed-${key}`)) {
    bannerEl.style.display = 'none';
    return;
  }

  bannerEl.innerHTML = `
    <span>${bannerText}</span>
    <button class="close-banner">&times;</button>
  `;
  bannerEl.style.display = 'block';

  bannerEl.querySelector('.close-banner').addEventListener('click', () => {
    localStorage.setItem(`bannerDismissed-${key}`, 'true');
    bannerEl.style.display = 'none';
  });
}
document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  await loadBanners();
  updateNowNext();
  setInterval(updateNowNext, 60000); // update every minute

  const testSelect = document.getElementById('test-mode-select');
  if (testSelect) {
    testSelect.addEventListener('change', () => {
      updateNowNext();
      updateBanner();
    });
  }
});
