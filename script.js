console.log("Script loaded");

let scheduleData = [];
let globalBannerData = {};

// Function to refresh all time-sensitive parts of the page
function refreshDisplayForCurrentTime() {
  console.log("NEW: refreshDisplayForCurrentTime called."); // For debugging

  // Ensure scheduleData is loaded before proceeding
  if (!scheduleData || scheduleData.length === 0) {
    console.warn("Schedule data not loaded yet, skipping refreshDisplayForCurrentTime.");
    // It's possible loadSchedule hasn't completed or failed.
    // The DOMContentLoaded handler should await loadSchedule before the first call.
    return;
  }

  const currentTime = getCurrentTime(); // Get the current time (live or test)
  console.log("Effective current time for refresh:", currentTime.toString());

  // 1. Re-render the main schedule display.
  // This ensures all <details> and <li> elements for all days are fresh in the DOM.
  renderSchedule(scheduleData);
  console.log("Schedule re-rendered.");

  // 2. Explicitly open the <details> tag for the current day and close others.
  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-11
  const dayNum = String(currentTime.getDate()).padStart(2, '0');
  const currentDateKey = `${year}-${month}-${dayNum}`; // Format: "YYYY-MM-DD"

  console.log(`Current effective date key for opening details: ${currentDateKey}`);

  let dayWasOpened = false;
  document.querySelectorAll('details.day').forEach(detailsEl => {
    if (detailsEl.id === currentDateKey) {
      if (!detailsEl.open) {
        detailsEl.open = true; // Open the correct day
        console.log(`Opened details for ID: ${detailsEl.id}`);
      }
      dayWasOpened = true;
    } else {
      if (detailsEl.open) {
        detailsEl.open = false; // Close other days
        // console.log(`Closed details for ID: ${detailsEl.id}`);
      }
    }
  });

  if (!dayWasOpened) {
    console.log(`No specific day in schedule matched the current test/live date: ${currentDateKey}. All <details> sections will remain closed or as per their default HTML state (which is closed).`);
  }

  // 3. Update "Now" and "Next" boxes.
  // These create links that might point to elements within the <details> now opened.
  // updateNowNextFromHiddenData uses getCurrentTime() internally.
  updateNowNextFromHiddenData();
  console.log("Now/Next boxes updated.");

  // 4. Update other UI elements.
  // These also use getCurrentTime() or a similar mechanism internally.
  applyBanner();
  console.log("Banner applied.");
  updateDarkMode();
  console.log("Dark mode updated.");
  console.log("NEW: refreshDisplayForCurrentTime finished.");
}

const menu = document.getElementById('contact-menu');
menu.classList.add('hide');
/* console.log('Forced menu visible:', menu); */


