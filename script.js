let scheduleData = [];

function groupFlatSchedule(flatData) {
  const grouped = {};

  for (const item of flatData) {
    const date = item["Date"];
    if (!date) continue;

    if (!grouped[date]) {
      grouped[date] = {
        date,
        day: item["Day"] || "",
        theme: item["Theme"] || "",
        themeDescription: item["Theme Description"] || "",
        activities: []
      };
    }

    const notes = [];
    for (let i = 1; i <= 4; i++) {
      const note = item[`Note ${i}`];
      if (note) notes.push(note);
    }

    grouped[date].activities.push({
      time: item["Time"] || "",
      title: item["Title"] || "",
      location: item["Location"] || "",
      notes
    });
  }

  return Object.values(grouped);
}

async function loadSchedule() {
  const res = await fetch('schedule.json');
  const flatData = await res.json();
  scheduleData = groupFlatSchedule(flatData);
  renderSchedule(scheduleData);
}

function renderSchedule(data) {
  const container = document.getElementById('schedule-container');
  container.innerHTML = '';

  data.forEach(day => {
    const dayEl = document.createElement('details');
    dayEl.className = 'day';
    dayEl.setAttribute('open', true);

    const dateStr = new Date(day.date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    const summary = document.createElement('summary');
    summary.textContent = `${day.day || ''}, ${dateStr}`;
    dayEl.appendChild(summary);

    if (day.theme && day.themeDescription) {
      const themeEl = document.createElement('div');
      themeEl.className = 'theme-description';
      themeEl.innerHTML = `<strong>${day.theme}:</strong> ${day.themeDescription}`;
      dayEl.appendChild(themeEl);
    }

    const ul = document.createElement('ul');

    day.activities.forEach(act => {
      const li = document.createElement('li');
      const link = act.mapUrl ? `<a href="${act.mapUrl}" target="_blank">[map]</a>` : '';
      li.innerHTML = `<time>${act.time}</time> — <strong>${act.title}</strong>${act.location ? ` @ ${act.location}` : ''} ${link}`;

      if (act.notes?.length) {
        const subUl = document.createElement('ul');
        act.notes.forEach(n => {
          const subLi = document.createElement('li');
          subLi.innerHTML = n;
          subUl.appendChild(subLi);
        });
        li.appendChild(subUl);
      }

      ul.appendChild(li);
    });

    dayEl.appendChild(ul);
    container.appendChild(dayEl);
  });
}

function getCurrentTime() {
  const testValue = document.getElementById('test-mode-select')?.value;
  return testValue ? new Date(testValue) : new Date();
}

function updateNowNext() {
  const now = getCurrentTime();
  const nowBox = document.getElementById('now-box');
  const nextBox = document.getElementById('next-box');

  nowBox.innerHTML = '<h3>Now</h3><p>No current activity</p>';
  nextBox.innerHTML = '<h3>Next</h3><p>No upcoming activity</p>';

  const currentDay = scheduleData.find(day => day.date === now.toISOString().slice(0, 10));
  if (!currentDay) return;

  const parseTime = timeStr => {
    const [_, hour, minute, ampm] = timeStr.match(/(\d+):?(\d+)?\s*(AM|PM)/i) || [];
    if (!hour) return null;
    let h = parseInt(hour);
    let m = parseInt(minute || '0');
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  };

  const nowTime = now.getTime();
  const events = currentDay.activities.map(a => {
    const parts = a.time.split('-');
    const start = parseTime(parts[0]?.trim());
    const end = parts[1] ? parseTime(parts[1]?.trim()) : new Date(start.getTime() + 30 * 60000);
    return { ...a, start, end };
  });

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e.start || !e.end) continue;

    if (nowTime >= e.start.getTime() && nowTime <= e.end.getTime()) {
      nowBox.innerHTML = `<h3>Now</h3><p>${e.time} — <a href="#">${e.title}</a></p>`;
      if (events[i + 1]) {
        const n = events[i + 1];
        nextBox.innerHTML = `<h3>Next</h3><p>${n.time} — <a href="#">${n.title}</a></p>`;
      }
      break;
    }

    if (nowTime < e.start.getTime()) {
      nextBox.innerHTML = `<h3>Next</h3><p>${e.time} — <a href="#">${e.title}</a></p>`;
      break;
    }
  }
}let globalBannerData = null;

function applyBanner() {
  const noticeEl = document.getElementById('global-notice');
  if (globalBannerData?.globalNotice?.text) {
    noticeEl.textContent = globalBannerData.globalNotice.text;
    noticeEl.style.display = 'block';
  }

  const bannerEl = document.getElementById('daily-banner');
  const bannerText = document.getElementById('banner-text');
  const testValue = document.getElementById('test-mode-select')?.value;
  const now = testValue ? new Date(testValue) : new Date();

  const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = now.getDate();
  const key = `${month}-${day}`;

  const message = globalBannerData?.banners?.[key];
  if (!message || localStorage.getItem(`bannerDismissed-${key}`)) return;

  bannerText.innerHTML = message;
  bannerEl.style.display = 'block';

  bannerEl.querySelector('.close-banner')?.addEventListener('click', () => {
    bannerEl.style.display = 'none';
    localStorage.setItem(`bannerDismissed-${key}`, 'true');
  });
}

async function loadBanners() {
  const res = await fetch('banners.json');
  globalBannerData = await res.json();
  applyBanner();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  await loadBanners();
  updateNowNext();
  setInterval(updateNowNext, 60000);

  const testSelect = document.getElementById('test-mode-select');
  if (testSelect) {
    testSelect.addEventListener('change', () => {
      updateNowNext();
      applyBanner();
    });
  }
});