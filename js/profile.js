document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
    
    // Load user data
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
                    // Token expired or invalid
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            
            // Update profile data
            populateProfileData(userData);
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load profile data', 'error');
        }
    };
    
    // Populate profile data
    const populateProfileData = (userData) => {
        // Personal information
        document.getElementById('profile-username').textContent = userData.username || '(Not set)';
        document.getElementById('profile-name').textContent = userData.name || '(Not set)';
        document.getElementById('profile-email').textContent = userData.email;
        
        // Format joined date
        const joinedDate = new Date(userData.joined_at);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('profile-joined').textContent = joinedDate.toLocaleDateString('en-US', options);
        
        document.getElementById('profile-location').textContent = userData.location || 'Not specified';
        document.getElementById('profile-bio').textContent = userData.bio || 'No bio provided';
        
        // Additional information
        document.getElementById('profile-age').textContent = userData.age || 'Not specified';
        document.getElementById('profile-gender').textContent = userData.gender || 'Not specified';
        document.getElementById('profile-pronouns').textContent = userData.pronouns || 'Not specified';
        
        // Avatar
        if (userData.avatar_url) {
            document.getElementById('profile-avatar').src = userData.avatar_url;
        }
        
        // For edit forms
        document.getElementById('edit-username').value = userData.username || '';
        document.getElementById('edit-name').value = userData.name || '';
        document.getElementById('edit-location').value = userData.location || '';
        document.getElementById('edit-bio').value = userData.bio || '';
        document.getElementById('edit-age').value = userData.age || '';
        document.getElementById('edit-gender').value = userData.gender || '';
        document.getElementById('edit-pronouns').value = userData.pronouns || '';
        document.getElementById('avatar-url').value = userData.avatar_url || '';
        
        // Display preferences
        document.getElementById('pref-show-views').textContent = userData.preferences?.show_views ? 'Yes' : 'No';
        document.getElementById('pref-show-joined').textContent = userData.preferences?.show_joined_date ? 'Yes' : 'No';
        document.getElementById('pref-show-tags').textContent = userData.preferences?.show_tags ? 'Yes' : 'No';
        document.getElementById('pref-show-location').textContent = userData.preferences?.show_location ? 'Yes' : 'No';
        document.getElementById('pref-show-age').textContent = userData.preferences?.show_age ? 'Yes' : 'No';
        document.getElementById('pref-show-gender').textContent = userData.preferences?.show_gender ? 'Yes' : 'No';
        document.getElementById('pref-show-pronouns').textContent = userData.preferences?.show_pronouns ? 'Yes' : 'No';
        document.getElementById('pref-default-layout').textContent = userData.preferences?.default_layout || 'Simple';
        document.getElementById('pref-default-animation').textContent = userData.preferences?.default_animation || 'None';
        
        // For edit forms
        document.getElementById('edit-show-views').checked = userData.preferences?.show_views ?? true;
        document.getElementById('edit-show-joined').checked = userData.preferences?.show_joined_date ?? true;
        document.getElementById('edit-show-tags').checked = userData.preferences?.show_tags ?? true;
        document.getElementById('edit-show-location').checked = userData.preferences?.show_location ?? true;
        document.getElementById('edit-show-age').checked = userData.preferences?.show_age ?? true;
        document.getElementById('edit-show-gender').checked = userData.preferences?.show_gender ?? true;
        document.getElementById('edit-show-pronouns').checked = userData.preferences?.show_pronouns ?? true;
        document.getElementById('edit-default-layout').value = userData.preferences?.default_layout || 'simple';
        document.getElementById('edit-default-animation').value = userData.preferences?.default_animation || 'none';
        
        // Stats
        document.getElementById('stat-pages').textContent = userData.page_count || 0;
        document.getElementById('stat-views').textContent = userData.total_views || 0;
        document.getElementById('stat-templates').textContent = userData.templates_used || 0;
        document.getElementById('stat-status').textContent = userData.account_status || 'Active';
        
        // User tags
        const tagsContainer = document.getElementById('user-tags');
        if (userData.tags && userData.tags.length > 0) {
            tagsContainer.innerHTML = '';
            
            userData.tags.forEach(tag => {
                const tagElement = document.createElement('div');
                tagElement.className = 'user-tag';
                
                tagElement.innerHTML = `
                    <div class="tag-icon">
                        <i class="fas fa-tag"></i>
                    </div>
                    <span>${tag}</span>
                `;
                
                tagsContainer.appendChild(tagElement);
            });
        } else {
            tagsContainer.innerHTML = `
                <div class="empty-tags">
                    <p>No tags assigned yet</p>
                </div>
            `;
        }
        
        // Show verification resend button if not verified
        if (!userData.is_verified) {
            document.getElementById('resend-verification-btn').style.display = 'inline-flex';
        }
        
        // Set public profile URL
        document.getElementById('view-public-profile').href = `https://versz.fun/p/${userData.username}`;
    };
    
    // Edit buttons
    const editPersonalBtn = document.getElementById('edit-personal-btn');
    const editAdditionalBtn = document.getElementById('edit-additional-btn');
    const editPreferencesBtn = document.getElementById('edit-preferences-btn');
    
    // Edit personal info
    if (editPersonalBtn) {
        editPersonalBtn.addEventListener('click', () => {
            // Show edit fields, hide display values
            const personalSection = editPersonalBtn.closest('.profile-section');
            const fieldValues = personalSection.querySelectorAll('.field-value');
            const fieldEdits = personalSection.querySelectorAll('.field-edit');
            const editActions = document.getElementById('personal-edit-actions');
            const avatarUpload = document.getElementById('avatar-upload');
            
            fieldValues.forEach(field => field.style.display = 'none');
            fieldEdits.forEach(field => field.style.display = 'block');
            editActions.style.display = 'flex';
            avatarUpload.style.display = 'block';
            
            // Hide edit button
            editPersonalBtn.style.display = 'none';
        });
    }
    
    // Cancel personal edit
    const cancelPersonalBtn = document.getElementById('cancel-personal-btn');
    if (cancelPersonalBtn) {
        cancelPersonalBtn.addEventListener('click', () => {
            // Hide edit fields, show display values
            const personalSection = cancelPersonalBtn.closest('.profile-section');
            const fieldValues = personalSection.querySelectorAll('.field-value');
            const fieldEdits = personalSection.querySelectorAll('.field-edit');
            const editActions = document.getElementById('personal-edit-actions');
            const avatarUpload = document.getElementById('avatar-upload');
            
            fieldValues.forEach(field => field.style.display = 'block');
            fieldEdits.forEach(field => field.style.display = 'none');
            editActions.style.display = 'none';
            avatarUpload.style.display = 'none';
            
            // Show edit button
            editPersonalBtn.style.display = 'inline-flex';
            
            // Reset form values
            loadUserData();
        });
    }
    
    // Save personal info
    const savePersonalBtn = document.getElementById('save-personal-btn');
    if (savePersonalBtn) {
        savePersonalBtn.addEventListener('click', async () => {
            try {
                // Show loading state
                savePersonalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                savePersonalBtn.disabled = true;
                
                // Collect form data
                const username = document.getElementById('edit-username').value;
                const name = document.getElementById('edit-name').value;
                const location = document.getElementById('edit-location').value;
                const bio = document.getElementById('edit-bio').value;
                
                // Validate username
                if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
                    showNotification('Username can only contain letters, numbers, and underscores', 'error');
                    savePersonalBtn.innerHTML = 'Save Changes';
                    savePersonalBtn.disabled = false;
                    return;
                }
                
                // Check username availability if changed
                const currentUsername = document.getElementById('profile-username').textContent;
                if (username !== currentUsername && username) {
                    const checkResponse = await fetch(`${API_URL}/check-url?url=${username}`);
                    const checkData = await checkResponse.json();
                    
                    if (!checkData.available) {
                        showNotification('Username is already taken', 'error');
                        savePersonalBtn.innerHTML = 'Save Changes';
                        savePersonalBtn.disabled = false;
                        return;
                    }
                }
                
                // Submit update
                const response = await fetch(`${API_URL}/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        username: username,
                        name: name,
                        location: location || null,
                        bio: bio || null
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update profile');
                }
                
                // Show success message
                showNotification('Personal information updated successfully', 'success');
                
                // Reload user data
                await loadUserData();
                
                // Hide edit fields, show display values
                const personalSection = savePersonalBtn.closest('.profile-section');
                const fieldValues = personalSection.querySelectorAll('.field-value');
                const fieldEdits = personalSection.querySelectorAll('.field-edit');
                const editActions = document.getElementById('personal-edit-actions');
                const avatarUpload = document.getElementById('avatar-upload');
                
                fieldValues.forEach(field => field.style.display = 'block');
                fieldEdits.forEach(field => field.style.display = 'none');
                editActions.style.display = 'none';
                avatarUpload.style.display = 'none';
                
                // Show edit button
                editPersonalBtn.style.display = 'inline-flex';
                
                // Update avatar in profile and sidebar if changed
                if (document.getElementById('avatar-url').value) {
                    document.getElementById('sidebar-avatar').src = document.getElementById('avatar-url').value;
                }
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification(error.message || 'Failed to update profile', 'error');
            } finally {
                savePersonalBtn.innerHTML = 'Save Changes';
                savePersonalBtn.disabled = false;
            }
        });
    }
    
    // Update avatar separately
    const updateAvatarBtn = document.getElementById('update-avatar-btn');
    if (updateAvatarBtn) {
        updateAvatarBtn.addEventListener('click', async () => {
            try {
                const avatarUrl = document.getElementById('avatar-url').value;
                
                if (!avatarUrl) {
                    showNotification('Please enter an avatar URL', 'error');
                    return;
                }
                
                // Show loading state
                updateAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                updateAvatarBtn.disabled = true;
                
                // Submit update
                const response = await fetch(`${API_URL}/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        avatar_url: avatarUrl
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update avatar');
                }
                
                // Update avatar preview
                document.getElementById('profile-avatar').src = avatarUrl;
                
                // Update sidebar avatar
                document.getElementById('sidebar-avatar').src = avatarUrl;
                
                // Show success message
                showNotification('Avatar updated successfully', 'success');
                
            } catch (error) {
                console.error('Error updating avatar:', error);
                showNotification(error.message || 'Failed to update avatar', 'error');
            } finally {
                updateAvatarBtn.innerHTML = 'Update';
                updateAvatarBtn.disabled = false;
            }
        });
    }
    
    // Edit additional info
    if (editAdditionalBtn) {
        editAdditionalBtn.addEventListener('click', () => {
            // Show edit fields, hide display values
            const additionalSection = editAdditionalBtn.closest('.profile-section');
            const fieldValues = additionalSection.querySelectorAll('.field-value');
            const fieldEdits = additionalSection.querySelectorAll('.field-edit');
            const editActions = document.getElementById('additional-edit-actions');
            
            fieldValues.forEach(field => field.style.display = 'none');
            fieldEdits.forEach(field => field.style.display = 'block');
            editActions.style.display = 'flex';
            
            // Show custom pronouns field if selected
            const pronounsSelect = document.getElementById('edit-pronouns');
            const customPronouns = document.getElementById('custom-pronouns');
            
            if (pronounsSelect.value === 'custom') {
                customPronouns.style.display = 'block';
            }
            if (pronounsSelect.value === 'custom') {
                customPronouns.style.display = 'block';
            }
            
            // Hide edit button
            editAdditionalBtn.style.display = 'none';
        });
    }
    
    // Custom pronouns toggle
    const pronounsSelect = document.getElementById('edit-pronouns');
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
    
    // Cancel additional edit
    const cancelAdditionalBtn = document.getElementById('cancel-additional-btn');
    if (cancelAdditionalBtn) {
        cancelAdditionalBtn.addEventListener('click', () => {
            // Hide edit fields, show display values
            const additionalSection = cancelAdditionalBtn.closest('.profile-section');
            const fieldValues = additionalSection.querySelectorAll('.field-value');
            const fieldEdits = additionalSection.querySelectorAll('.field-edit');
            const editActions = document.getElementById('additional-edit-actions');
            
            fieldValues.forEach(field => field.style.display = 'block');
            fieldEdits.forEach(field => field.style.display = 'none');
            editActions.style.display = 'none';
            
            // Show edit button
            editAdditionalBtn.style.display = 'inline-flex';
            
            // Reset form values
            loadUserData();
        });
    }
    
    // Save additional info
    const saveAdditionalBtn = document.getElementById('save-additional-btn');
    if (saveAdditionalBtn) {
        saveAdditionalBtn.addEventListener('click', async () => {
            try {
                // Show loading state
                saveAdditionalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                saveAdditionalBtn.disabled = true;
                
                // Collect form data
                const age = document.getElementById('edit-age').value;
                const gender = document.getElementById('edit-gender').value;
                
                let pronouns = document.getElementById('edit-pronouns').value;
                if (pronouns === 'custom') {
                    pronouns = document.getElementById('custom-pronouns-text').value;
                }
                
                // Submit update
                const response = await fetch(`${API_URL}/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        age: age ? parseInt(age) : null,
                        gender: gender || null,
                        pronouns: pronouns || null
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update profile');
                }
                
                // Show success message
                showNotification('Additional information updated successfully', 'success');
                
                // Reload user data
                await loadUserData();
                
                // Hide edit fields, show display values
                const additionalSection = saveAdditionalBtn.closest('.profile-section');
                const fieldValues = additionalSection.querySelectorAll('.field-value');
                const fieldEdits = additionalSection.querySelectorAll('.field-edit');
                const editActions = document.getElementById('additional-edit-actions');
                
                fieldValues.forEach(field => field.style.display = 'block');
                fieldEdits.forEach(field => field.style.display = 'none');
                editActions.style.display = 'none';
                
                // Show edit button
                editAdditionalBtn.style.display = 'inline-flex';
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification(error.message || 'Failed to update profile', 'error');
            } finally {
                saveAdditionalBtn.innerHTML = 'Save Changes';
                saveAdditionalBtn.disabled = false;
            }
        });
    }
    
    // Edit preferences
    if (editPreferencesBtn) {
        editPreferencesBtn.addEventListener('click', () => {
            // Show edit fields, hide display values
            const preferencesSection = editPreferencesBtn.closest('.profile-section');
            const fieldValues = preferencesSection.querySelectorAll('.field-value');
            const fieldEdits = preferencesSection.querySelectorAll('.field-edit');
            const editActions = document.getElementById('preferences-edit-actions');
            
            fieldValues.forEach(field => field.style.display = 'none');
            fieldEdits.forEach(field => field.style.display = 'block');
            editActions.style.display = 'flex';
            
            // Hide edit button
            editPreferencesBtn.style.display = 'none';
        });
    }
    
    // Cancel preferences edit
    const cancelPreferencesBtn = document.getElementById('cancel-preferences-btn');
    if (cancelPreferencesBtn) {
        cancelPreferencesBtn.addEventListener('click', () => {
            // Hide edit fields, show display values
            const preferencesSection = cancelPreferencesBtn.closest('.profile-section');
            const fieldValues = preferencesSection.querySelectorAll('.field-value');
            const fieldEdits = preferencesSection.querySelectorAll('.field-edit');
            const editActions = document.getElementById('preferences-edit-actions');
            
            fieldValues.forEach(field => field.style.display = 'block');
            fieldEdits.forEach(field => field.style.display = 'none');
            editActions.style.display = 'none';
            
            // Show edit button
            editPreferencesBtn.style.display = 'inline-flex';
            
            // Reset form values
            loadUserData();
        });
    }
    
    // Save preferences
    const savePreferencesBtn = document.getElementById('save-preferences-btn');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', async () => {
            try {
                // Show loading state
                savePreferencesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                savePreferencesBtn.disabled = true;
                
                // Collect form data
                const showViews = document.getElementById('edit-show-views').checked;
                const showJoined = document.getElementById('edit-show-joined').checked;
                const showTags = document.getElementById('edit-show-tags').checked;
                const showLocation = document.getElementById('edit-show-location').checked;
                const showAge = document.getElementById('edit-show-age').checked;
                const showGender = document.getElementById('edit-show-gender').checked;
                const showPronouns = document.getElementById('edit-show-pronouns').checked;
                const defaultLayout = document.getElementById('edit-default-layout').value;
                const defaultAnimation = document.getElementById('edit-default-animation').value;
                
                // Submit update
                const response = await fetch(`${API_URL}/update-preferences`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        show_views: showViews,
                        show_joined_date: showJoined,
                        show_tags: showTags,
                        show_location: showLocation,
                        show_age: showAge,
                        show_gender: showGender,
                        show_pronouns: showPronouns,
                        default_layout: defaultLayout,
                        default_animation: defaultAnimation
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update preferences');
                }
                
                // Show success message
                showNotification('Preferences updated successfully', 'success');
                
                // Reload user data
                await loadUserData();
                
                // Hide edit fields, show display values
                const preferencesSection = savePreferencesBtn.closest('.profile-section');
                const fieldValues = preferencesSection.querySelectorAll('.field-value');
                const fieldEdits = preferencesSection.querySelectorAll('.field-edit');
                const editActions = document.getElementById('preferences-edit-actions');
                
                fieldValues.forEach(field => field.style.display = 'block');
                fieldEdits.forEach(field => field.style.display = 'none');
                editActions.style.display = 'none';
                
                // Show edit button
                editPreferencesBtn.style.display = 'inline-flex';
                
            } catch (error) {
                console.error('Error updating preferences:', error);
                showNotification(error.message || 'Failed to update preferences', 'error');
            } finally {
                savePreferencesBtn.innerHTML = 'Save Changes';
                savePreferencesBtn.disabled = false;
            }
        });
    }
    
    // Change password
    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            // Open password change modal
            const modal = document.getElementById('change-password-modal');
            modal.classList.add('active');
            
            // Reset form
            document.getElementById('change-password-form').reset();
            document.getElementById('password-message').textContent = '';
            document.getElementById('password-message').className = 'auth-message';
            
            // Close modal when clicking outside or on close button
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
            
            document.querySelector('#change-password-modal .modal-close').addEventListener('click', () => {
                modal.classList.remove('active');
            });
        });
    }
    
    // Password validation
    const newPasswordField = document.getElementById('new-password');
    const pwReqLength = document.getElementById('pw-req-length');
    const pwReqUppercase = document.getElementById('pw-req-uppercase');
    const pwReqLowercase = document.getElementById('pw-req-lowercase');
    const pwReqNumber = document.getElementById('pw-req-number');
    
    if (newPasswordField) {
        newPasswordField.addEventListener('input', function() {
            const password = this.value;
            
            // Check requirements
            const hasLength = password.length >= 8;
            const hasUppercase = /[A-Z]/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            
            // Update UI
            pwReqLength.innerHTML = `<i class="fas ${hasLength ? 'fa-check' : 'fa-times'}"></i> At least 8 characters`;
            pwReqLength.className = hasLength ? 'valid' : '';
            
            pwReqUppercase.innerHTML = `<i class="fas ${hasUppercase ? 'fa-check' : 'fa-times'}"></i> One uppercase letter`;
            pwReqUppercase.className = hasUppercase ? 'valid' : '';
            
            pwReqLowercase.innerHTML = `<i class="fas ${hasLowercase ? 'fa-check' : 'fa-times'}"></i> One lowercase letter`;
            pwReqLowercase.className = hasLowercase ? 'valid' : '';
            
            pwReqNumber.innerHTML = `<i class="fas ${hasNumber ? 'fa-check' : 'fa-times'}"></i> One number`;
            pwReqNumber.className = hasNumber ? 'valid' : '';
        });
    }
    
    // Password toggle visibility
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordField = this.parentElement.querySelector('input');
            const type = passwordField.getAttribute('type');
            
            if (type === 'password') {
                passwordField.setAttribute('type', 'text');
                this.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                passwordField.setAttribute('type', 'password');
                this.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });
    
    // Change password form submission
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const passwordMessage = document.getElementById('password-message');
            
            // Validate password
            const hasLength = newPassword.length >= 8;
            const hasUppercase = /[A-Z]/.test(newPassword);
            const hasLowercase = /[a-z]/.test(newPassword);
            const hasNumber = /[0-9]/.test(newPassword);
            
            if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber) {
                passwordMessage.textContent = 'Please meet all password requirements.';
                passwordMessage.className = 'auth-message error';
                return;
            }
            
            // Check if passwords match
            if (newPassword !== confirmPassword) {
                passwordMessage.textContent = 'Passwords do not match.';
                passwordMessage.className = 'auth-message error';
                return;
            }
            
            passwordMessage.textContent = 'Changing password...';
            passwordMessage.className = 'auth-message info';
            
            try {
                const response = await fetch(`${API_URL}/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    passwordMessage.textContent = 'Password changed successfully!';
                    passwordMessage.className = 'auth-message success';
                    
                    // Close modal after a delay
                    setTimeout(() => {
                        document.getElementById('change-password-modal').classList.remove('active');
                    }, 2000);
                } else {
                    passwordMessage.textContent = data.detail || 'Failed to change password.';
                    passwordMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Password change error:', error);
                passwordMessage.textContent = 'An error occurred. Please try again.';
                passwordMessage.className = 'auth-message error';
            }
        });
    }
    
    // Resend verification email
    const resendVerificationBtn = document.getElementById('resend-verification-btn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', async () => {
            try {
                // Show loading state
                resendVerificationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                resendVerificationBtn.disabled = true;
                
                const response = await fetch(`${API_URL}/resend-verification`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to resend verification email');
                }
                
                // Show success message
                showNotification('Verification email sent! Please check your inbox.', 'success');
                
            } catch (error) {
                console.error('Error sending verification email:', error);
                showNotification(error.message || 'Failed to send verification email', 'error');
            } finally {
                resendVerificationBtn.innerHTML = 'Resend Verification';
                resendVerificationBtn.disabled = false;
            }
        });
    }
    
    // Delete account button
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            // Open delete account confirmation modal
            const modal = document.getElementById('delete-account-modal');
            modal.classList.add('active');
            
            // Close modal when clicking outside or on close button
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
            
            document.querySelector('#delete-account-modal .modal-close').addEventListener('click', () => {
                modal.classList.remove('active');
            });
        });
    }
    
    // Cancel delete account
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            document.getElementById('delete-account-modal').classList.remove('active');
        });
    }
    
    // Confirm delete account
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            try {
                // Show loading state
                confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                confirmDeleteBtn.disabled = true;
                
                const password = document.getElementById('delete-account-password').value;
                
                if (!password) {
                    showNotification('Please enter your password to confirm', 'error');
                    confirmDeleteBtn.innerHTML = 'Yes, Delete My Account';
                    confirmDeleteBtn.disabled = false;
                    return;
                }
                
                const response = await fetch(`${API_URL}/delete-account`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        password: password
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to delete account');
                }
                
                // Show success message
                showNotification('Account deleted successfully. Redirecting...', 'success');
                
                // Clear local storage and redirect to home
                setTimeout(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'index.html';
                }, 2000);
                
            } catch (error) {
                console.error('Error deleting account:', error);
                showNotification(error.message || 'Failed to delete account', 'error');
                confirmDeleteBtn.innerHTML = 'Yes, Delete My Account';
                confirmDeleteBtn.disabled = false;
            }
        });
    }
    
    // Show notification
    const showNotification = (message, type = 'info') => {
        // Create notification element if it doesn't exist
        let notification = document.querySelector('.notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        // Set message and type
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        // Show notification
        notification.classList.add('active');
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    };
    
    // Initialize page
    const initProfilePage = async () => {
        await loadUserData();
    };
    
    initProfilePage();
});