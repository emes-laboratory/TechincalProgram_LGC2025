document.addEventListener('DOMContentLoaded', () => {
    if (typeof scheduleData !== 'undefined') {
        buildDesktopSchedule(scheduleData);
        buildMobileSchedule(scheduleData);
        setupPopover();
    } else {
        console.error("Schedule data is not loaded.");
    }
});

/**
 * Creates a single session element div, used by both mobile and desktop builders.
 */
function createSessionElement(session) {
    const sessionEl = document.createElement('div');
    sessionEl.className = `session type-${session.type}`;
    sessionEl.innerHTML = session.title;
    sessionEl.dataset.title = session.title;
    sessionEl.dataset.details = session.details || '';
    return sessionEl;
}

/**
 * Builds the desktop-only grid view.
 */
function buildDesktopSchedule(data) {
    const container = document.getElementById('schedule-container-desktop');
    if (!container) return;

    data.days.forEach((day, index) => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'day-label';
        dayLabel.textContent = day;
        dayLabel.style.gridColumn = index + 2;
        container.appendChild(dayLabel);
    });

    data.timeSlots.forEach((time, index) => {
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = time;
        timeLabel.style.gridRow = index + 2;
        container.appendChild(timeLabel);
    });

    data.sessions.forEach(session => {
        const sessionEl = createSessionElement(session);
        sessionEl.style.gridColumn = `${session.day + 1} / span ${session.colSpan || 1}`;
        sessionEl.style.gridRow = `${session.time + 1} / span ${session.rowSpan || 1}`;
        container.appendChild(sessionEl);
    });
}

/**
 * Builds the mobile-only column view.
 */
function buildMobileSchedule(data) {
    const container = document.getElementById('schedule-container-mobile');
    if (!container) return;

    data.days.forEach((day, dayIndex) => {
        const mobileHeader = document.createElement('div');
        mobileHeader.className = 'mobile-day-header';
        mobileHeader.textContent = day;
        container.appendChild(mobileHeader);

        const sessionsForDay = data.sessions.filter(session => session.day === dayIndex + 1);
        
        sessionsForDay.forEach(session => {
            const sessionEl = createSessionElement(session);
            container.appendChild(sessionEl);
        });
    });
}

/**
 * Sets up a single popover for the whole page.
 */
function setupPopover() {
    const mainContainer = document.querySelector('.main-container');
    const popover = document.getElementById('session-popover');
    let activeSession = null;

    if (!mainContainer || !popover) return;

    mainContainer.addEventListener('click', (event) => {
        const sessionEl = event.target.closest('.session');

        if (!sessionEl || sessionEl === activeSession) {
            popover.style.display = 'none';
            if (activeSession) activeSession.classList.remove('active');
            activeSession = null;
            return;
        }

        if (activeSession) activeSession.classList.remove('active');

        activeSession = sessionEl;
        activeSession.classList.add('active');
        popover.innerHTML = `<div class="popover-title">${activeSession.dataset.title}</div><div>${activeSession.dataset.details.replace(/\n/g, '<br>')}</div>`;
        popover.style.display = 'block';
        
        positionPopover(activeSession, popover);
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.main-container')) {
             popover.style.display = 'none';
             if (activeSession) activeSession.classList.remove('active');
             activeSession = null;
        }
    });
}

function positionPopover(target, popover) {
    const container = document.querySelector('.main-container');
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    popover.classList.remove('arrow-top', 'arrow-bottom');

    let left = targetRect.left - containerRect.left + (targetRect.width / 2) - (popover.offsetWidth / 2);
    let top = targetRect.bottom - containerRect.top + 10;
    popover.classList.add('arrow-top');

    if ((targetRect.bottom + popover.offsetHeight + 20) > window.innerHeight && targetRect.top > popover.offsetHeight) {
        top = targetRect.top - containerRect.top - popover.offsetHeight - 10;
        popover.classList.remove('arrow-top');
        popover.classList.add('arrow-bottom');
    }
    
    if (left < 10) left = 10;
    if (left + popover.offsetWidth > container.offsetWidth) left = container.offsetWidth - popover.offsetWidth - 10;
    
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
}
