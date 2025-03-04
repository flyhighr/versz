document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const onboardingForm = document.getElementById('onboarding-form');
    const progressSteps = document.querySelectorAll('.progress-step');
    const progressLines = document.querySelectorAll('.progress-line');
    const onboardingSteps = document.querySelectorAll('.onboarding-step');
    const nextButtons = document.querySelectorAll('.btn-next');
    const backButtons = document.querySelectorAll('.btn-back');
    const onboardingMessage = document.getElementById('onboarding-message');
    const timezoneSelect = document.getElementById('onboarding-timezone');
    
    let currentStep = 1;
    
    // Load timezones
    const loadTimezones = async () => {
        try {
            const response = await fetch(`${API_URL}/timezones`);
            if (!response.ok) {
                console.error('Failed to load timezones');
                return;
            }
            
            const data = await response.json();
            const timezones = data.timezones;
            
            // Add timezones to select dropdown
            timezones.forEach(timezone => {
                const option = document.createElement('option');
                option.value = timezone;
                option.textContent = timezone;
                timezoneSelect.appendChild(option);
            });
            
            // Try to set user's timezone by default
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (userTimezone && timezones.includes(userTimezone)) {
                timezoneSelect.value = userTimezone;
            }
        } catch (error) {
            console.error('Error loading timezones:', error);
        }
    };
    
    // Load timezones on page load
    loadTimezones();
    
    // Check username availability
    const usernameInput = document.getElementById('onboarding-username');
    const usernameStatus = document.getElementById('username-status');
    
    if (usernameInput) {
        usernameInput.addEventListener('blur', async () => {
            const username = usernameInput.value.trim();
            
            if (!username) {
                usernameStatus.textContent = '';
                usernameStatus.className = '';
                return;
            }
            
            // Check if username contains only alphanumeric characters and underscores
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                usernameStatus.textContent = 'Username can only contain letters, numbers, and underscores';
                usernameStatus.className = 'input-status error';
                return;
            }
            
            usernameStatus.textContent = 'Checking...';
            usernameStatus.className = 'input-status info';
            
            try {
                const response = await fetch(`${API_URL}/check-url?url=${username}`);
                const data = await response.json();
                
                if (data.available) {
                    usernameStatus.textContent = 'Username is available!';
                    usernameStatus.className = 'input-status success';
                } else {
                    usernameStatus.textContent = 'Username is already taken';
                    usernameStatus.className = 'input-status error';
                }
            } catch (error) {
                console.error('Error checking username:', error);
                usernameStatus.textContent = 'Failed to check username';
                usernameStatus.className = 'input-status error';
            }
        });
    }
    
    // Avatar preview
    const avatarUrlInput = document.getElementById('onboarding-avatar');
    const avatarPreview = document.getElementById('avatar-preview');
    
    if (avatarUrlInput && avatarPreview) {
        avatarUrlInput.addEventListener('blur', () => {
            const url = avatarUrlInput.value.trim();
            if (url) {
                avatarPreview.src = url;
                avatarPreview.onerror = () => {
                    avatarPreview.src = 'img/default-avatar.png';
                };
            } else {
                avatarPreview.src = 'img/default-avatar.png';
            }
        });
    }
    
    // Custom pronouns toggle
    const pronounsSelect = document.getElementById('onboarding-pronouns');
    const customPronouns = document.getElementById('custom-pronouns');
    
    if (pronounsSelect && customPronouns) {
        pronounsSelect.addEventListener('change', () => {
            if (pronounsSelect.value === 'custom') {
                customPronouns.style.display = 'block';
            } else {
                customPronouns.style.display = 'none';
            }
        });
    }
    
    // Step navigation
    const goToStep = (step) => {
        // Hide all steps
        onboardingSteps.forEach(s => s.classList.remove('active'));
        
        // Show current step
        onboardingSteps[step - 1].classList.add('active');
        
        // Update progress indicators
        progressSteps.forEach((s, i) => {
            if (i + 1 < step) {
                s.classList.add('completed');
                s.classList.add('active');
                if (progressLines[i]) {
                    progressLines[i].classList.add('active');
                }
            } else if (i + 1 === step) {
                s.classList.add('active');
                s.classList.remove('completed');
                if (i > 0 && progressLines[i - 1]) {
                    progressLines[i - 1].classList.add('active');
                }
            } else {
                s.classList.remove('active');
                s.classList.remove('completed');
                if (progressLines[i - 1]) {
                    progressLines[i - 1].classList.remove('active');
                }
            }
        });
        
        currentStep = step;
    };
    
    // Next button click
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Validate current step
            if (currentStep === 1) {
                const name = document.getElementById('onboarding-name').value.trim();
                const username = document.getElementById('onboarding-username').value.trim();
                
                if (!name) {
                    showMessage('Please enter your name', 'error');
                    return;
                }
                
                if (!username) {
                    showMessage('Please choose a username', 'error');
                    return;
                }
                
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    showMessage('Username can only contain letters, numbers, and underscores', 'error');
                    return;
                }
                
                if (usernameStatus.classList.contains('error')) {
                    showMessage('Please choose a different username', 'error');
                    return;
                }
            }
            
            goToStep(currentStep + 1);
            hideMessage();
        });
    });
    
    // Back button click
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            goToStep(currentStep - 1);
            hideMessage();
        });
    });
    
    // Show message
    const showMessage = (message, type = 'info') => {
        onboardingMessage.textContent = message;
        onboardingMessage.className = `onboarding-message ${type}`;
    };
    
    // Hide message
    const hideMessage = () => {
        onboardingMessage.textContent = '';
        onboardingMessage.className = 'onboarding-message';
    };
    
    // Form submission
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const name = document.getElementById('onboarding-name').value.trim();
            const username = document.getElementById('onboarding-username').value.trim();
            const avatarUrl = document.getElementById('onboarding-avatar').value.trim();
            const location = document.getElementById('onboarding-location').value.trim();
            const timezone = document.getElementById('onboarding-timezone').value;
            const dateOfBirth = document.getElementById('onboarding-dob').value;
            const gender = document.getElementById('onboarding-gender').value;
            
            let pronouns = document.getElementById('onboarding-pronouns').value;
            if (pronouns === 'custom') {
                pronouns = document.getElementById('custom-pronouns').value.trim();
            }
            
            // Validate username
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                showMessage('Username can only contain letters, numbers, and underscores', 'error');
                return;
            }
            
            // Validate date of birth if provided
            if (dateOfBirth) {
                const dobDate = new Date(dateOfBirth);
                const today = new Date();
                
                // Check if date is valid
                if (isNaN(dobDate.getTime())) {
                    showMessage('Please enter a valid date of birth', 'error');
                    return;
                }
                
                // Check if user is at least 13 years old
                const age = today.getFullYear() - dobDate.getFullYear();
                const monthDiff = today.getMonth() - dobDate.getMonth();
                if (age < 13 || (age === 13 && monthDiff < 0) || (age === 13 && monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                    showMessage('You must be at least 13 years old to use this service', 'error');
                    return;
                }
            }
            
            // Check username availability one more time
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${username}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showMessage('Username is already taken. Please choose a different one.', 'error');
                    return;
                }
                
                // Show loading message
                showMessage('Setting up your profile...', 'info');
                
                // Submit data
                const response = await fetch(`${API_URL}/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        username: username,
                        name: name,
                        avatar_url: avatarUrl || null,
                        location: location || null,
                        date_of_birth: dateOfBirth || null,
                        timezone: timezone || null,
                        gender: gender || null,
                        pronouns: pronouns || null
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update profile');
                }
                
                // Update local storage
                const userData = JSON.parse(localStorage.getItem('user')) || {};
                userData.username = username;
                userData.name = name;
                userData.avatar_url = avatarUrl || null;
                userData.date_of_birth = dateOfBirth || null;
                userData.timezone = timezone || null;
                localStorage.setItem('user', JSON.stringify(userData));
                
                // Show success message
                showMessage('Profile setup complete! Redirecting...', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } catch (error) {
                console.error('Profile update error:', error);
                showMessage(error.message || 'An error occurred. Please try again.', 'error');
            }
        });
    }
    
    // Load user data if already exists
    const loadUserData = async () => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                }
                return;
            }
            
            const userData = await response.json();
            
            // If user already has a username, redirect to dashboard
            if (userData.username) {
                window.location.href = 'dashboard.html';
                return;
            }
            
            // Pre-fill email
            if (userData.email) {
                // If there are any fields that should be pre-filled, do it here
                
                // If user has a name, pre-fill it
                if (userData.name) {
                    document.getElementById('onboarding-name').value = userData.name;
                }
                
                // If user has an avatar, pre-fill it
                if (userData.avatar_url) {
                    document.getElementById('onboarding-avatar').value = userData.avatar_url;
                    document.getElementById('avatar-preview').src = userData.avatar_url;
                }
                
                // If user has a location, pre-fill it
                if (userData.location) {
                    document.getElementById('onboarding-location').value = userData.location;
                }
                
                // If user has a date of birth, pre-fill it
                if (userData.date_of_birth) {
                    document.getElementById('onboarding-dob').value = userData.date_of_birth;
                }
                
                // If user has a timezone, pre-fill it
                if (userData.timezone) {
                    // Wait for timezones to load
                    setTimeout(() => {
                        const timezoneSelect = document.getElementById('onboarding-timezone');
                        if (timezoneSelect && timezoneSelect.options.length > 0) {
                            timezoneSelect.value = userData.timezone;
                        }
                    }, 500);
                }
                
                // If user has gender, pre-fill it
                if (userData.gender) {
                    document.getElementById('onboarding-gender').value = userData.gender;
                }
                
                // If user has pronouns, pre-fill it
                if (userData.pronouns) {
                    const pronounsSelect = document.getElementById('onboarding-pronouns');
                    const standardPronouns = ['he/him', 'she/her', 'they/them'];
                    
                    if (standardPronouns.includes(userData.pronouns)) {
                        pronounsSelect.value = userData.pronouns;
                    } else {
                        pronounsSelect.value = 'custom';
                        document.getElementById('custom-pronouns').style.display = 'block';
                        document.getElementById('custom-pronouns').value = userData.pronouns;
                    }
                }
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };
    
    // Initialize
    loadUserData();
    goToStep(1); 
});