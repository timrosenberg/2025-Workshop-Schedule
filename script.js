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
    details.id = day.date;

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
    const todayDateString = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Log entry into function and the effective time
    console.log(`[UpdateNowNext] Running for effective time: ${now.toString()} (Today's Date String: ${todayDateString})`);

    const currentActivityEl = document.getElementById('current-activity');
    const nextActivityEl = document.getElementById('next-activity');

    // Set default states
    currentActivityEl.innerHTML = '⌛ No current activity';
    currentActivityEl.removeAttribute('href');
    currentActivityEl.onclick = null;
    nextActivityEl.innerHTML = '⏭️ Nothing upcoming';
    nextActivityEl.removeAttribute('href');
    nextActivityEl.onclick = null;

    let foundNowActivity = null;
    let nowActivityDayDetails = null;
    let nextActivityForDisplay = null;
    let nextActivityDayDetails = null;

    const todayIndexInSchedule = scheduleData.findIndex(day => day.date === todayDateString);

    // --- Phase 1: Process today's schedule (if it exists) ---
    if (todayIndexInSchedule !== -1) {
        const currentDayData = scheduleData[todayIndexInSchedule];
        console.log(`[UpdateNowNext] Phase 1: Processing day: ${currentDayData.date} which has ${currentDayData.activities.length} activities.`);
        
        for (let i = 0; i < currentDayData.activities.length; i++) {
            const activity = currentDayData.activities[i];
            // Use the actual date of the activity for parsing its times
            const [year, month, dayVal] = currentDayData.date.split('-').map(Number);
            // JavaScript months are 0-indexed (0 for January, 1 for February, etc.)
            const activitysActualDate = new Date(year, month - 1, dayVal);

            let [startStr, endStr] = (activity.time || '').split('-').map(t => t && t.trim());
            const isSinglePoint = !endStr;
            if (isSinglePoint) endStr = startStr;

            const startTime = parseTime(startStr, activitysActualDate);
            let endTime = parseTime(endStr, activitysActualDate);

            if (isSinglePoint && startTime) { // Single point events effectively last 1 minute for "Now" check
                endTime = new Date(startTime.getTime() + 60000); 
            }

            // ---- DETAILED LOGS FOR EACH ACTIVITY ----
            console.log(`  [UpdateNowNext P1] Checking Activity: "${activity.title}" (Time string: "${activity.time}")`);
            console.log(`    Parsed startTime: ${startTime ? startTime.toString() : 'null'} (value: ${startTime ? startTime.getTime() : 'N/A'})`);
            console.log(`    Parsed endTime:   ${endTime ? endTime.toString() : 'null'} (value: ${endTime ? endTime.getTime() : 'N/A'})`);
            console.log(`    Current 'now':    ${now.toString()} (value: ${now.getTime()})`);
            if (startTime && endTime) {
                console.log(`    Comparison for "Now": (now >= startTime) -> (${now.getTime()} >= ${startTime.getTime()}) is ${now >= startTime}`);
                console.log(`    Comparison for "Now": (now < endTime)   -> (${now.getTime()} < ${endTime.getTime()}) is ${now < endTime}`);
            }
            // ---- END OF DETAILED LOGS ----

            // Check if this activity is "Now"
            if (!foundNowActivity && startTime && endTime && now >= startTime && now < endTime) {
                console.log(`  [UpdateNowNext P1] FOUND "Now" Activity: "${activity.title}"`);
                foundNowActivity = activity;
                nowActivityDayDetails = currentDayData; 
                
                if (i + 1 < currentDayData.activities.length) {
                    nextActivityForDisplay = currentDayData.activities[i + 1];
                    nextActivityDayDetails = currentDayData;
                    console.log(`    [UpdateNowNext P1] Set "Next" (same day) to: "${nextActivityForDisplay.title}"`);
                } else {
                    console.log(`    [UpdateNowNext P1] "Now" is the last activity of the day. 'nextActivityForDisplay' remains null for Phase 1.`);
                }
                break; // Found "Now", and its immediate successor today if any.
            }

            // If not "Now", and "Now" hasn't been found yet, check if this is a future activity for "Next"
            if (!foundNowActivity && startTime && now < startTime) {
                console.log(`  [UpdateNowNext P1] Considering for "Next" (today): "${activity.title}" because now < startTime`);
                if (!nextActivityForDisplay) { 
                    nextActivityForDisplay = activity;
                    nextActivityDayDetails = currentDayData;
                    console.log(`    [UpdateNowNext P1] SET "Next" (today) to: "${activity.title}"`);
                }
            }
        }
        console.log(`[UpdateNowNext] After Phase 1 (today's activities): foundNowActivity is ${foundNowActivity ? `"${foundNowActivity.title}"` : 'null'}, nextActivityForDisplay is ${nextActivityForDisplay ? `"${nextActivityForDisplay.title}" on ${nextActivityDayDetails?.date}` : 'null'}`);
    } else {
        console.log(`[UpdateNowNext] Phase 1: No schedule found for today: ${todayDateString}`);
    }

    // --- Phase 2: If "Next" is still not found, look for the first activity of a subsequent day ---
    if (!nextActivityForDisplay) {
        console.log("[UpdateNowNext] Phase 2: 'nextActivityForDisplay' is null after Phase 1. Looking for next available day's activity.");
        let startIndexForNextDaySearch = 0;

        if (todayIndexInSchedule !== -1) { // If today *was* in the schedule (even if no suitable "Next" was found on it)
            startIndexForNextDaySearch = todayIndexInSchedule + 1;
            console.log(`  [UpdateNowNext P2] Today (${todayDateString}) was in schedule. Starting search for next day's events from schedule index ${startIndexForNextDaySearch}.`);
        } else { // Today was not in the schedule at all
            const firstUpcomingDayIndex = scheduleData.findIndex(day => day.date >= todayDateString);
            if (firstUpcomingDayIndex !== -1) {
                startIndexForNextDaySearch = firstUpcomingDayIndex;
                console.log(`  [UpdateNowNext P2] Today (${todayDateString}) not in schedule. Starting search from first relevant day index ${startIndexForNextDaySearch} (Date: ${scheduleData[startIndexForNextDaySearch]?.date}).`);
            } else { // No days in schedule are today or in the future
                startIndexForNextDaySearch = scheduleData.length; 
                console.log(`  [UpdateNowNext P2] No upcoming days found in schedule (today is ${todayDateString}).`);
            }
        }

        for (let i = startIndexForNextDaySearch; i < scheduleData.length; i++) {
            const day = scheduleData[i];
            console.log(`  [UpdateNowNext P2] Checking day ${day.date} at index ${i}.`);
            
            // This case is for when today wasn't in scheduleData, or today had no 'Now' and no future 'Next'.
            // We are looking for the very first activity from 'now' onwards on this 'day'.
            if (day.date === todayDateString && !foundNowActivity) { 
                 console.log(`    [UpdateNowNext P2] Re-checking activities for ${day.date} as it's effectively 'today' and no 'Now' was found.`);
                const activitysActualDate = new Date(day.date + "T00:00:00Z");
                for (const act of day.activities) {
                    const startTime = parseTime(act.time.split(' - ')[0], activitysActualDate);
                    if (startTime && now < startTime) { // If activity is in the future from 'now'
                        nextActivityForDisplay = act;
                        nextActivityDayDetails = day;
                        console.log(`    [UpdateNowNext P2] SET "Next" to (from today's future events): "${act.title}" on ${day.date}`);
                        break; 
                    }
                }
            } else if (day.date > todayDateString || (day.date === todayDateString && !foundNowActivity)) {
                 // If it's a future day OR it's today but we haven't found a "Now" yet (implying we are looking for the first possible "Next")
                 if (day.activities && day.activities.length > 0) {
                    if (day.date > todayDateString) { // Strictly future day
                        nextActivityForDisplay = day.activities[0]; 
                        nextActivityDayDetails = day;
                        console.log(`    [UpdateNowNext P2] SET "Next" to (first of future day): "${nextActivityForDisplay.title}" on ${day.date}`);
                    } else { // Still today, find first future if not already found
                        const activitysActualDate = new Date(day.date + "T00:00:00Z");
                        for (const act of day.activities) {
                            const startTime = parseTime(act.time.split(' - ')[0], activitysActualDate);
                            if (startTime && now < startTime) {
                                nextActivityForDisplay = act;
                                nextActivityDayDetails = day;
                                console.log(`    [UpdateNowNext P2] SET "Next" to (first future of today): "${act.title}" on ${day.date}`);
                                break; 
                            }
                        }
                    }
                 } else {
                     console.log(`    [UpdateNowNext P2] Day ${day.date} has no activities.`);
                 }
            }
            if (nextActivityForDisplay) break; 
        }
         console.log(`[UpdateNowNext] After Phase 2: nextActivityForDisplay is ${nextActivityForDisplay ? `"${nextActivityForDisplay.title}" on ${nextActivityDayDetails?.date}` : 'null'}`);
    }

    // --- Phase 3: Update DOM elements ---
    if (foundNowActivity && nowActivityDayDetails) {
        const anchorId = `activity-${nowActivityDayDetails.date}-${foundNowActivity.time.replace(/[^a-zA-Z0-9]/g, '')}`;
        currentActivityEl.innerHTML = `<a href="#${anchorId}">⌛ ${foundNowActivity.time} — ${foundNowActivity.title}</a>`;
        addClickAndScroll(currentActivityEl, anchorId, nowActivityDayDetails.date);
    } else {
        // currentActivityEl already set to default
    }

    if (nextActivityForDisplay && nextActivityDayDetails) {
        const anchorId = `activity-${nextActivityDayDetails.date}-${nextActivityForDisplay.time.replace(/[^a-zA-Z0-9]/g, '')}`;
        let nextText = `⏭️ ${nextActivityForDisplay.time}`;
        if (nextActivityDayDetails.date !== todayDateString) {
            nextText += ` (${formatDateShort(nextActivityDayDetails.date)})`;
        }
        nextText += ` — ${nextActivityForDisplay.title}`;
        nextActivityEl.innerHTML = `<a href="#${anchorId}">${nextText}</a>`;
        addClickAndScroll(nextActivityEl, anchorId, nextActivityDayDetails.date);
    } else {
        // nextActivityEl already set to default
    }
    console.log("[UpdateNowNext] Finished updating DOM elements.");
}