async function loadSchedule() {
  const container = document.getElementById('schedule-container');
  if (!container) return; // Skip loading if not present

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
        themeTitle: item["Theme Title"] || "",
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
    const [year, month, dayNum] = day.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, dayNum);
    const weekdayName = localDate.toLocaleDateString('en-US', { weekday: 'long' });
    summary.innerHTML = `<span class="day-name">${weekdayName}</span>, ${formatDate(day.date)}`;
    /* summary.innerHTML = `<span class="day-name">${day.day}</span>${day.day && day.date ? ', ' : ''}${formatDate(day.date)}`; */
    details.appendChild(summary);

    if (day.themeDescription) {
      const theme = document.createElement('div');
      theme.className = 'theme-description';

      if (day.themeTitle) {
        theme.innerHTML = `<strong>${day.themeTitle}:</strong> ${day.themeDescription}`;
      } else {
        theme.textContent = day.themeDescription;
      }

      details.appendChild(theme);
    }

    const ul = document.createElement('ul');
    for (const act of day.activities) {
      const li = document.createElement('li');
      li.setAttribute('id', `activity-${day.date}-${act.time.replace(/[^a-zA-Z0-9]/g, '')}`);
      li.innerHTML = `<time>${act.time}</time> — <strong>${act.title}</strong>`;
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
    let [startStr, endStr] = (act.time || '').split('-').map(t => t && t.trim());
    
    const isSinglePoint = !endStr; // True if there was no '-' in act.time
    
    if (isSinglePoint) {
      endStr = startStr; // For parsing, treat end as start
    }

    const startTime = parseTime(startStr, now); // 'now' is getCurrentTime()
    let endTime = parseTime(endStr, now);     // For single point, endTime will initially be same as startTime

    let isNow = false;
    if (startTime && endTime) {
      if (isSinglePoint) {
        // For a single point event, consider it "Now" if 'now' is at 'startTime'
        // and for a nominal duration of 1 minute.
        // (now.getTime() >= startTime.getTime()) checks if current time is at or after start.
        // (now.getTime() < startTime.getTime() + (1 * 60 * 1000)) checks if current time is before start + 1 minute.
        if (now.getTime() >= startTime.getTime() && now.getTime() < (startTime.getTime() + 60000)) { // 60000ms = 1 minute
          isNow = true;
        }
      } else {
        // This is for ranged events (original logic)
        if (now >= startTime && now < endTime) {
          isNow = true;
        }
      }
    }

    if (isNow) {
      foundNow = act;
      foundNext = today.activities[i + 1] || null;
      break; 
    }

    // This part for finding 'foundNext' if 'foundNow' is not yet set remains the same:
    if (!foundNow && startTime && now < startTime) {
      if (!foundNext) {
        foundNext = act;
      }
    }
  }

  if (foundNow) {
    const anchorId = `activity-${localDateStr}-${foundNow.time.replace(/[^a-zA-Z0-9]/g, '')}`;
    currentAnchor.innerHTML = `<a href="#${anchorId}">⌛ ${foundNow.time} — ${foundNow.title}</a>`;

    currentAnchor.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(anchorId);
      if (el) {
        const details = el.closest('details');
        if (details && !details.open) {
          details.open = true;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        el.classList.add('blink-highlight');
        setTimeout(() => el.classList.remove('blink-highlight'), 800);
        setTimeout(() => el.classList.add('blink-highlight'), 1400);
        setTimeout(() => el.classList.remove('blink-highlight'), 2200);
      }
    });
  }

  if (foundNext) {
    const anchorId = `activity-${localDateStr}-${foundNext.time.replace(/[^a-zA-Z0-9]/g, '')}`;
    nextAnchor.innerHTML = `<a href="#${anchorId}">⏭️ ${foundNext.time} — ${foundNext.title}</a>`;

    nextAnchor.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(anchorId);
      if (el) {
        const details = el.closest('details');
        if (details && !details.open) {
          details.open = true;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        el.classList.add('blink-highlight');
        setTimeout(() => el.classList.remove('blink-highlight'), 800);
        setTimeout(() => el.classList.add('blink-highlight'), 1400);
        setTimeout(() => el.classList.remove('blink-highlight'), 2200);
      }
    });
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

  // Eastern Time (ET)
  const now = testValue ? new Date(testValue) : new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const month = estNow.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = estNow.getDate();
  const key = `${month}-${day}`;

  let bannerEntry = globalBannerData.banners?.[key];
  if (!bannerEntry) return;

  if (Array.isArray(bannerEntry)) {
    bannerEntry = [...bannerEntry]
      .filter(b => b.enabled !== false) // Show only enabled or missing flag (default true)
      .sort((a, b) => a.time.localeCompare(b.time))
      .reverse()
      .find(b => {
        const [h, m] = b.time.split(':').map(Number);
        const t = new Date(estNow);
        t.setHours(h, m, 0, 0);
        return estNow >= t;
      });
    if (!bannerEntry) return;
  }

  const dismissKey = `bannerDismissed-${key}-${bannerEntry.time}-${bannerEntry.version || 'v1'}`;
  if (localStorage.getItem(dismissKey)) {
    // Comment out or delete the next line to ignore dismissals completely:
    // return;
  }

  bannerText.textContent = bannerEntry.message || bannerEntry;
  bannerEl.style.display = 'block';

  bannerEl.querySelector('.close-banner')?.addEventListener('click', () => {
    bannerEl.style.display = 'none';
    localStorage.setItem(dismissKey, 'true');
  });
}

// NAV FETCHER
fetch('nav.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('nav-container').innerHTML = html;

    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });
    }
  });
//

// FOOTER FETCHER
fetch('footer.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('footer-container').innerHTML = html;
  });
