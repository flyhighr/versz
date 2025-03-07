document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://api.versz.fun';
    
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
            const loadingId = notifications.info('Loading Data', 'Retrieving timezone information...');
            
            const response = await fetch(`${API_URL}/timezones`);
            if (!response.ok) {
                notifications.close(loadingId);
                notifications.error('Error', 'Failed to load timezones');
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
            
            notifications.close(loadingId);
        } catch (error) {
            console.error('Error loading timezones:', error);
            notifications.error('Connection Error', 'Unable to load timezone data. Please refresh the page.');
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
                
                // Get the current user from localStorage
                const currentUser = JSON.parse(localStorage.getItem('user')) || {};
                
                // If the username is the same as the user's current username, it's available for them
                if (currentUser.username === username) {
                    usernameStatus.textContent = 'This is your current username';
                    usernameStatus.className = 'input-status success';
                    return;
                }
                
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
    
    // Avatar upload functionality
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarUrlInput = document.getElementById('onboarding-avatar');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarUploadStatus = document.getElementById('avatar-upload-status');
    const showAvatarUrlBtn = document.getElementById('show-avatar-url');

    // Add this to handle file uploads
    if (avatarUpload) {
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                notifications.error('Invalid File', 'Please select an image file');
                avatarUploadStatus.textContent = 'Please select an image file';
                avatarUploadStatus.className = 'upload-status error';
                return;
            }
            
            // Check file size (max 32MB)
            const MAX_SIZE = 32 * 1024 * 1024; // 32MB
            if (file.size > MAX_SIZE) {
                notifications.error('File Too Large', 'Image must be smaller than 32MB');
                avatarUploadStatus.textContent = 'File too large (max 32MB)';
                avatarUploadStatus.className = 'upload-status error';
                return;
            }
            
            // Update status
            const uploadId = notifications.info('Uploading', 'Uploading your profile picture...');
            avatarUploadStatus.textContent = 'Uploading';
            avatarUploadStatus.className = 'upload-status loading';
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                // Upload to server
                const response = await fetch(`${API_URL}/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error('Upload failed');
                }
                
                const data = await response.json();
                
                // Update avatar preview and input
                avatarPreview.src = data.url;
                avatarUrlInput.value = data.url;
                
                // Close loading notification and show success
                notifications.close(uploadId);
                notifications.success('Upload Complete', 'Profile picture uploaded successfully!');
                
                // Show success message
                avatarUploadStatus.textContent = 'Upload successful!';
                avatarUploadStatus.className = 'upload-status success';
                
                // Clear the file input
                avatarUpload.value = '';
                
                // Auto-hide the message after 3 seconds
                setTimeout(() => {
                    avatarUploadStatus.textContent = '';
                    avatarUploadStatus.className = 'upload-status';
                }, 3000);
                
            } catch (error) {
                console.error('Upload error:', error);
                
                // Close loading notification and show error
                notifications.close(uploadId);
                notifications.error('Upload Failed', 'Unable to upload image. Please try again or use a URL instead.');
                
                // Show error message
                avatarUploadStatus.textContent = 'Upload failed. Please try again or use a URL instead.';
                avatarUploadStatus.className = 'upload-status error';
                
                // Clear the file input
                avatarUpload.value = '';
            }
        });
    }

    // Add this to toggle URL input visibility
    if (showAvatarUrlBtn) {
        showAvatarUrlBtn.addEventListener('click', () => {
            const urlInput = document.querySelector('.avatar-url-input');
            urlInput.classList.toggle('expanded');
            
            // Toggle icon
            const icon = showAvatarUrlBtn.querySelector('i');
            if (icon.classList.contains('fa-chevron-down')) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        });
    }

    // Update the existing avatar URL preview functionality
    if (avatarUrlInput && avatarPreview) {
        avatarUrlInput.addEventListener('blur', () => {
            const url = avatarUrlInput.value.trim();
            if (url) {
                avatarPreview.src = url;
                avatarPreview.onerror = () => {
                    avatarPreview.src = 'img/default-avatar.png';
                    avatarUploadStatus.textContent = 'Invalid image URL';
                    avatarUploadStatus.className = 'upload-status error';
                    notifications.warning('Invalid URL', 'The image URL you provided is not valid.');
                };
                avatarPreview.onload = () => {
                    avatarUploadStatus.textContent = '';
                    avatarUploadStatus.className = 'upload-status';
                    notifications.success('Image Loaded', 'Profile picture URL set successfully!');
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
                    notifications.warning('Missing Information', 'Please enter your name to continue.');
                    showMessage('Please enter your name', 'error');
                    return;
                }
                
                if (!username) {
                    notifications.warning('Missing Information', 'Please choose a username to continue.');
                    showMessage('Please choose a username', 'error');
                    return;
                }
                
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    notifications.warning('Invalid Username', 'Username can only contain letters, numbers, and underscores.');
                    showMessage('Username can only contain letters, numbers, and underscores', 'error');
                    return;
                }
                
                if (usernameStatus.classList.contains('error')) {
                    notifications.warning('Username Taken', 'Please choose a different username.');
                    showMessage('Please choose a different username', 'error');
                    return;
                }
            }
            
            goToStep(currentStep + 1);
            hideMessage();
            
            // Notify step change
            const stepTitles = ['Basic Information', 'Profile Details', 'Additional Information'];
            notifications.info('Step ' + currentStep + ' of 3', 'Now completing: ' + stepTitles[currentStep-1]);
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
                notifications.error('Invalid Username', 'Username can only contain letters, numbers, and underscores.');
                showMessage('Username can only contain letters, numbers, and underscores', 'error');
                return;
            }
            
            // Validate date of birth if provided
            if (dateOfBirth) {
                const dobDate = new Date(dateOfBirth);
                const today = new Date();
                
                // Check if date is valid
                if (isNaN(dobDate.getTime())) {
                    notifications.error('Invalid Date', 'Please enter a valid date of birth.');
                    showMessage('Please enter a valid date of birth', 'error');
                    return;
                }
                
                // Check if user is at least 13 years old
                const age = today.getFullYear() - dobDate.getFullYear();
                const monthDiff = today.getMonth() - dobDate.getMonth();
                if (age < 13 || (age === 13 && monthDiff < 0) || (age === 13 && monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                    notifications.error('Age Restriction', 'You must be at least 13 years old to use this service.');
                    showMessage('You must be at least 13 years old to use this service', 'error');
                    return;
                }
            }
            
            // Show loading notification
            const saveId = notifications.info('Saving Profile', 'Setting up your profile. This may take a moment...');
            
            // Get current user data
            const currentUser = JSON.parse(localStorage.getItem('user')) || {};
            
            // If username is different from current username, check availability
            if (username !== currentUser.username) {
                try {
                    const checkResponse = await fetch(`${API_URL}/check-url?url=${username}`);
                    const checkData = await checkResponse.json();
                    
                    if (!checkData.available) {
                        notifications.close(saveId);
                        notifications.error('Username Taken', 'This username is already taken. Please choose a different one.');
                        showMessage('Username is already taken. Please choose a different one.', 'error');
                        return;
                    }
                } catch (error) {
                    console.error('Error checking username:', error);
                    notifications.close(saveId);
                    notifications.error('Connection Error', 'Unable to check username availability. Please try again.');
                    showMessage('Connection error. Please try again.', 'error');
                    return;
                }
            }
            
            // Show loading message
            showMessage('Setting up your profile...', 'info');
            
            try {
                // Use the onboarding endpoint which sets onboarding_completed to true
                const response = await fetch(`${API_URL}/onboarding`, {
                    method: 'PUT',
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
                
                const responseData = await response.json();
                
                // Update local storage with new user data
                // Note: We don't need to store onboarding_completed as we'll always check the API
                const userData = JSON.parse(localStorage.getItem('user')) || {};
                userData.username = username;
                userData.name = name;
                userData.avatar_url = avatarUrl || null;
                localStorage.setItem('user', JSON.stringify(userData));
                
                // Close loading notification
                notifications.close(saveId);
                
                // Show success notification
                notifications.success('Profile Complete!', 'Your profile has been set up successfully!');
                
                // Show success message
                showMessage('Profile setup complete! Redirecting...', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } catch (error) {
                console.error('Profile update error:', error);
                
                // Close loading notification
                notifications.close(saveId);
                
                // Show error notification
                notifications.error('Setup Failed', error.message || 'An error occurred while setting up your profile. Please try again.');
                
                showMessage(error.message || 'An error occurred. Please try again.', 'error');
            }
        });
    }
    
    // Load user data if already exists
    const loadUserData = async () => {
        try {
            const loadingId = notifications.info('Loading Profile', 'Retrieving your profile information...');
            
            const response = await fetch(`${API_URL}/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                notifications.close(loadingId);
                
                if (response.status === 401) {
                    notifications.error('Session Expired', 'Your session has expired. Please log in again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    notifications.error('Error', 'Failed to load your profile data.');
                }
                return;
            }
            
            const userData = await response.json();
            
            // Update the user in localStorage with fresh data
            localStorage.setItem('user', JSON.stringify(userData));
            
            // Check if onboarding is already completed from API response
            if (userData.onboarding_completed) {
                notifications.close(loadingId);
                notifications.info('Profile Complete', 'Your profile is already set up. Redirecting to dashboard...');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                return;
            }
            
            // Pre-fill form fields with existing user data
            if (userData.email) {
                // Pre-fill username field - this will now show the username from registration
                if (userData.username) {
                    document.getElementById('onboarding-username').value = userData.username;
                    // Check availability after a short delay
                    setTimeout(() => {
                        usernameInput.dispatchEvent(new Event('blur'));
                    }, 500);
                }
                
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
                
                notifications.close(loadingId);
                
                // If the user has a username from registration, let them know they can change it
                if (userData.username) {
                    notifications.info(
                        'Complete Your Profile', 
                        `We've pre-filled your username from registration (${userData.username}). You can keep it or change it if you'd like.`
                    );
                } else {
                    notifications.success('Welcome', 'Let\'s complete your profile setup!');
                }
            } else {
                notifications.close(loadingId);
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            notifications.error('Connection Error', 'Unable to load your profile data. Please refresh the page.');
        }
    };
    
    // Initialize
    loadUserData();
    goToStep(1);
    
    // Welcome notification
    setTimeout(() => {
        notifications.info('Complete Your Profile', 'Follow these steps to set up your Versz profile.');
    }, 1000);
});
