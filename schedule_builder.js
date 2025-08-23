document.addEventListener('DOMContentLoaded', function () {
    // --- DOM Element References ---
    const scheduleContainer = document.getElementById('schedule-container');
    const popover = document.getElementById('session-popover');
    
    // --- State Variables ---
    let activeSession = null;
    let scheduleData = null;
    let timeToRowMap = {}; // Object to map time strings to grid row numbers

    /**
     * Main initialization function.
     */
    async function initializeSchedule() {
        try {
            const response = await fetch('schedule_data.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            scheduleData = await response.json();
            
            // Gather all unique time points from the predefined slots and all sessions.
            const allTimes = new Set(scheduleData.time_slots);
            scheduleData.sessions.forEach(session => {
                allTimes.add(session.startTime);
                allTimes.add(session.endTime);
            });
            
            // Create the master timeline by sorting all unique time points.
            scheduleData.time_slots = Array.from(allTimes).sort();

            // Create the mapping from a time string (e.g., "10:05") to a grid row number.
            scheduleData.time_slots.forEach((time, index) => {
                timeToRowMap[time] = index + 2; // Row 1 is for day headers
            });

            // Set up initial view and listen for window resizing.
            handleResize();
            window.addEventListener('resize', handleResize);
            
        } catch (error) {
            console.error("Could not load or build schedule:", error);
            scheduleContainer.innerHTML = `<p style="text-align:center; color:red;">Error loading schedule data.</p>`;
        }
    }

    /**
     * --- CORRECTED FUNCTION ---
     * Formats session details for the popover, now safely handling different data types.
     */
    function formatDetails(session) {
        // 1. Check if details exist at all.
        if (!session.details) {
            return 'Details coming soon.';
        }
        
        // 2. Handle specific cases of "empty" based on the data type.
        if (session.details_type === 'text' && typeof session.details === 'string' && session.details.trim() === "") {
            return 'Details coming soon.';
        }
        if (session.details_type === 'presentations' && Array.isArray(session.details) && session.details.length === 0) {
            return 'Details coming soon.';
        }

        // 3. Proceed with formatting now that we know we have valid data.
        switch (session.details_type) {
            case 'presentations':
                return session.details.map(p => `• <b>${p.topic}</b>\n  <i>${p.presenter} (${p.affiliation})</i>`).join('\n\n');
            case 'panel':
                if (!session.details.moderator || !session.details.panelists) return 'Panel details coming soon.';
                const moderator = `<b>Moderator:</b>\n  <i>${session.details.moderator.name} (${session.details.moderator.affiliation})</i>`;
                const panelists = session.details.panelists.map(p => `  - ${p.name} (${p.affiliation})`).join('\n');
                return `${moderator}\n\n<b>Panelists:</b>\n${panelists}`;
            case 'text':
                return session.details;
            default:
                return 'Details coming soon.';
        }
    }

    /**
     * Builds the desktop grid view.
     */
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
            
            if (!startRow || !endRow) {
                console.warn('Session has an invalid time and cannot be placed:', sessionData.title);
                return; 
            }
            sessionEl.style.gridRow = `${startRow} / ${endRow}`;

            sessionEl.innerHTML = sessionData.title;
            sessionEl.setAttribute('tabindex', '0');
            sessionEl.dataset.title = sessionData.title;
            // This now calls the corrected, safe function.
            sessionEl.dataset.details = formatDetails(sessionData);
            grid.appendChild(sessionEl);
        });

        scheduleContainer.appendChild(grid);
        addInteractivity();
    }
    
    /**
     * Builds the mobile list view.
     */
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

    /**
     * Adds event listeners for opening/closing the popover.
     */
    function addInteractivity() {
        scheduleContainer.querySelectorAll('.session').forEach(session => {
            const openPopover = (event) => {
                // This check is now safe because formatDetails always returns a string.
                if (session.dataset.details === 'Details coming soon.') return;
                event.stopPropagation();
                showPopover(session);
            };
            session.addEventListener('click', openPopover);
            session.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPopover(e); });
        });
        document.addEventListener('click', () => hidePopover());
        document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopover(); });
        popover.addEventListener('click', e => e.stopPropagation());
    }

    /**
     * Displays and positions the popover.
     */
    function showPopover(sessionEl) {
        if (activeSession) activeSession.classList.remove('active');
        activeSession = sessionEl;
        activeSession.classList.add('active');
        
        popover.innerHTML = `
            <button class="popover-close" aria-label="Close">&times;</button>
            <div class="popover-title">${sessionEl.dataset.title}</div>
            <div class="popover-content">${sessionEl.dataset.details}</div>
        `;
        popover.querySelector('.popover-close').addEventListener('click', hidePopover);
        
        popover.style.display = 'flex';
        positionPopover(sessionEl);
    }

    /**
     * Hides the popover.
     */
    function hidePopover() {
        if (!activeSession) return;
        activeSession.classList.remove('active');
        activeSession.focus(); 
        activeSession = null;
        popover.style.display = 'none';
    }

    /**
     * Intelligently positions the popover to be fully visible and scrollable.
     */
    function positionPopover(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const popoverHeight = popover.offsetHeight;
        const popoverWidth = popover.offsetWidth;
        const margin = 10;

        let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
        
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let top;
        if (spaceBelow >= popoverHeight || spaceBelow > spaceAbove) {
            top = rect.bottom + 5;
            popover.style.maxHeight = `${window.innerHeight - rect.bottom - margin * 2}px`;
        } else {
            top = rect.top - popoverHeight - 5;
            popover.style.maxHeight = `${rect.top - margin * 2}px`;
        }
        
        if (left < margin) left = margin;
        if (left + popoverWidth > window.innerWidth - margin) {
            left = window.innerWidth - popoverWidth - margin;
        }
        if (top < margin) top = margin;

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }

    /**
     * Checks window size and calls the appropriate build function.
     */
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
    
    // --- Start the application ---
    initializeSchedule();
});
