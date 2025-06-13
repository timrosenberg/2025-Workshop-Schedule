console.log("Script loaded");

let scheduleData = [];
let globalBannerData = {};

// Function to refresh all time-sensitive parts of the page
function refreshDisplayForCurrentTime() {
  console.log("NEW: refreshDisplayForCurrentTime called.");

  if (!scheduleData || scheduleData.length === 0) {
    console.warn("Schedule data not loaded yet, skipping refresh.");
    return;
  }

  // --- MODIFICATION START ---
  // 1. Before rebuilding, save the IDs of all currently open <details> elements.
  const openDetailsIds = new Set();
  document.querySelectorAll('#schedule-container details.day[open]').forEach(detailsEl => {
    if (detailsEl.id) {
      openDetailsIds.add(detailsEl.id);
    }
  });
  console.log("Preserving open sections:", openDetailsIds);
  // --- MODIFICATION END ---

  const currentTime = getCurrentTime();
  console.log("Effective current time for refresh:", currentTime.toString());

  // 2. Re-render the main schedule display. This wipes out the old elements.
  renderSchedule(scheduleData);
  console.log("Schedule re-rendered.");

  // --- MODIFICATION START ---
  // 3. Restore the open state for the elements that were open before.
  if (openDetailsIds.size > 0) {
    openDetailsIds.forEach(id => {
      const newDetailsEl = document.getElementById(id);
      if (newDetailsEl) {
        newDetailsEl.open = true;
      }
    });
    console.log("Restored open states.");
  } else {
    // If no sections were manually opened (e.g., on first page load),
    // default to opening the section for the current day.
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const dayNum = String(currentTime.getDate()).padStart(2, '0');
    const currentDateKey = `${year}-${month}-${dayNum}`;
    
    const currentDayDetails = document.getElementById(currentDateKey);
    if (currentDayDetails) {
      currentDayDetails.open = true;
      console.log(`Defaulting to open current day: ${currentDateKey}`);
    }
  }
  // --- MODIFICATION END ---


  // 4. Update "Now" and "Next" boxes.
  updateNowNextFromHiddenData();
  console.log("Now/Next boxes updated.");

  // 5. Update other UI elements.
  applyBanner();
  console.log("Banner applied.");
  updateDarkMode();
  console.log("Dark mode updated.");
  console.log("NEW: refreshDisplayForCurrentTime finished.");
}


/* const menu = document.getElementById('contact-menu'); */
/* menu.classList.add('hide'); */
/* console.log('Forced menu visible:', menu); */


