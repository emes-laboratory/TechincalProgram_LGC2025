document.addEventListener('DOMContentLoaded', () => {
    // Make scheduleData globally accessible or pass it to the function
    if (typeof scheduleData !== 'undefined') {
        buildSchedule(scheduleData);
    } else {
        console.error("Schedule data is not loaded.");
    }
});

function buildSchedule(data) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    container.innerHTML = ''; // Clear previous content

    // --- 1. Create Day and Time Labels (Primarily for Desktop Grid) ---
    // These are positioned by the grid and won't disrupt the mobile DOM flow.
    data.days.forEach((day, index) => {
        const dayLabel = document.createElement('div');
        // FIX: Added 'desktop-only' class so it correctly hides on mobile
        dayLabel.className = 'grid-item day-label desktop-only'; 
        dayLabel.textContent = day;
        dayLabel.style.gridColumn = index + 2;
        container.appendChild(dayLabel);
    });

    data.timeSlots.forEach((time, index) => {
        const timeLabel = document.createElement('div');
        timeLabel.className = 'grid-item time-label';
        timeLabel.textContent = time;
        timeLabel.style.gridRow = index + 2;
        container.appendChild(timeLabel);
    });

    // --- 2. Create Mobile Headers and Session Elements (Day by Day) ---
    // This new structure loops through each day to create the correct
    // sequential order needed for the mobile flexbox layout.
    data.days.forEach((day, dayIndex) => {
        
        // Create and append the mobile-only day header. This is the missing piece.
        const mobileHeader = document.createElement('div');
        mobileHeader.className = 'day-header-mobile';
        mobileHeader.textContent = day;
        container.appendChild(mobileHeader);

        // Get only the sessions for the current day
        const sessionsForDay = data.sessions.filter(session => session.day === dayIndex + 1);

        // Create and append all session elements for this day
        sessionsForDay.forEach(session => {
            const sessionEl = document.createElement('div');
            sessionEl.className = `grid-item session type-${session.type}`;
            
            // This positioning information is used by the desktop grid view
            sessionEl.style.gridColumn = `${session.day + 1} / span ${session.colSpan || 1}`;
            sessionEl.style.gridRow = `${session.time + 1} / span ${session.rowSpan || 1}`;
            
            sessionEl.innerHTML = session.title;

            // Store details in data attributes for the popover
            sessionEl.dataset.title = session.title;
            sessionEl.dataset.details = session.details || '';

            container.appendChild(sessionEl);
        });
    });

    // --- 3. Add Popover Logic ---
    // This function remains unchanged as it works correctly.
    setupPopover();
}

function setupPopover() {
    const container = document.getElementById('schedule-container');
    const popover = document.getElementById('session-popover');
    let activeSession = null;

    if (!container || !popover) return;

    // Use a single event listener on the container
    container.addEventListener('click', (event) => {
        const sessionEl = event.target.closest('.session');

        // Close popover if clicking outside or on the already active session
        if (!sessionEl || sessionEl === activeSession) {
            popover.style.display = 'none';
            if (activeSession) {
                activeSession.classList.remove('active');
                activeSession = null;
            }
            return;
        }

        // Remove active state from the previously clicked session
        if (activeSession) {
            activeSession.classList.remove('active');
        }

        // Set the new active session and show its details
        activeSession = sessionEl;
        activeSession.classList.add('active');

        const title = activeSession.dataset.title;
        const details = activeSession.dataset.details.replace(/\n/g, '<br>'); // Replace newlines with <br> for HTML
        popover.innerHTML = `<div class="popover-title">${title}</div><div>${details}</div>`;
        
        popover.style.display = 'block'; // Show popover before calculating its position

        // Position the popover relative to the clicked session
        positionPopover(activeSession, popover);
    });

     // Close popover when clicking anywhere else on the page
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.session') && !event.target.closest('.session-popover')) {
             popover.style.display = 'none';
            if (activeSession) {
                activeSession.classList.remove('active');
                activeSession = null;
            }
        }
    });
}


function positionPopover(target, popover) {
    const container = document.querySelector('.main-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    // Reset arrow direction classes
    popover.classList.remove('arrow-top', 'arrow-bottom');

    // Position popover centered horizontally relative to the target
    let left = targetRect.left - containerRect.left + (targetRect.width / 2) - (popoverRect.width / 2);

    // Default position is below the element
    let top = targetRect.bottom - containerRect.top + 10; // 10px gap
    popover.classList.add('arrow-top');

    // If it overflows below the viewport, try to place it above
    if ((targetRect.bottom + popoverRect.height) > window.innerHeight) {
        top = targetRect.top - containerRect.top - popoverRect.height - 10; // 10px gap
        popover.classList.remove('arrow-top');
        popover.classList.add('arrow-bottom');
    }
    
    // Boundary checks to keep it within the main container
    if (left < 0) {
        left = 10;
    }
    if (left + popoverRect.width > containerRect.width) {
        left = containerRect.width - popoverRect.width - 10;
    }
    
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
}
