let scheduleData = [];
let globalBannerData = {};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  updateNowNextFromHiddenData();
  setInterval(updateNowNextFromHiddenData, 60000);

  document.getElementById('test-mode-select')?.addEventListener('change', () => {
    updateNowNextFromHiddenData();
    applyBanner();
  });

  const res = await fetch('banners.json');
  globalBannerData = await res.json();
  applyBanner();
});

async function loadSchedule() {
  const res = await fetch('schedule.json');
  const flatData = await res.json();
  scheduleData = groupFlatSchedule(flatData);
  renderSchedule(scheduleData);
}

function groupFlatSchedule(flatData) {
  const grouped = {};

  for (const item of flatData) {
    const date = item["Date"];
    if (!date) continue;

    if (!grouped[date]) {
      grouped[date] = {
        date,
        day: item["Day"] || "",
        theme: item["Theme Title"] || "",
        themeDescription: item["Theme Description"] || "",
        activities: []
      };
    }

    const notes = [];
    for (let i = 1; i <= 4; i++) {
      const note = item[`Subpoint ${i}`];
      if (note) notes.push(note);
    }

    grouped[date].activities.push({
      time: item["Time"] || "",
      title: item["Activity"] || "",
      location: item["Location"] || "",
      mapUrl: item["Map URL"] || "",
      notes
    });
  }

  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderSchedule(scheduleData) {
  const container = document.getElementById('schedule-container');
  container.innerHTML = '';

  for (const day of scheduleData) {
    const details = document.createElement('details');
    details.className = 'day';

    const summary = document.createElement('summary');
    summary.innerHTML = `${day.day}${day.day && day.date ? ', ' : ''}${formatDate(day.date)}`;
    details.appendChild(summary);

    if (day.themeDescription) {
      const theme = document.createElement('div');
      theme.className = 'theme-description';
      theme.textContent = day.themeDescription;
      details.appendChild(theme);
    }

    const ul = document.createElement('ul');
    for (const act of day.activities) {
      const li = document.createElement('li');
      li.innerHTML = `<time>${act.time}</time> — ${act.title}`;
      if (act.location) li.innerHTML += ` @ ${act.location}`;
      if (act.mapUrl) li.innerHTML += ` <a href="${act.mapUrl}" target="_blank">(map)</a>`;

      if (act.notes && act.notes.length > 0) {
        const subUl = document.createElement('ul');
        act.notes.forEach(note => {
          const subLi = document.createElement('li');
          subLi.innerHTML = note;
          subUl.appendChild(subLi);
        });
        li.appendChild(subUl);
      }

      ul.appendChild(li);
    }

    details.appendChild(ul);
    container.appendChild(details);
  }
}

function updateNowNextFromHiddenData() {
  const now = getCurrentTime();
  const localDateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const today = scheduleData.find(day => day.date === localDateStr);
  const currentAnchor = document.getElementById('current-activity');
  const nextAnchor = document.getElementById('next-activity');

  currentAnchor.textContent = '⌛ No current activity';
  nextAnchor.textContent = '⏭️ Nothing upcoming';

  if (!today || !today.activities) return;

  let foundNow = null;
  let foundNext = null;

  for (let i = 0; i < today.activities.length; i++) {
    const act = today.activities[i];
    const [start, end] = (act.time || '').split('-').map(t => t && t.trim());
    const startTime = parseTime(start, now);
    const endTime = parseTime(end, now);

    if (startTime && endTime && now >= startTime && now < endTime) {
      foundNow = act;
      foundNext = today.activities[i + 1] || null;
      break;
    }

    if (startTime && now < startTime) {
      foundNext = act;
      break;
    }
  }

  if (foundNow) {
    currentAnchor.innerHTML = `⌛ ${foundNow.time} — ${foundNow.title}`;
  }

  if (foundNext) {
    nextAnchor.innerHTML = `⏭️ ${foundNext.time} — ${foundNext.title}`;
  }
}

function parseTime(timeStr, refDate) {
  if (!timeStr) return null;
  const date = new Date(refDate);
  const [rawTime, modifier] = timeStr.split(' ');
  const [hourStr, minStr] = rawTime.split(':');
  let hours = parseInt(hourStr);
  const minutes = parseInt(minStr) || 0;
  if (modifier && modifier.toLowerCase().includes('pm') && hours < 12) hours += 12;
  if (modifier && modifier.toLowerCase().includes('am') && hours === 12) hours = 0;
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getCurrentTime() {
  const testValue = document.getElementById('test-mode-select')?.value;
  if (!testValue) return new Date();

  // Parse the test value as if it were in the local timezone
  const date = new Date(testValue);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
}

function applyBanner() {
  const noticeEl = document.getElementById('global-notice');
  if (globalBannerData.globalNotice?.text) {
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

  const message = globalBannerData.banners?.[key];
  if (!message || localStorage.getItem(`bannerDismissed-${key}`)) return;

  bannerText.textContent = message;
  bannerEl.style.display = 'block';

  bannerEl.querySelector('.close-banner')?.addEventListener('click', () => {
    bannerEl.style.display = 'none';
    localStorage.setItem(`bannerDismissed-${key}`, 'true');
  });
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}