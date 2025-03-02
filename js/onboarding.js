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
    
    let currentStep = 1;
    
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
            const age = document.getElementById('onboarding-age').value.trim();
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
                        age: age ? parseInt(age) : null,
                        gender: gender || null,
                        pronouns: pronouns || null
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update profile');
                }
                
                // Update local storage
                const userData = JSON.parse(localStorage.getItem('user'));
                userData.username = username;
                userData.name = name;
                userData.avatar_url = avatarUrl || null;
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
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };
    
    // Initialize
    loadUserData();
    goToStep(1);
});