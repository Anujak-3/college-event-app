// Wait for DOM to be fully loaded
// Modify the loadEvents function in app.js
async function loadEvents(category = '') {
    const url = category ? `/api/events/category/${category}` : '/api/events';
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load events');
        }

        const events = await response.json();
        displayEvents(events);
    } catch (error) {
        console.error('Failed to load events:', error);
        alert('Failed to load events. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('userLoginForm');
    const eventsSection = document.getElementById('eventsSection');
    const eventsList = document.getElementById('eventsList');
    const homeLink = document.getElementById('homeLink');
    const loginLink = document.getElementById('loginLink');
    const loginFormContainer = document.getElementById('loginForm');
    const coordinatorDashboard = document.getElementById('coordinatorDashboard');
    const createEventForm = document.getElementById('createEventForm');
    const categoryFilter = document.getElementById('categoryFilter');

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.role === 'coordinator') {
            showCoordinatorDashboard();
        } else {
            showEvents();
        }
    }

    // Event Listeners
    loginForm.addEventListener('submit', handleLogin);
    homeLink.addEventListener('click', showEvents);
    loginLink.addEventListener('click', showLoginForm);
    if (createEventForm) {
        createEventForm.addEventListener('submit', createEvent);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleCategoryFilter);
      }

    // Login Handler
    async function handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        };

        console.log('Attempting login with:', loginData); // Debug log

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData),
            });

            console.log('Server response status:', response.status); // Debug log

            const data = await response.json();
            console.log('Server response:', data); // Debug log

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify({
                    role: loginData.role,
                    userId: data.userId
                }));

                if (loginData.role === 'coordinator') {
                    showCoordinatorDashboard();
                } else {
                    showEvents();
                }
                alert('Login successful!');
            } else {
                alert('Login failed: ' + data.message);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    }

    // Show Events Section
    async function showEvents() {
        loginFormContainer.style.display = 'none';
        if (coordinatorDashboard) {
            coordinatorDashboard.style.display = 'none';
        }
        eventsSection.style.display = 'block';
        await loadEvents();
    }

    // Show Login Form
    function showLoginForm() {
        loginFormContainer.style.display = 'block';
        eventsSection.style.display = 'none';
        if (coordinatorDashboard) {
            coordinatorDashboard.style.display = 'none';
        }
    }

    // Show Coordinator Dashboard
    function showCoordinatorDashboard() {
        if (coordinatorDashboard) {
            loginFormContainer.style.display = 'none';
            eventsSection.style.display = 'block';
            coordinatorDashboard.style.display = 'block';
        }
    }
    
