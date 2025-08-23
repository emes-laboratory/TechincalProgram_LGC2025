document.addEventListener('DOMContentLoaded', function () {
    // --- DOM Element References ---
    const scheduleContainer = document.getElementById('schedule-container');
    const popover = document.getElementById('session-popover');
    
    // --- State Variables ---
    let activeSession = null;
    let scheduleData = null;
    let timeToRowMap = {}; // Object to map time strings to grid row numbers

    /**
     * Main initialization function. Fetches data and sets up the page.
     */
    async function initializeSchedule() {
        try {
            const response = await fetch('schedule_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            scheduleData = await response.json();
            
            // Sort time slots to ensure correct order
            scheduleData.time_slots.sort();

            // *** CRITICAL FIX ***
            // Create a map from time string to grid row index. This is more reliable than mathematical calculation.
            // Row 1 is for day headers, so times start on row 2.
            scheduleData.time_slots.forEach((time, index) => {
                timeToRowMap[time] = index + 2; 
            });

            // Set up initial view based on window size and listen for changes
            handleResize();
            window.addEventListener('resize', handleResize);
            
        } catch (error) {
            console.error("Could not load or build schedule:", error);
            scheduleContainer.innerHTML = `<p style="text-align:center; color:red;">Error loading schedule data.</p>`;
        }
    }

    /**
     * Formats the details of a session for display in the popover.
     * @param {object} session - The session data object.
     * @returns {string} - Formatted HTML string.
     */
    function formatDetails(session) {
        if (!session.details) return 'Details coming soon.';
        switch (session.details_type) {
            case 'presentations':
                return session.details.map(p => `• <b>${p.topic}</b>\n  <i>${p.presenter} (${p.affiliation})</i>`).join('\n\n');
            case 'panel':
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
        scheduleContainer.innerHTML = ''; // Clear previous content
        const grid = document.createElement('div');
        grid.className = 'schedule-grid';
        grid.setAttribute('role', 'grid');

        // Add Day Headers
        Object.values(scheduleData.day_columns).forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'grid-item day-label';
            dayEl.style.gridColumn = `${day.start} / span ${day.span}`;
            dayEl.textContent = day.title;
            grid.appendChild(dayEl);
        });

        // Add Time Labels
        scheduleData.time_slots.forEach(time => {
            const timeEl = document.createElement('div');
            timeEl.className = 'grid-item time-label';
            timeEl.style.gridRow = timeToRowMap[time];
            timeEl.textContent = time;
            grid.appendChild(timeEl);
        });

        // Add Sessions
        scheduleData.sessions.forEach(sessionData => {
            const sessionEl = document.createElement('div');
            sessionEl.className = `grid-item session type-${sessionData.type}`;
            sessionEl.style.gridColumn = `${sessionData.column} / span ${sessionData.span}`;
            
            // Use the time-to-row map for accurate positioning
            const startRow = timeToRowMap[sessionData.startTime];
            const endRow = timeToRowMap[sessionData.endTime];
            if (!startRow || !endRow) {
                console.warn('Session has invalid start/end time:', sessionData.title);
                return; // Skip sessions with invalid times
            }
            sessionEl.style.gridRow = `${startRow} / ${endRow}`;

            sessionEl.innerHTML = sessionData.title;
            sessionEl.setAttribute('role', 'gridcell');
            sessionEl.setAttribute('tabindex', '0'); // Make it focusable
            
            // Store data on the element for the popover
            sessionEl.dataset.title = sessionData.title;
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
        scheduleContainer.innerHTML = ''; // Clear previous content
        const mobileContainer = document.createElement('div');
        mobileContainer.className = 'schedule-grid mobile-view'; // Use grid classes for consistency

        const sessionsByDay = {};
        scheduleData.sessions.forEach(session => {
            if (!sessionsByDay[session.day]) {
                sessionsByDay[session.day] = [];
            }
            sessionsByDay[session.day].push(session);
        });

        Object.keys(sessionsByDay).sort().forEach(dayKey => {
            // Add Day Header
            const header = document.createElement('div');
            header.className = 'day-header-mobile';
            header.textContent = scheduleData.day_columns[dayKey].title;
            mobileContainer.appendChild(header);

            // Add Sessions for that day
            sessionsByDay[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach(sessionData => {
                const sessionEl = document.createElement('div');
                sessionEl.className = `session type-${sessionData.type}`;
                sessionEl.innerHTML = `<b>${sessionData.startTime} - ${sessionData.endTime}</b><br>${sessionData.title}`;
                sessionEl.setAttribute('role', 'button');
                sessionEl.setAttribute('tabindex', '0');
                
                // Store data for popover
                sessionEl.dataset.title = sessionData.title;
                sessionEl.dataset.details = formatDetails(sessionData);
                
                mobileContainer.appendChild(sessionEl);
            });
        });
        
        scheduleContainer.appendChild(mobileContainer);
        addInteractivity();
    }

    /**
     * Adds click/keyboard listeners to sessions and the popover.
     */
    function addInteractivity() {
        scheduleContainer.querySelectorAll('.session').forEach(session => {
            const openPopover = (event) => {
                // Don't open for empty details
                if (!session.dataset.details || session.dataset.details.trim() === 'Details coming soon.') return;
                
                event.stopPropagation();
                if (activeSession === session) {
                    hidePopover();
                } else {
                    showPopover(session);
                }
            };

            session.addEventListener('click', openPopover);
            session.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPopover(event);
                }
            });
        });

        // Close popover if clicking outside of it
        document.addEventListener('click', (event) => {
            if (popover.style.display === 'block' && !popover.contains(event.target)) {
                hidePopover();
            }
        });
    }

    /**
     * Displays and positions the popover for a given session.
     * @param {HTMLElement} sessionEl - The session element that was clicked.
     */
    function showPopover(sessionEl) {
        if (activeSession) {
            activeSession.classList.remove('active');
        }
        activeSession = sessionEl;
        activeSession.classList.add('active');
        
        const title = sessionEl.dataset.title;
        const details = sessionEl.dataset.details;
        
        popover.innerHTML = `
            <button class="popover-close" aria-label="Close">&times;</button>
            <div class="popover-title">${title}</div>
            <div class="popover-content">${details}</div>
        `;

        popover.querySelector('.popover-close').addEventListener('click', hidePopover);
        
        // Position and show
        popover.style.display = 'block';
        positionPopover(sessionEl);
    }

    /**
     * Hides the popover and deactivates the current session.
     */
    function hidePopover() {
        if (activeSession) {
            activeSession.classList.remove('active');
            activeSession.focus(); // Return focus to the element
            activeSession = null;
        }
        popover.style.display = 'none';
    }

    /**
     * Calculates and sets the optimal position for the popover.
     * @param {HTMLElement} targetElement - The element to position the popover relative to.
     */
    function positionPopover(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        
        // Use fixed positioning for simplicity and robustness across scroll positions
        popover.style.position = 'fixed';

        // Center horizontally first
        let left = rect.left + (rect.width / 2) - (popover.offsetWidth / 2);
        
        // Default position: below the element
        let top = rect.bottom + 8;

        // If it goes off the bottom of the viewport, place it above instead
        if (top + popover.offsetHeight > window.innerHeight) {
            top = rect.top - popover.offsetHeight - 8;
        }
        
        // Adjust for horizontal overflow
        if (left < 10) left = 10;
        if (left + popover.offsetWidth > window.innerWidth) {
            left = window.innerWidth - popover.offsetWidth - 10;
        }
        
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }

    /**
     * Checks window size and calls the appropriate build function.
     * Manages a data attribute on the container to prevent redundant rebuilds.
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