async function loadSchedule() {
  const container = document.getElementById('schedule-container');
  if (!container) return; // Skip loading if not on a schedule page

  let schedulePath;
  
  // Look for the meta tag you added to the faculty page
  const pageTypeMeta = document.querySelector('meta[name="page-type"]');
  
  // Check if the tag exists and its content is 'faculty'
  if (pageTypeMeta && pageTypeMeta.content === 'faculty') {
    console.log("Faculty page detected via meta tag. Loading faculty schedule.");
    schedulePath = '/data/faculty-schedule.json';
  } else {
    console.log("Student page (or no meta tag found). Loading student schedule.");
    schedulePath = '/data/schedule.json';
  }

  try {
    const res = await fetch(schedulePath);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${schedulePath}: ${res.statusText}`);
    }
    const flatData = await res.json();
    scheduleData = groupFlatSchedule(flatData);
    renderSchedule(scheduleData);
  } catch (error) {
    console.error("Error loading schedule data:", error);
    container.innerHTML = `<p style="color: red; text-align: center;">Could not load the schedule. Please try again later.</p>`;
  }
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
    // This loop robustly handles cases with up to 5 subpoints (for faculty)
    // or fewer (for students) without error.
    for (let i = 1; i <= 5; i++) {
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

    console.log(`[UpdateNowNext] Running for effective time: ${now.toString()} (Today's Date String: ${todayDateString})`);

    const currentActivityEl = document.getElementById('current-activity');
    const nextActivityEl = document.getElementById('next-activity');

    currentActivityEl.innerHTML = '⌛ No current activity';
    currentActivityEl.removeAttribute('href'); currentActivityEl.onclick = null;
    nextActivityEl.innerHTML = '⏭️ Nothing upcoming';
    nextActivityEl.removeAttribute('href'); nextActivityEl.onclick = null;

    let foundNowActivity = null;        // Stores the true "Now" activity if one exists
    let nowActivityDayDetails = null;   // Stores the day object for foundNowActivity

    let firstFutureOfToday = null;      // Stores the first upcoming activity of today if no true "Now"
    let firstFutureOfToday_DayDetails = null;
    let firstFutureOfToday_IndexInActivities = -1;


    const todayIndexInSchedule = scheduleData.findIndex(day => day.date === todayDateString);

    // --- Phase 1: Process today's schedule: Find true "Now" and "firstFutureOfToday" ---
    if (todayIndexInSchedule !== -1) {
        const currentDayData = scheduleData[todayIndexInSchedule];
        console.log(`[UpdateNowNext] Phase 1: Processing day: ${currentDayData.date} which has ${currentDayData.activities.length} activities.`);
        
        for (let i = 0; i < currentDayData.activities.length; i++) {
            const activity = currentDayData.activities[i];
            const [year, month, dayVal] = currentDayData.date.split('-').map(Number);
            const activitysActualDate = new Date(year, month - 1, dayVal);

            // ***** START OF CORRECTED TIME PARSING BLOCK *****
            let parsedStartStr;
            let parsedEndStr;
            const timeActivityStr = activity.time || "";
            const timeParts = timeActivityStr.split('-').map(t => t.trim());
            const isOriginalRange = timeParts.length > 1;

            parsedStartStr = timeParts[0];
            if (isOriginalRange) {
                parsedEndStr = timeParts[1];
            } else {
                parsedEndStr = parsedStartStr; 
            }

            if (isOriginalRange) {
                const startHasAmPm = /\s(AM|PM)$/i.test(parsedStartStr);
                const endHasAmPm = /\s(AM|PM)$/i.test(parsedEndStr);

                if (!startHasAmPm && endHasAmPm) {
                    const modifier = parsedEndStr.match(/\s(AM|PM)$/i)[0];
                    parsedStartStr += modifier;
                } else if (startHasAmPm && !endHasAmPm) {
                     const modifier = parsedStartStr.match(/\s(AM|PM)$/i)[0];
                     parsedEndStr += modifier;
                }
            }
            const isSinglePoint = !isOriginalRange;
            // ***** END OF CORRECTED TIME PARSING BLOCK *****

            const startTime = parseTime(parsedStartStr, activitysActualDate);
            let endTime = parseTime(parsedEndStr, activitysActualDate);

            if (isSinglePoint && startTime) {
                endTime = new Date(startTime.getTime() + 60000); 
            }

            // ---- DETAILED LOGS (Keep these for now) ----
            console.log(`  [UpdateNowNext P1] Checking Activity: "${activity.title}" (Time string: "${activity.time}")`);
            console.log(`    Raw parsedStartStr: "${parsedStartStr}", Raw parsedEndStr: "${parsedEndStr}"`);
            console.log(`    Parsed startTime: ${startTime ? startTime.toString() : 'null'} (value: ${startTime ? startTime.getTime() : 'N/A'})`);
            console.log(`    Parsed endTime:   ${endTime ? endTime.toString() : 'null'} (value: ${endTime ? endTime.getTime() : 'N/A'})`);
            console.log(`    Current 'now':    ${now.toString()} (value: ${now.getTime()})`);
            if (startTime && endTime) {
                console.log(`    Comparison for "Now": (now >= startTime) -> (${now.getTime()} >= ${startTime.getTime()}) is ${now >= startTime}`);
                console.log(`    Comparison for "Now": (now < endTime)   -> (${now.getTime()} < ${endTime.getTime()}) is ${now < endTime}`);
            }
            // ---- END OF DETAILED LOGS ----

            if (!foundNowActivity && startTime && endTime && now >= startTime && now < endTime) {
                console.log(`  [UpdateNowNext P1] FOUND "Now" Activity: "${activity.title}"`);
                foundNowActivity = activity;
                nowActivityDayDetails = currentDayData; 
                // We'll determine "Next" for this foundNowActivity later.
                break; 
            }

            if (!foundNowActivity && startTime && now < startTime) { // Activity is in the future
                if (!firstFutureOfToday) { // Capture the very first future activity of today
                    console.log(`  [UpdateNowNext P1] Found first future activity of today: "${activity.title}"`);
                    firstFutureOfToday = activity;
                    firstFutureOfToday_DayDetails = currentDayData;
                    firstFutureOfToday_IndexInActivities = i;
                    // Do not break; continue to check if a later activity is "Now"
                }
            }
        }
        console.log(`[UpdateNowNext] After Phase 1: foundNowActivity is ${foundNowActivity ? `"${foundNowActivity.title}"` : 'null'}, firstFutureOfToday is ${firstFutureOfToday ? `"${firstFutureOfToday.title}"` : 'null'}`);
    } else {
        console.log(`[UpdateNowNext] Phase 1: No schedule found for today: ${todayDateString}`);
    }

    // --- NEW DECISION LOGIC: Determine what to display in "Now" and "Next" boxes ---
    let activityToDisplayAsNow = null;
    let dayToDisplayAsNow = null;
    let activityToDisplayAsNext = null;
    let dayToDisplayAsNext = null;

    if (foundNowActivity) { // Case 1: A true "Now" activity was found
        console.log(`[UpdateNowNext Decision] Using true "Now": "${foundNowActivity.title}"`);
        activityToDisplayAsNow = foundNowActivity;
        dayToDisplayAsNow = nowActivityDayDetails;

        const nowIndex = nowActivityDayDetails.activities.indexOf(foundNowActivity);
        if (nowIndex !== -1 && nowIndex + 1 < nowActivityDayDetails.activities.length) {
            activityToDisplayAsNext = nowActivityDayDetails.activities[nowIndex + 1];
            dayToDisplayAsNext = nowActivityDayDetails;
        }
    } else if (firstFutureOfToday) { // Case 2: No true "Now", use today's first future event for "Now" box
        console.log(`[UpdateNowNext Decision] In-between case: Promoting "${firstFutureOfToday.title}" to "Now" box.`);
        activityToDisplayAsNow = firstFutureOfToday;
        dayToDisplayAsNow = firstFutureOfToday_DayDetails;

        if (firstFutureOfToday_IndexInActivities !== -1 && firstFutureOfToday_IndexInActivities + 1 < firstFutureOfToday_DayDetails.activities.length) {
            activityToDisplayAsNext = firstFutureOfToday_DayDetails.activities[firstFutureOfToday_IndexInActivities + 1];
            dayToDisplayAsNext = firstFutureOfToday_DayDetails;
        }
    } else {
        // Case 3: No "Now" and no future activities on today.
        // Both activityToDisplayAsNow and activityToDisplayAsNext remain null.
        // Phase 2 will try to populate activityToDisplayAsNow first, then activityToDisplayAsNext.
        console.log("[UpdateNowNext Decision] No 'Now' or future 'Next' for today. Phase 2 will determine both.");
    }
    
    console.log(`[UpdateNowNext Decision] After initial decision: DisplayAsNow='${activityToDisplayAsNow?.title}', DisplayAsNext='${activityToDisplayAsNext?.title}'`);

    // --- Phase 2: If activityToDisplayAsNext is still null (or if activityToDisplayAsNow is also null), find from subsequent days ---
    if (!activityToDisplayAsNow || !activityToDisplayAsNext) {
        console.log(`[UpdateNowNext Phase 2] Entering Phase 2. Current displayAsNow: '${activityToDisplayAsNow?.title}', displayAsNext: '${activityToDisplayAsNext?.title}'`);
        let searchStartDayIndex = 0;

        if (dayToDisplayAsNow) { // If "Now" box is set (could be today's last, or today is done)
            const lastProcessedDayIndex = scheduleData.findIndex(d => d.date === dayToDisplayAsNow.date);
            searchStartDayIndex = (lastProcessedDayIndex !== -1) ? lastProcessedDayIndex + 1 : 0;
            if (!activityToDisplayAsNext) { // Only need to find "Next"
                 console.log(`  [UpdateNowNext P2] 'activityToDisplayAsNow' ("${activityToDisplayAsNow?.title}") is set. Searching for 'activityToDisplayAsNext' starting from day index ${searchStartDayIndex}.`);
            }
        } else { // No "Now" set from today, find first available for "Now" and then "Next"
            const firstRelevantDayIndex = scheduleData.findIndex(d => d.date >= todayDateString);
            searchStartDayIndex = (firstRelevantDayIndex !== -1) ? firstRelevantDayIndex : scheduleData.length;
            console.log(`  [UpdateNowNext P2] 'activityToDisplayAsNow' is not set. Searching for both 'Now' and 'Next' starting from day index ${searchStartDayIndex} (Date: ${scheduleData[searchStartDayIndex]?.date}).`);
        }

        for (let i = searchStartDayIndex; i < scheduleData.length; i++) {
            const day = scheduleData[i];
            if (day.activities && day.activities.length > 0) {
                console.log(`  [UpdateNowNext P2] Checking day ${day.date}.`);
                if (!activityToDisplayAsNow) { // If "Now" is still not determined
                    activityToDisplayAsNow = day.activities[0];
                    dayToDisplayAsNow = day;
                    console.log(`    [UpdateNowNext P2] SET 'activityToDisplayAsNow' to (first of day ${day.date}): "${activityToDisplayAsNow.title}"`);
                    if (day.activities.length > 1) { // If there's a second activity on this same day for "Next"
                        activityToDisplayAsNext = day.activities[1];
                        dayToDisplayAsNext = day;
                        console.log(`    [UpdateNowNext P2] SET 'activityToDisplayAsNext' to (second of day ${day.date}): "${activityToDisplayAsNext.title}"`);
                    }
                    // If we set "Now", we've done the main job for this iteration unless "Next" also needs to come from a *different* future day
                    if (activityToDisplayAsNext || day.activities.length === 1) break; 
                } else if (!activityToDisplayAsNext) { // "Now" was set (possibly end of its day), this is "Next"
                    activityToDisplayAsNext = day.activities[0];
                    dayToDisplayAsNext = day;
                    console.log(`    [UpdateNowNext P2] SET 'activityToDisplayAsNext' to (first of day ${day.date}): "${activityToDisplayAsNext.title}"`);
                    break; 
                }
            }
            if (activityToDisplayAsNow && activityToDisplayAsNext) break;
        }
        console.log(`[UpdateNowNext] After Phase 2: DisplayAsNow='${activityToDisplayAsNow?.title}', DisplayAsNext='${activityToDisplayAsNext?.title}'`);
    }


    // --- Phase 3: Update DOM elements ---
    if (activityToDisplayAsNow && dayToDisplayAsNow) {
        const anchorId = `activity-${dayToDisplayAsNow.date}-${activityToDisplayAsNow.time.replace(/[^a-zA-Z0-9]/g, '')}`;
        currentActivityEl.innerHTML = `<a href="#${anchorId}">⌛ ${activityToDisplayAsNow.time}: ${activityToDisplayAsNow.title}</a>`;
        addClickAndScroll(currentActivityEl, anchorId, dayToDisplayAsNow.date);
    } else {
        // Default already set: currentActivityEl.innerHTML = '⌛ No current activity';
    }

    if (activityToDisplayAsNext && dayToDisplayAsNext) {
        const anchorId = `activity-${dayToDisplayAsNext.date}-${activityToDisplayAsNext.time.replace(/[^a-zA-Z0-9]/g, '')}`;
        let nextText = `⏭️ ${activityToDisplayAsNext.time}`;
        if (dayToDisplayAsNext.date !== todayDateString) { // Show date if "Next" is not on "today"
             // Also, if "Now" is displayed from a future day, and "Next" is on that SAME future day, we might not need the date.
             // More precise: show date for "Next" if its day is different from the day shown/implied for "Now".
            if (!dayToDisplayAsNow || dayToDisplayAsNext.date !== dayToDisplayAsNow.date) {
                 nextText += ` (${formatDateShort(dayToDisplayAsNext.date)})`;
            }
        }
        nextText += `: ${activityToDisplayAsNext.title}`;
        nextActivityEl.innerHTML = `<a href="#${anchorId}">${nextText}</a>`;
        addClickAndScroll(nextActivityEl, anchorId, dayToDisplayAsNext.date);
    } else {
        // Default already set: nextActivityEl.innerHTML = '⏭️ Nothing upcoming';
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

// FOOTER FETCHER
fetch('/includes/footer.html')
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

  // Find the theme-color meta tag
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  
  // Only proceed if the tag exists and this is the faculty page
  if (themeColorMeta && document.querySelector('meta[name="page-type"]')?.content === 'faculty') {
    if (isDark) {
      // Set the color to match the faculty dark mode header
      themeColorMeta.content = '#333333';
    } else {
      // Set the color for light mode
      themeColorMeta.content = '#555555';
    }
  }
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

// A single, unified listener to set up the entire page.
document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM fully loaded. Initializing application...");

  // --- 1. Handle all dynamic content includes first ---
  // We wait for all includes to finish before we do anything else.
  const includePromises = Array.from(document.querySelectorAll("[data-include]")).map(async (el) => {
    const file = el.getAttribute("data-include");
    if (!file) return;

    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Failed to load ${file}`);
      const content = await res.text();
      el.innerHTML = content;

      // If this was the nav menu, attach its specific listener right away.
      if (file.includes('nav-faculty.html') || file.includes('nav.html')) {
        const hamburger = el.querySelector('.hamburger');
        const navLinks = el.querySelector('.nav-links');
        if (hamburger && navLinks) {
          hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.classList.toggle('active');
          });
          console.log("Navigation menu listener attached successfully.");
        }
      }
    } catch (err) {
      console.error(err);
      el.innerHTML = `<p style="color:red;">Error loading ${file}</p>`;
    }
  });

  await Promise.all(includePromises);
  console.log("All dynamic content has been loaded.");

  // --- 2. Attach all other main event listeners ---
  // Contact Menu Toggle
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('contact-menu')?.classList.toggle('show');
  });

  // Click outside to close Contact Menu
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('contact-menu');
    const toggle = document.getElementById('menu-toggle');
    if (menu && toggle && !menu.contains(event.target) && !toggle.contains(event.target)) {
      menu.classList.remove('show');
    }
  });

  // Manual Dark Mode Toggle
  document.getElementById('manual-dark-toggle')?.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-mode');
    const toggledTo = isDark ? 'light' : 'dark';
    const currentPref = getUserDarkModePreference();
    if (currentPref === toggledTo) {
      setUserDarkModePreference(null);
    } else {
      setUserDarkModePreference(toggledTo);
    }
    updateDarkMode();
  });

  // Test Mode Changer
  document.getElementById('test-mode-select')?.addEventListener('change', () => {
    console.log("Test mode changed.");
    refreshDisplayForCurrentTime();
  });
  
  console.log("All main event listeners attached.");

  // --- 3. Load page-specific data and perform initial render ---
  try {
    // The loadSchedule function has a guard clause, so it's safe to call on any page.
    await loadSchedule(); 

    // The banners.json is small, so we can fetch it on all pages.
    const bannerRes = await fetch('/data/banners.json');
    globalBannerData = await bannerRes.json();
  } catch (error) {
    console.error("Error loading initial data:", error);
  }

  // Perform initial full display update based on the data we just loaded.
  refreshDisplayForCurrentTime();

  // --- 4. Set up periodic updates ---
  setInterval(() => {
    const testModeSelect = document.getElementById('test-mode-select');
    if (!testModeSelect || !testModeSelect.value) { // Only run for live time
      console.log("Interval: Updating for live time.");
      refreshDisplayForCurrentTime();
    }
  }, 60000);

  console.log("Page initialization complete.");
});


// ADD TO HOMESCREEN
const INSTALL_BANNER_DELAY = 2000; // in milliseconds (5 seconds)
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
  // These constants should be defined globally in your script.js or passed in.
  // const INSTALL_BANNER_KEY = 'install-banner-dismissed';
  // const INSTALL_BANNER_DELAY = 3000; // example delay
  // let deferredPrompt; // Should be a global variable, set by 'beforeinstallprompt'

  if (localStorage.getItem(INSTALL_BANNER_KEY)) {
    console.log('[InstallBanner] Banner previously dismissed by user.');
    return;
  }

  setTimeout(() => {
    const banner = document.getElementById('install-banner');
    const textElement = document.getElementById('install-text'); 
    const buttonsContainer = document.getElementById('install-banner-buttons');
    const dismissButton = document.getElementById('install-dismiss');

    if (!banner || !textElement || !buttonsContainer || !dismissButton) {
        console.error('[InstallBanner] One or more required HTML elements for the banner were not found. Cannot display banner.');
        return;
    }
    console.log('[InstallBanner] Attempting to show banner of type:', type);

    // Clear previous dynamic "Install" button if it exists, to prevent duplicates
    const existingInstallButton = document.getElementById('install-now');
    if (existingInstallButton) {
        existingInstallButton.remove();
    }

    if (type === 'ios') {
      textElement.textContent = '📲 To add this app to your home screen, tap the Share button and then "Add to Home Screen".';
    } else if (type === 'android' && window.deferredPrompt) { // Check if deferredPrompt is available
      textElement.textContent = '📲 Install this app to your home screen for quicker access.';
      const installButton = document.createElement('button');
      installButton.id = 'install-now';
      installButton.textContent = 'Install';
      // Insert "Install" button before "Dismiss" button within the buttons container
      buttonsContainer.insertBefore(installButton, dismissButton); 

      installButton.addEventListener('click', () => {
        if (window.deferredPrompt) {
          window.deferredPrompt.prompt();
          window.deferredPrompt.userChoice.finally(() => {
            banner.classList.remove('show'); // Hide by sliding out
            setTimeout(() => {
              banner.style.display = 'none'; // Then set display none after transition
            }, 400); // Should match your CSS transition duration for the transform
            localStorage.setItem(INSTALL_BANNER_KEY, 'true');
            window.deferredPrompt = null; // Clear the prompt as it can only be used once
            console.log('[InstallBanner] Android install prompt shown or choice made.');
          });
        }
      });
    } else if (type === 'android' && !window.deferredPrompt) {
        console.log('[InstallBanner] Android type, but deferredPrompt not available. Not showing install button.');
        textElement.textContent = '📲 For quick access, you can add this site to your home screen via your browser menu.';
    }


    // Setup dismiss button action
    dismissButton.onclick = () => { 
      banner.classList.remove('show'); // Hide by sliding out
      setTimeout(() => {
        banner.style.display = 'none'; // Then set display none after transition
      }, 400); 
      localStorage.setItem(INSTALL_BANNER_KEY, 'true');
      console.log('[InstallBanner] Banner dismissed by user via dismiss button.');
    };

    // Actually show the banner
    banner.style.display = 'block'; // Make it part of the layout
    requestAnimationFrame(() => { // Ensures display:block is applied before class change for transition
      banner.classList.add('show'); // Then slide it in by adding 'show' class
      console.log('[InstallBanner] Banner display initiated.');
    });

  }, INSTALL_BANNER_DELAY);
}

// iOS detection
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isInStandaloneMode = 'standalone' in window.navigator && window.navigator.standalone;

if (isMobileDevice() && isIOS && !isInStandaloneMode) {
  showInstallBanner('ios');
}