//// Modify the loadEvents function in app.js
async function loadEvents(category = '') {
    const url = category ? `/api/events/category/${category}` : '/api/events';
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load events');
        }

        const events = await response.json();
        displayEvents(events);
    } catch (error) {
        console.error('Failed to load events:', error);
        alert('Failed to load events. Please try again.');
    }
}

    // Modified displayEvents function
    function displayEvents(events) {
        const user = JSON.parse(localStorage.getItem('user'));
        eventsList.innerHTML = '';
    
        if (events.length === 0) {
            eventsList.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }
    
        events.forEach(event => {
            const progressWidth = (event.registrations?.length / event.maxParticipants) * 100 || 0;
            const isRegistered = event.registrations?.some(r => r.student === user?.userId);
            
            const eventCard = document.createElement('div');
            eventCard.className = 'event-card';
            eventCard.innerHTML = `
                <img src="${event.flyer}" class="event-image" alt="${event.title}">
                <div class="event-content">
                    <h3>${event.title}</h3>
                    <p>${event.description}</p>
                    
                    <div class="highlight-grid">
                        ${event.highlightPoints?.map(point => `
                            <div class="highlight-item">${point}</div>
                        `).join('')}
                    </div>
    
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressWidth}%"></div>
                    </div>
    
                    <div class="event-meta">
                        <p><i class="clock-icon"></i> ${new Date(event.date).toLocaleDateString()}</p>
                        <p>Spots left: ${event.maxParticipants - (event.registrations?.length || 0)}</p>
                    </div>
    
                    <button class="toggle-details" onclick="toggleEventDetails('${event._id}')">
                        Show More Details
                        <i class="chevron-icon" data-icon="chevron-down"></i>
                    </button>
    
                    <div class="event-details" id="details-${event._id}" style="display: none;">
                        <div class="documents-list">
                            ${event.documents?.map(doc => `
                                <div class="document-item">
                                    <span>${doc.name}</span>
                                    <a href="${doc.url}" download>Download</a>
                                </div>
                            `).join('')}
                        </div>
                    </div>
    
                    <button class="register-button" 
                        onclick="registerForEvent('${event._id}')"
                        ${isRegistered ? 'disabled' : ''}>
                        ${isRegistered ? 'Registered' : 'Register Now'}
                    </button>
                </div>
            `;
            
            eventsList.appendChild(eventCard);
        });
    }
    // Create Event
    async function createEvent(e) {
        e.preventDefault();
        const formData = new FormData(createEventForm);
        const fileInput = document.querySelector('input[type="file"]');
        
        try {
            // Validate file size
            if(fileInput.files[0].size > 2 * 1024 * 1024) {
                alert('File size exceeds 2MB limit');
                return;
            }
    
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            
            if(response.ok) {
                alert('Event created successfully');
                createEventForm.reset();
                loadEvents();
            } else {
                const data = await response.json();
                alert('Error: ' + (data.message || 'Failed to create event'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to create event');
        }
    }

    // Register for Event
    window.registerForEvent = async function(eventId) {
        try {
            const response = await fetch(`/api/events/${eventId}/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                alert('Successfully registered for event!');
                loadEvents(); // Refresh the events list
                requestNotificationPermission();
            } else {
                alert('Registration failed: ' + data.message);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Failed to register for event. Please try again.');
        }
    }

    // Notification Functions
    function requestNotificationPermission() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                }
            });
        }
    }

    // Logout Function
    window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showLoginForm();
    }
});

// New handler function
async function handleCategoryFilter() {
  const category = categoryFilter.value;
  await loadEvents(category);
}

// Add these new functions
window.toggleEventDetails = function(eventId) {
    const details = document.getElementById(`details-${eventId}`);
    const icon = details.previousElementSibling.querySelector('.chevron-icon');
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.setAttribute('data-icon', 'chevron-up');
    } else {
        details.style.display = 'none';
        icon.setAttribute('data-icon', 'chevron-down');
    }
    
    // Refresh icons
    lucide.createIcons();
}

async function handleCategoryFilter() {
    const category = categoryFilter.value;
    await loadEvents(category);
}
window.deleteEvent = async function(eventId) {
    try {
        const response = await fetch(`/api/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        if (response.ok) {
            alert('Event deleted successfully');
            loadEvents(); // Refresh events list
        } else {
            alert('Failed to delete event: ' + data.message);
        }
    } catch (error) {
        console.error('Delete event error:', error);
        alert('Failed to delete event');
    }
}
function displayEvents(events) {
    const user = JSON.parse(localStorage.getItem('user'));
    eventsList.innerHTML = '';

    if (events.length === 0) {
        eventsList.innerHTML = '<p>No upcoming events found.</p>';
        return;
    }

    events.forEach(event => {
        const progressWidth = (event.registrations?.length / event.maxParticipants) * 100 || 0;
        const isRegistered = event.registrations?.some(r => r.student === user?.userId);
        const isCoordinator = user?.role === 'coordinator' && event.coordinator === user?.userId;
        
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.innerHTML = `
            <img src="${event.flyer}" class="event-image" alt="${event.title}">
            <div class="event-content">
                <h3>${event.title}</h3>
                <p>${event.description}</p>
                
                <div class="event-meta">
                    <p><i class="clock-icon"></i> ${new Date(event.date).toLocaleDateString()}</p>
                    <p>Spots left: ${event.maxParticipants - (event.registrations?.length || 0)}</p>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressWidth}%"></div>
                </div>

                <!-- Coordinator Actions -->
                ${isCoordinator ? `
                    <div class="coordinator-actions">
                        <button onclick="showFormBuilder('${event._id}')" class="form-button">
                            Create Registration Form
                        </button>
                        <button class="delete-button" onclick="deleteEvent('${event._id}')">
                            Delete Event
                        </button>
                    </div>
                ` : ''}

                <!-- Student Actions -->
                ${user?.role === 'student' ? `
                    <button class="register-button" 
                        onclick="registerForEvent('${event._id}')"
                        ${isRegistered ? 'disabled' : ''}>
                        ${isRegistered ? 'Already Registered' : 'Register Now'}
                    </button>
                ` : ''}

                <button class="toggle-details" onclick="toggleEventDetails('${event._id}')">
                    Show More Details
                    <i class="chevron-icon" data-icon="chevron-down"></i>
                </button>

                <div class="event-details" id="details-${event._id}" style="display: none;">
                    <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${event.time}</p>
                    <p><strong>Venue:</strong> ${event.venue}</p>
                    <p><strong>Category:</strong> ${event.category}</p>
                </div>
            </div>
        `;
        
        eventsList.appendChild(eventCard);
    })};
function showFormBuilder(eventId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Create Registration Form</h2>
            <div id="formFields">
                <!-- Existing fields will be displayed here -->
            </div>
            <button onclick="addFormField()">Add Field</button>
            <button onclick="saveRegistrationForm('${eventId}')">Save Form</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });
    modal.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {  // Ensures only background click closes modal
            modal.remove();
        }
    });

}

function addFormField() {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-field';
    fieldContainer.innerHTML = `
        <input type="text" placeholder="Field Name" class="field-name">
        <select class="field-type">
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="date">Date</option>
        </select>
        <input type="checkbox" class="field-required"> Required
        <div class="select-options" style="display: none;">
            <input type="text" placeholder="Options (comma-separated)">
        </div>
        <button onclick="this.parentElement.remove()">Remove</button>
    `;

    const fieldType = fieldContainer.querySelector('.field-type');
    const selectOptions = fieldContainer.querySelector('.select-options');
    
    fieldType.addEventListener('change', (e) => {
        selectOptions.style.display = e.target.value === 'select' ? 'block' : 'none';
    });

    document.getElementById('formFields').appendChild(fieldContainer);
}

async function saveRegistrationForm(eventId) {
    const fields = [];
    document.querySelectorAll('.form-field').forEach(field => {
        const fieldData = {
            fieldName: field.querySelector('.field-name').value,
            fieldType: field.querySelector('.field-type').value,
            required: field.querySelector('.field-required').checked
        };

        if (fieldData.fieldType === 'select') {
            const options = field.querySelector('.select-options input').value;
            fieldData.options = options.split(',').map(opt => opt.trim());
        }

        fields.push(fieldData);
    });

    if (fields.length === 0) {
        alert('Please add at least one field.');
        return;
    }

    try {
        const response = await fetch(`/api/events/${eventId}/registration-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ fields })
        });

        if (response.ok) {
            alert('Registration form created successfully');
            document.querySelector('.modal').remove();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create registration form');
        }
    } catch (error) {
        alert('Error creating registration form: ' + error.message);
    }
}


// Initialize Lucide icons (add at bottom)
lucide.createIcons();