//

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getCurrentTimeForDarkMode() {
  const testValue = document.getElementById('test-mode-select')?.value;
  if (!testValue) return new Date();

  const [datePart, timePart] = testValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function getTimeBlock() {
  const hour = getCurrentTimeForDarkMode().getHours();
  return (hour >= 6 && hour < 20) ? 'day' : 'night';
}

function getUserDarkModePreference() {
  return localStorage.getItem('dark-mode-preference');
}

function setUserDarkModePreference(value) {
  if (value === null) {
    localStorage.removeItem('dark-mode-preference');
    localStorage.removeItem('manual-set-at');
  } else {
    localStorage.setItem('dark-mode-preference', value);
    localStorage.setItem('manual-set-at', new Date().toISOString());
  }
}

function setDarkMode(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
}

function updateDarkMode() {
  const pref = getUserDarkModePreference();
  const block = getTimeBlock(); // 'day' or 'night'
  const now = getCurrentTimeForDarkMode();
  const hour = now.getHours();

  if (pref === 'dark') {
    setDarkMode(true);
    if (block === 'day' && hour >= 20) {
      setUserDarkModePreference(null); // reset at 8 PM
      updateDarkMode();
    }
    return;
  }

  if (pref === 'light') {
    setDarkMode(false);
    if (block === 'night' && hour >= 6 && hour < 20) {
      setUserDarkModePreference(null); // reset at 6 AM
      updateDarkMode();
    }
    return;
  }

  // No manual preference — follow time
  setDarkMode(block === 'night');
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM fully loaded and parsed. Initializing...");

  // 1. Load essential data
  try {
    await loadSchedule(); // Fetches schedule.json, processes it, and does initial renderSchedule()

    const bannerRes = await fetch('banners.json'); //
    globalBannerData = await bannerRes.json(); //
  } catch (error) {
    console.error("Error loading initial data:", error);
    // Optionally, display an error message to the user on the page
  }

  // 2. Perform initial full display update based on current time (live or test mode)
  refreshDisplayForCurrentTime();

  // 3. Set up periodic updates for live time (if not in test mode)
  setInterval(() => {
    const testModeSelect = document.getElementById('test-mode-select');
    if (!testModeSelect || !testModeSelect.value) { // Only run for live time
      console.log("Interval: Updating for live time.");
      refreshDisplayForCurrentTime();
    }
  }, 60000); // Every 60 seconds

  // 4. Event Listeners

  // Test Mode Changer
  document.getElementById('test-mode-select')?.addEventListener('change', () => {
    console.log("Test mode changed.");
    refreshDisplayForCurrentTime();
  });

  // Contact Menu Toggle
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('contact-menu')?.classList.toggle('show'); //
  });

  // Click outside to close Contact Menu
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('contact-menu');
    const toggle = document.getElementById('menu-toggle');
    // Check if menu and toggle exist before trying to access 'contains'
    if (menu && toggle && !menu.contains(event.target) && !toggle.contains(event.target)) {
      menu.classList.remove('show'); //
    }
  });

  // Manual Dark Mode Toggle
  document.getElementById('manual-dark-toggle')?.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-mode');
    const toggledTo = isDark ? 'light' : 'dark';
    const currentPref = getUserDarkModePreference();

    if (currentPref === toggledTo) {
      setUserDarkModePreference(null); // cancel override
    } else {
      setUserDarkModePreference(toggledTo); // set override
    }
    updateDarkMode(); // Apply the change immediately
  });

  // Initial Dark Mode setup (already called by refreshDisplayForCurrentTime, but can be explicit too)
  // updateDarkMode(); // This is already called by refreshDisplayForCurrentTime above

  console.log("Initialization complete.");
});


// ADD TO HOMESCREEN
const INSTALL_BANNER_DELAY = 3000; // in milliseconds (5 seconds)
const INSTALL_BANNER_KEY = 'install-banner-dismissed';

function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  if (!isMobileDevice()) return;
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner('android');
});

function showInstallBanner(type) {
  if (localStorage.getItem(INSTALL_BANNER_KEY)) return;

  setTimeout(() => {
    const banner = document.getElementById('install-banner');
    const text = document.getElementById('install-text');
    const button = document.getElementById('install-dismiss');

    if (type === 'ios') {
      text.textContent = '📲 To add this app to your home screen, tap the Share button and then "Add to Home Screen".';
    } else if (type === 'android') {
      text.innerHTML = '📲 Install this app to your home screen for quicker access. <button id="install-now">Install</button>';
    }

    banner.style.display = 'block';
    requestAnimationFrame(() => banner.classList.add('show'));

    button.onclick = () => {
      banner.style.display = 'none';
      localStorage.setItem(INSTALL_BANNER_KEY, 'true');
    };

    document.getElementById('install-now')?.addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => {
        banner.classList.remove('show');
        setTimeout(() => {
        banner.style.display = 'none';
        }, 400); // matches the transition duration
        localStorage.setItem(INSTALL_BANNER_KEY, 'true');
      });
    });
  }, INSTALL_BANNER_DELAY);
}

// iOS detection
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isInStandaloneMode = 'standalone' in window.navigator && window.navigator.standalone;

if (isMobileDevice() && isIOS && !isInStandaloneMode) {
  showInstallBanner('ios');
}