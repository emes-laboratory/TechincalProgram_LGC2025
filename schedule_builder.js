document.addEventListener('DOMContentLoaded', function () {
    const scheduleContainer = document.getElementById('schedule-container');
    const popover = document.getElementById('session-popover');
    let activeSession = null;

    // --- Main function to fetch data and build the schedule ---
    async function initializeSchedule() {
        try {
            // Using fetch. If you use the "No Server" method, see the alternative below.
            const response = await fetch('schedule_data.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            window.scheduleData = data; // Make data globally accessible
            
            buildGrid(data);
            addInteractivity();
            setupMobileView();
            window.addEventListener('resize', setupMobileView);

        } catch (error) {
            console.error("Could not load or build schedule:", error);
            scheduleContainer.innerHTML = `<p style="text-align:center; color:red;">Error loading schedule data. Please try again later.</p>`;
        }
    }

    // --- Helper function to calculate grid row based on time (Unchanged) ---
    const timeToRow = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const baseMinutes = 8 * 60 + 30;
        const currentMinutes = hours * 60 + minutes;
        const diffInHalfHours = (currentMinutes - baseMinutes) / 30;
        return 2 + (diffInHalfHours * 6);
    };

    // --- Helper function to format the details pop-up content (Unchanged) ---
    function formatDetails(session) {
        if (!session.details) return '';
        switch (session.details_type) {
            case 'presentations':
                return session.details.map(p => `• <b>${p.topic}</b>\n  <i>${p.presenter} (${p.affiliation})</i>`).join('\n\n');
            case 'panel':
                const moderator = `<b>Moderator:</b>\n  <i>${session.details.moderator.name} (${session.details.moderator.affiliation})</i>`;
                const panelists = session.details.panelists.map(p => `  - ${p.name} (${p.affiliation})`).join('\n');
                return `${moderator}\n\n<b>Panelists:</b>\n${panelists}`;
            case 'text': return session.details;
            default: return '';
        }
    }

    // --- Function to build the entire grid from data (Simplified) ---
    function buildGrid(data) {
        scheduleContainer.innerHTML = '';
        const dayHeaderContainer = document.createElement('div');
        dayHeaderContainer.className = 'grid-item day-label desktop-only';
        dayHeaderContainer.style.gridColumn = '1';
        scheduleContainer.appendChild(dayHeaderContainer);
        Object.values(data.day_columns).forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'grid-item day-label desktop-only';
            dayEl.style.gridColumn = `${day.start} / span ${day.span}`;
            dayEl.textContent = day.title;
            scheduleContainer.appendChild(dayEl);
        });
        data.time_slots.forEach(time => {
            const timeEl = document.createElement('div');
            timeEl.className = 'time-label';
            timeEl.style.gridRow = timeToRow(time);
            timeEl.textContent = time;
            scheduleContainer.appendChild(timeEl);
        });

        // Simplified session creation
        data.sessions.forEach(sessionData => {
            const sessionEl = document.createElement('div');
            sessionEl.className = `grid-item session type-${sessionData.type}`;
            sessionEl.style.gridColumn = `${sessionData.column} / span ${sessionData.span}`;
            sessionEl.style.gridRow = `${timeToRow(sessionData.startTime)} / ${timeToRow(sessionData.endTime)}`;
            sessionEl.dataset.day = sessionData.day;
            sessionEl.dataset.title = sessionData.title; // Store title for popover
            // Store details directly on the element
            sessionEl.dataset.details = formatDetails(sessionData); 
            sessionEl.innerHTML = sessionData.title; // Use innerHTML for <br>
            scheduleContainer.appendChild(sessionEl);
        });
    }

    // --- COMPLETELY NEW INTERACTIVITY LOGIC ---
    function addInteractivity() {
        const sessions = scheduleContainer.querySelectorAll('.session');

        sessions.forEach(session => {
            session.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent click from closing the popover immediately
                const details = session.dataset.details;
                if (!details.trim()) return; // Do nothing if no details

                if (activeSession === session) {
                    hidePopover();
                } else {
                    showPopover(session);
                }
            });
        });

        // Close popover if clicking anywhere else on the page
        document.addEventListener('click', (event) => {
            if (popover.style.display === 'block' && !popover.contains(event.target)) {
                hidePopover();
            }
        });
    }

    function showPopover(session) {
        // Deactivate previous session
        if (activeSession) {
            activeSession.classList.remove('active');
        }

        // Activate new session
        activeSession = session;
        activeSession.classList.add('active');
        
        // Populate popover content
        const title = session.dataset.title;
        const details = session.dataset.details;
        popover.innerHTML = `<div class="popover-title">${title}</div><div class="popover-content">${details}</div>`;

        // Position and show the popover
        positionPopover(session);
        popover.style.display = 'block';
    }

    function hidePopover() {
        if (activeSession) {
            activeSession.classList.remove('active');
            activeSession = null;
        }
        popover.style.display = 'none';
    }

    function positionPopover(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect(); // Note: may be 0 if newly shown
        const containerRect = scheduleContainer.getBoundingClientRect();

        // Temporarily display to measure its actual size
        popover.style.visibility = 'hidden';
        popover.style.display = 'block';
        const realPopoverWidth = popover.offsetWidth;
        const realPopoverHeight = popover.offsetHeight;
        popover.style.display = 'none';
        popover.style.visibility = 'visible';
        
        let top, left;
        const gap = 15; // Space between element and popover

        // Default position: above the element
        top = rect.top - realPopoverHeight - gap;
        left = rect.left + (rect.width / 2) - (realPopoverWidth / 2);
        popover.className = 'session-popover arrow-bottom'; // Arrow points down

        // If it goes off the top, place it below instead
        if (top < containerRect.top) {
            top = rect.bottom + gap;
            popover.className = 'session-popover arrow-top'; // Arrow points up
        }

        // If it goes off the left/right, adjust horizontal position
        if (left < containerRect.left) {
            left = containerRect.left + 5;
        }
        if (left + realPopoverWidth > containerRect.right) {
            left = containerRect.right - realPopoverWidth - 5;
        }
        
        // Apply final position relative to the viewport
        popover.style.top = `${top + window.scrollY}px`;
        popover.style.left = `${left + window.scrollX}px`;
    }

    // --- Mobile View Setup (Unchanged) ---
    function setupMobileView() {
        // This function remains the same as before
        if (window.innerWidth > 800) { if(scheduleContainer.dataset.view === 'desktop') return; scheduleContainer.dataset.view = 'desktop'; /* a bit more logic might be needed to restore from mobile if it was changed*/ return; }
        if (scheduleContainer.dataset.view === 'mobile') return;
        scheduleContainer.dataset.view = 'mobile';
        const sessions = Array.from(scheduleContainer.querySelectorAll('.session'));
        const dayHeadings = Object.values(window.scheduleData.day_columns).reduce((acc, curr, index) => { acc[index + 1] = curr.title; return acc; }, {});
        const days = {};
        sessions.forEach(session => { const day = session.getAttribute('data-day'); if (!days[day]) days[day] = []; days[day].push(session); });
        scheduleContainer.querySelectorAll('.desktop-only, .time-label').forEach(item => item.style.display = 'none');
        Object.keys(dayHeadings).sort().forEach(dayKey => {
            if (days[dayKey]) {
                const dayContainer = document.createElement('div');
                dayContainer.className = 'day-container';
                const header = document.createElement('div');
                header.className = 'day-header-mobile';
                header.textContent = dayHeadings[dayKey];
                dayContainer.appendChild(header);
                days[dayKey].forEach(session => dayContainer.appendChild(session));
                scheduleContainer.appendChild(dayContainer);
            }
        });
    }
    
    // Kick off the whole process
    initializeSchedule();
});