function formatDateShort(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day)); 
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

function addClickAndScroll(element, anchorId, activityDateKey) {
  const link = element.querySelector('a');
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const elToScroll = document.getElementById(anchorId);
      if (elToScroll) {
        document.querySelectorAll('details.day').forEach(detailsEl => {
          if (detailsEl.id === activityDateKey) {
            if (!detailsEl.open) detailsEl.open = true;
          }
        });
        setTimeout(() => {
            elToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
            elToScroll.classList.add('blink-highlight');
            setTimeout(() => elToScroll.classList.remove('blink-highlight'), 800);
            setTimeout(() => elToScroll.classList.add('blink-highlight'), 1400);
            setTimeout(() => elToScroll.classList.remove('blink-highlight'), 2200);
        }, 50); 
      }
    });
  }
}

function parseTime(timeStr, refDateForDay) {
  if (!timeStr) return null;

  // Create a new Date object using the YEAR, MONTH, and DAY from refDateForDay.
  // This ensures the date part is correct before setting the time.
  const date = new Date(refDateForDay.getFullYear(), refDateForDay.getMonth(), refDateForDay.getDate());

  const parts = timeStr.split(' '); // e.g., ["8:30", "AM"] or ["10:00", "PM"]
  const timeParts = parts[0].split(':');
  let hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10) || 0;
  const modifier = parts[1] ? parts[1].toLowerCase() : '';

  if (modifier.includes('pm') && hours < 12) {
    hours += 12;
  }
  if (modifier.includes('am') && hours === 12) { // 12 AM is midnight (0 hours)
    hours = 0;
  }

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