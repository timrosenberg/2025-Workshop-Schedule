let globalBannerData = {};

async function loadSchedule() {
  const response = await fetch('schedule.json');
  const data = await response.json();
  const scheduleContainer = document.getElementById('schedule-container');

  Object.entries(data).forEach(([key, dayData]) => {
    const details = document.createElement('details');
    details.className = 'day';
    details.id = key;

    const summary = document.createElement('summary');
    const [year, month, day] = (dayData.title || dayData.label).split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
    });
    summary.innerHTML = `<span>${formattedDate}</span>`;


    details.appendChild(summary);

    const theme = document.createElement('p');
    theme.className = 'theme-description';
    theme.textContent = dayData.theme;
    details.appendChild(theme);

    const ul = document.createElement('ul');
    ul.id = `schedule-${key}`;

    dayData.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.setAttribute('data-id', `${key}-${index + 1}`);
      li.id = `${key}-${index + 1}`;

      const time = document.createElement('time');
      time.textContent = item.time;
      li.appendChild(time);

    li.appendChild(document.createTextNode(`: ${item.text}`));

    if (item.subpoints && item.subpoints.length) {
    const subUl = document.createElement('ul');
    item.subpoints.forEach(point => {
        const subLi = document.createElement('li');
        subLi.textContent = point;
        subUl.appendChild(subLi);
    });
    li.appendChild(subUl);
    }

      if (item.map) {
        const mapLink = document.createElement('a');
        mapLink.href = item.map;
        mapLink.textContent = ' [Map]';
        mapLink.target = '_blank';
        mapLink.style.marginLeft = '0.5rem';
        li.appendChild(mapLink);
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

// Function to parse ISO date strings with optional time components
function localDateFromISO(isoStr) {
  const [datePart, timePart = "00:00"] = isoStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}


// Function to update Now/Next boxes based on current or test mode time
function updateNowNextFromHiddenData() {
  const testValue = document.getElementById('test-mode-select')?.value;
  const now = testValue ? localDateFromISO(testValue) : new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dayKey = `${yyyy}-${mm}-${dd}`;
  const daySection = document.getElementById(dayKey);
  if (!daySection) return;

  const activities = Array.from(daySection.querySelectorAll('li'));
  let nowActivity = null;
  let nextActivity = null;

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const timeEl = activity.querySelector('time');
    if (!timeEl) continue;

    const fullText = activity.textContent.trim();
    const timeRange = fullText.split(':')[0].trim();
    const match = timeRange.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?(?:\s*-\s*(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i);
    if (!match) continue;

    let [ , sh, sm, sap, eh, em, eap ] = match;
    sh = parseInt(sh); sm = parseInt(sm);
    eh = parseInt(eh || sh); em = parseInt(em || sm);

    if (sap?.toUpperCase() === 'PM' && sh < 12) sh += 12;
    if (sap?.toUpperCase() === 'AM' && sh === 12) sh = 0;
    if (eap?.toUpperCase() === 'PM' && eh < 12) eh += 12;
    if (eap?.toUpperCase() === 'AM' && eh === 12) eh = 0;

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em);

    if (now >= start && now <= end) {
      nowActivity = activity.cloneNode(true);
    } else if (now < start && !nextActivity) {
      nextActivity = activity.cloneNode(true);
    }
  }

  const nowBox = document.getElementById('now-box');
  const nextBox = document.getElementById('next-box');
  nowBox.innerHTML = nowActivity ? `<h3>Now</h3>${nowActivity.outerHTML}` : '';
  nextBox.innerHTML = nextActivity ? `<h3>Next</h3>${nextActivity.outerHTML}` : '';
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedule();
  updateNowNextFromHiddenData();
  applyBanner();
  setInterval(updateNowNextFromHiddenData, 60000);

  // Fetch banner data once
  fetch('banners.json')
    .then(res => res.json())
    .then(banners => {
      globalBannerData = banners;
      applyBanner();
    });

    // Event listener for test mode selection change
    document.getElementById('test-mode-select')?.addEventListener('change', () => {
    updateNowNextFromHiddenData();
    applyBanner();
    });

// Function to apply the daily banner based on current or test mode date
function applyBanner() {
  const bannerEl = document.getElementById('daily-banner');
  if (!bannerEl || !window.globalBannerData) return;

  const testValue = document.getElementById('test-mode-select')?.value;
  const now = testValue ? localDateFromISO(testValue) : new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const detailsId = `${yyyy}-${mm}-${dd}`;

  const message = globalBannerData.banners?.[detailsId];
  if (!message || localStorage.getItem(`bannerDismissed-${detailsId}`)) {
    bannerEl.style.display = 'none';
    return;
  }

  bannerEl.innerHTML = `
    <div class="banner-content">
      <span>${message}</span>
      <button id="dismiss-banner">×</button>
    </div>
  `;
  bannerEl.style.display = 'block';

  document.getElementById('dismiss-banner')?.addEventListener('click', () => {
    localStorage.setItem(`bannerDismissed-${detailsId}`, 'true');
    bannerEl.style.display = 'none';
  });
}
});

