document.addEventListener('DOMContentLoaded', function () {
    const scheduleContainer = document.getElementById('schedule-container');
    const popover = document.getElementById('session-popover');
    const overlay = document.getElementById('popover-overlay');
    
    let activeSession = null;
    let scheduleData = null;
    let timeToRowMap = {}; 

    async function initializeSchedule() {
        try {
            const response = await fetch('schedule_data.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            scheduleData = await response.json();
            
            const allTimes = new Set(scheduleData.time_slots);
            scheduleData.sessions.forEach(session => {
                allTimes.add(session.startTime);
                allTimes.add(session.endTime);
            });
            scheduleData.time_slots = Array.from(allTimes).sort();
            scheduleData.time_slots.forEach((time, index) => { timeToRowMap[time] = index + 2; });

            handleResize();
            window.addEventListener('resize', handleResize);
        } catch (error) {
            console.error("Could not load or build schedule:", error);
            scheduleContainer.innerHTML = `<p style="text-align:center; color:red;">Error loading schedule data.</p>`;
        }
    }

    function formatDetails(session) {
        if (!session.details) return 'Details coming soon.';
        if (session.details_type === 'text' && typeof session.details === 'string' && session.details.trim() === "") return 'Details coming soon.';
        if (session.details_type === 'presentations' && Array.isArray(session.details) && session.details.length === 0) return 'Details coming soon.';
        switch (session.details_type) {
            case 'presentations': return session.details.map(p => `• <b>${p.topic}</b>\n  <i>${p.presenter} (${p.affiliation})</i>`).join('\n\n');
            case 'panel':
                if (!session.details.moderator || !session.details.panelists) return 'Panel details coming soon.';
                const moderator = `<b>Moderator:</b>\n  <i>${session.details.moderator.name} (${session.details.moderator.affiliation})</i>`;
                const panelists = session.details.panelists.map(p => `  - ${p.name} (${p.affiliation})`).join('\n');
                return `${moderator}\n\n<b>Panelists:</b>\n${panelists}`;
            case 'text': return session.details;
            default: return 'Details coming soon.';
        }
    }

    function buildDesktopView() {
        scheduleContainer.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'schedule-grid';
        Object.values(scheduleData.day_columns).forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'grid-item day-label';
            dayEl.style.gridColumn = `${day.start} / span ${day.span}`;
            dayEl.textContent = day.title;
            grid.appendChild(dayEl);
        });
        scheduleData.time_slots.forEach(time => {
            const timeEl = document.createElement('div');
            timeEl.className = 'grid-item time-label';
            timeEl.style.gridRow = timeToRowMap[time];
            timeEl.textContent = time;
            grid.appendChild(timeEl);
        });
        scheduleData.sessions.forEach(sessionData => {
            const sessionEl = document.createElement('div');
            sessionEl.className = `grid-item session type-${sessionData.type}`;
            sessionEl.style.gridColumn = `${sessionData.column} / span ${sessionData.span}`;
            const startRow = timeToRowMap[sessionData.startTime];
            const endRow = timeToRowMap[sessionData.endTime];
            if (!startRow || !endRow) return;
            sessionEl.style.gridRow = `${startRow} / ${endRow}`;
            sessionEl.innerHTML = sessionData.title;
            sessionEl.setAttribute('tabindex', '0');
            sessionEl.dataset.title = sessionData.title;
            sessionEl.dataset.details = formatDetails(sessionData);
            grid.appendChild(sessionEl);
        });
        scheduleContainer.appendChild(grid);
        addInteractivity();
    }
    
    function buildMobileView() {
        scheduleContainer.innerHTML = '';
        const mobileContainer = document.createElement('div');
        mobileContainer.className = 'schedule-grid mobile-view';
        const sessionsByDay = {};
        scheduleData.sessions.forEach(session => {
            if (!sessionsByDay[session.day]) sessionsByDay[session.day] = [];
            sessionsByDay[session.day].push(session);
        });
        Object.keys(sessionsByDay).sort().forEach(dayKey => {
            const header = document.createElement('div');
            header.className = 'day-header-mobile';
            header.textContent = scheduleData.day_columns[dayKey]?.title || `Day ${dayKey}`;
            mobileContainer.appendChild(header);
            sessionsByDay[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach(sessionData => {
                const sessionEl = document.createElement('div');
                sessionEl.className = `session type-${sessionData.type}`;
                sessionEl.innerHTML = `<b>${sessionData.startTime} - ${sessionData.endTime}</b><br>${sessionData.title}`;
                sessionEl.setAttribute('tabindex', '0');
                sessionEl.dataset.title = sessionData.title;
                sessionEl.dataset.details = formatDetails(sessionData);
                mobileContainer.appendChild(sessionEl);
            });
        });
        scheduleContainer.appendChild(mobileContainer);
        addInteractivity();
    }

    function addInteractivity() {
        scheduleContainer.querySelectorAll('.session').forEach(session => {
            const openPopover = (event) => {
                if (session.dataset.details === 'Details coming soon.') return;
                event.stopPropagation();
                showPopover(session);
            };
            session.addEventListener('click', openPopover);
            session.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPopover(e); });
        });
        overlay.addEventListener('click', hidePopover);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopover(); });
    }

    function showPopover(sessionEl) {
        if (activeSession) activeSession.classList.remove('active');
        activeSession = sessionEl;
        activeSession.classList.add('active');
        
        // Reset inline styles to allow CSS to take over for mobile centering
        popover.style.cssText = ''; 
        
        popover.innerHTML = `
            <button class="popover-close" aria-label="Close">&times;</button>
            <div class="popover-title">${sessionEl.dataset.title}</div>
            <div class="popover-content">${sessionEl.dataset.details}</div>
        `;
        popover.querySelector('.popover-close').addEventListener('click', hidePopover);
        popover.addEventListener('click', e => e.stopPropagation());

        overlay.style.display = 'block';
        popover.style.display = 'flex';
        positionPopover(sessionEl);
    }

    function hidePopover() {
        if (!activeSession) return;
        activeSession.classList.remove('active');
        activeSession.focus(); 
        activeSession = null;
        popover.style.display = 'none';
        overlay.style.display = 'none';
    }

    /**
     * --- FINAL, ROBUST POSITIONING LOGIC ---
     */
    function positionPopover(targetElement) {
        // On mobile, we do nothing. The CSS handles everything perfectly.
        if (scheduleContainer.dataset.view === 'mobile') {
            return;
        }

        // --- Desktop Positioning Logic ---
        const rect = targetElement.getBoundingClientRect();
        const margin = 15; // Minimum space from the window edge

        // 1. HORIZONTAL: Center the popover on the element, then clamp it
        // so it never flows outside the left or right of the screen.
        let left = rect.left + (rect.width / 2) - (popover.offsetWidth / 2);
        left = Math.max(margin, Math.min(left, window.innerWidth - popover.offsetWidth - margin));

        // 2. VERTICAL: Decide if it should go above or below the element.
        const spaceBelow = window.innerHeight - rect.bottom - margin;
        const spaceAbove = rect.top - margin;

        // If there's enough space below, place it there.
        if (popover.offsetHeight <= spaceBelow) {
            popover.style.top = `${rect.bottom + 5}px`;
        } 
        // If not, but there's enough space above, place it there.
        else if (popover.offsetHeight <= spaceAbove) {
            popover.style.top = `${rect.top - popover.offsetHeight - 5}px`;
        } 
        // If it doesn't fit in either direction, place it in the larger available
        // space and set a maxHeight to make its content scrollable.
        else {
            if (spaceBelow >= spaceAbove) {
                popover.style.top = `${rect.bottom + 5}px`;
                popover.style.maxHeight = `${spaceBelow}px`;
            } else {
                popover.style.top = `${margin}px`;
                popover.style.maxHeight = `${spaceAbove}px`;
            }
        }
        
        popover.style.left = `${left}px`;
    }

    function handleResize() {
        const isMobile = window.innerWidth <= 800;
        const currentView = scheduleContainer.dataset.view;
        if (isMobile && currentView !== 'mobile') {
            scheduleContainer.dataset.view = 'mobile';
            buildMobileView();
        } else if (!isMobile && currentView !== 'desktop') {
            scheduleContainer.dataset.view = 'desktop';
            buildDesktopView();
        }
    }
    
    initializeSchedule();
});
