document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    
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
    
    // Load timezones
    const loadTimezones = async () => {
        try {
            const timezoneSelect = document.getElementById('edit-timezone');
            if (!timezoneSelect) return;
            
            const response = await fetch(`${API_URL}/timezones`);
            if (!response.ok) {
                console.error('Failed to load timezones');
                return;
            }
            
            const data = await response.json();
            const timezones = data.timezones;
            
            // Clear existing options except the first one
            while (timezoneSelect.options.length > 1) {
                timezoneSelect.remove(1);
            }
            
            // Add timezones to select dropdown
            timezones.forEach(timezone => {
                const option = document.createElement('option');
                option.value = timezone;
                option.textContent = timezone;
                timezoneSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading timezones:', error);
        }
    };
    
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
            
            // Save user data to localStorage for easy access
            localStorage.setItem('user', JSON.stringify(userData));
            
            // Update sidebar
            updateSidebar(userData);
            
            // Update profile data
            populateProfileData(userData);
            
            // Load timezones after getting user data
            await loadTimezones();
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load profile data', 'error');
        }
    };
    
    // Update sidebar with user info
    const updateSidebar = (userData) => {
        if (userData.avatar_url) {
            document.getElementById('sidebar-avatar').src = userData.avatar_url;
        }
        document.getElementById('sidebar-username').textContent = userData.username || 'Username';
        document.getElementById('sidebar-email').textContent = userData.email || 'user@example.com';
    };
    
    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Not specified';
        
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
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
        document.getElementById('profile-timezone').textContent = userData.timezone || 'Not specified';
        document.getElementById('profile-bio').textContent = userData.bio || 'No bio provided';
        
        // Additional information
        document.getElementById('profile-dob').textContent = formatDate(userData.date_of_birth);
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
        document.getElementById('edit-timezone').value = userData.timezone || '';
        document.getElementById('edit-bio').value = userData.bio || '';
        document.getElementById('edit-dob').value = userData.date_of_birth || '';
        document.getElementById('edit-gender').value = userData.gender || '';
        document.getElementById('edit-pronouns').value = userData.pronouns || '';
        document.getElementById('avatar-url').value = userData.avatar_url || '';
        
        // Handle custom pronouns
        if (userData.pronouns && !['he/him', 'she/her', 'they/them', ''].includes(userData.pronouns)) {
            document.getElementById('edit-pronouns').value = 'custom';
            document.getElementById('custom-pronouns').value = userData.pronouns;
            document.getElementById('custom-pronouns').style.display = 'block';
        }
        
        // Display preferences
        const displayPrefs = userData.display_preferences || {};
        
        document.getElementById('pref-show-views').textContent = displayPrefs.show_views !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-joined').textContent = displayPrefs.show_joined_date !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-tags').textContent = displayPrefs.show_tags !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-location').textContent = displayPrefs.show_location !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-dob').textContent = displayPrefs.show_dob !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-gender').textContent = displayPrefs.show_gender !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-pronouns').textContent = displayPrefs.show_pronouns !== false ? 'Yes' : 'No';
        document.getElementById('pref-show-timezone').textContent = displayPrefs.show_timezone !== false ? 'Yes' : 'No';
        
        // For edit forms
        document.getElementById('edit-show-views').checked = displayPrefs.show_views !== false;
        document.getElementById('edit-show-joined').checked = displayPrefs.show_joined_date !== false;
        document.getElementById('edit-show-tags').checked = displayPrefs.show_tags !== false;
        document.getElementById('edit-show-location').checked = displayPrefs.show_location !== false;
        document.getElementById('edit-show-dob').checked = displayPrefs.show_dob !== false;
        document.getElementById('edit-show-gender').checked = displayPrefs.show_gender !== false;
        document.getElementById('edit-show-pronouns').checked = displayPrefs.show_pronouns !== false;
        document.getElementById('edit-show-timezone').checked = displayPrefs.show_timezone !== false;
        
        // Stats
        document.getElementById('stat-pages').textContent = userData.page_count || 0;
        
        // Calculate total views (this may need to be adjusted based on your API)
        let totalViews = 0;
        if (userData.pages) {
            userData.pages.forEach(page => {
                totalViews += page.views || 0;
            });
        }
        document.getElementById('stat-views').textContent = totalViews;
        
        document.getElementById('stat-templates').textContent = userData.templates_used || 0;
        document.getElementById('stat-status').textContent = userData.is_verified ? 'Verified' : 'Pending Verification';
        
        // User tags
        const tagsContainer = document.getElementById('user-tags');
        if (userData.tags && userData.tags.length > 0) {
            tagsContainer.innerHTML = '';
            
            userData.tags.forEach(tag => {
                const tagElement = document.createElement('div');
                tagElement.className = 'user-tag';
                
                let tagContent = '';
                if (typeof tag === 'string') {
                    tagContent = `
                        <div class="tag-icon">
                            <i class="fas fa-tag"></i>
                        </div>
                        <span>${tag}</span>
                    `;
                } else if (typeof tag === 'object') {
                    let iconHtml = '';
                    if (tag.icon_type === 'emoji') {
                        iconHtml = tag.icon;
                    } else if (tag.icon_type === 'svg') {
                        iconHtml = tag.icon;
                    } else {
                        iconHtml = `<i class="fas fa-tag"></i>`;
                    }
                    
                    tagContent = `
                        <div class="tag-icon">
                            ${iconHtml}
                        </div>
                        <span>${tag.text || tag.name}</span>
                    `;
                }
                
                tagElement.innerHTML = tagContent;
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
        } else {
            document.getElementById('resend-verification-btn').style.display = 'none';
        }
        
        // Set public profile URL
        const viewProfileLink = document.getElementById('view-public-profile');
        if (userData.username) {
            viewProfileLink.href = `https://versz.fun/${userData.username}`;
            viewProfileLink.style.display = 'inline-flex';
        } else {
            viewProfileLink.style.display = 'none';
        }
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

    


    // Avatar file upload
    const avatarFileInput = document.getElementById('avatar-file');
    const avatarUrlInput = document.getElementById('avatar-url');
    const avatarPreview = document.getElementById('profile-avatar');
    const avatarUploadStatus = document.getElementById('avatar-upload-status');

    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                avatarUploadStatus.textContent = 'Please select an image file';
                avatarUploadStatus.className = 'upload-status error';
                return;
            }
            
            // Check file size (max 32MB)
            const MAX_SIZE = 32 * 1024 * 1024; // 32MB
            if (file.size > MAX_SIZE) {
                avatarUploadStatus.textContent = 'File too large (max 32MB)';
                avatarUploadStatus.className = 'upload-status error';
                return;
            }
            
            // Update status
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
                
                // Show success message
                avatarUploadStatus.textContent = 'Upload successful!';
                avatarUploadStatus.className = 'upload-status success';
                
                // Update the URL field with the new image URL
                document.getElementById('avatar-url').value = data.url;
                
                // Show URL as expandable
                const showUrlBtn = document.getElementById('show-avatar-url');
                if (showUrlBtn) {
                    showUrlBtn.querySelector('i').classList.remove('fa-chevron-down');
                    showUrlBtn.querySelector('i').classList.add('fa-chevron-up');
                }
                
                // Clear the file input
                avatarFileInput.value = '';
                
                // Auto-hide the message after 3 seconds
                setTimeout(() => {
                    avatarUploadStatus.textContent = '';
                    avatarUploadStatus.className = 'upload-status';
                }, 3000);
                
            } catch (error) {
                console.error('Upload error:', error);
                
                // Show error message
                avatarUploadStatus.textContent = 'Upload failed. Please try again or use a URL instead.';
                avatarUploadStatus.className = 'upload-status error';
                
                // Clear the file input
                avatarFileInput.value = '';
            }
        });
    }

    // Toggle URL input visibility
    const showAvatarUrlBtn = document.getElementById('show-avatar-url');
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

    // Update avatar URL input preview
    if (avatarUrlInput && avatarPreview) {
        avatarUrlInput.addEventListener('blur', () => {
            const url = avatarUrlInput.value.trim();
            if (url) {
                avatarPreview.src = url;
                avatarPreview.onerror = () => {
                    avatarPreview.src = 'img/default-avatar.png';
                    avatarUploadStatus.textContent = 'Invalid image URL';
                    avatarUploadStatus.className = 'upload-status error';
                };
                avatarPreview.onload = () => {
                    avatarUploadStatus.textContent = '';
                    avatarUploadStatus.className = 'upload-status';
                };
            } else {
                avatarPreview.src = 'img/default-avatar.png';
            }
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
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            document.getElementById('edit-username').value = userData.username || '';
            document.getElementById('edit-name').value = userData.name || '';
            document.getElementById('edit-location').value = userData.location || '';
            document.getElementById('edit-timezone').value = userData.timezone || '';
            document.getElementById('edit-bio').value = userData.bio || '';
            document.getElementById('avatar-url').value = userData.avatar_url || '';
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
                const timezone = document.getElementById('edit-timezone').value;
                const bio = document.getElementById('edit-bio').value;
                
                // Validate username
                if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
                    showNotification('Username can only contain letters, numbers, and underscores', 'error');
                    savePersonalBtn.innerHTML = 'Save Changes';
                    savePersonalBtn.disabled = false;
                    return;
                }
                
                // Check username availability if changed
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                if (username !== userData.username && username) {
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
                        username: username || null,
                        name: name || null,
                        location: location || null,
                        timezone: timezone || null,
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
                    avatarUploadStatus.textContent = 'Please enter an avatar URL or upload an image';
                    avatarUploadStatus.className = 'upload-status error';
                    return;
                }
                
                // Show loading state
                updateAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                updateAvatarBtn.disabled = true;
                avatarUploadStatus.textContent = 'Updating profile...';
                avatarUploadStatus.className = 'upload-status loading';
                
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
                
                // Update user data in localStorage
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                userData.avatar_url = avatarUrl;
                localStorage.setItem('user', JSON.stringify(userData));
                
                // Show success message
                avatarUploadStatus.textContent = 'Avatar updated successfully!';
                avatarUploadStatus.className = 'upload-status success';
                showNotification('Avatar updated successfully', 'success');
                
                // Auto-hide the message after 3 seconds
                setTimeout(() => {
                    avatarUploadStatus.textContent = '';
                    avatarUploadStatus.className = 'upload-status';
                }, 3000);
                
            } catch (error) {
                console.error('Error updating avatar:', error);
                avatarUploadStatus.textContent = error.message || 'Failed to update avatar';
                avatarUploadStatus.className = 'upload-status error';
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
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            document.getElementById('edit-dob').value = userData.date_of_birth || '';
            document.getElementById('edit-gender').value = userData.gender || '';
            document.getElementById('edit-pronouns').value = userData.pronouns || '';
            
            // Hide custom pronouns field
            customPronouns.style.display = 'none';
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
                const dateOfBirth = document.getElementById('edit-dob').value;
                const gender = document.getElementById('edit-gender').value;
                
                let pronouns = document.getElementById('edit-pronouns').value;
                if (pronouns === 'custom') {
                    pronouns = document.getElementById('custom-pronouns').value;
                    if (!pronouns) {
                        showNotification('Please enter your custom pronouns', 'error');
                        saveAdditionalBtn.innerHTML = 'Save Changes';
                        saveAdditionalBtn.disabled = false;
                        return;
                    }
                }
                
                // Validate date of birth
                if (dateOfBirth) {
                    const dobDate = new Date(dateOfBirth);
                    const today = new Date();
                    
                    if (isNaN(dobDate.getTime())) {
                        showNotification('Please enter a valid date of birth', 'error');
                        saveAdditionalBtn.innerHTML = 'Save Changes';
                        saveAdditionalBtn.disabled = false;
                        return;
                    }
                    
                    // Check if user is at least 13 years old
                    const age = today.getFullYear() - dobDate.getFullYear();
                    const monthDiff = today.getMonth() - dobDate.getMonth();
                    if (age < 13 || (age === 13 && monthDiff < 0) || (age === 13 && monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                        showNotification('You must be at least 13 years old to use this service', 'error');
                        saveAdditionalBtn.innerHTML = 'Save Changes';
                        saveAdditionalBtn.disabled = false;
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
                        date_of_birth: dateOfBirth || null,
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
            const preferenceValues = preferencesSection.querySelectorAll('.preference-value');
            const preferenceEdits = preferencesSection.querySelectorAll('.preference-edit');
            const editActions = document.getElementById('preferences-edit-actions');
            
            preferenceValues.forEach(field => field.style.display = 'none');
            preferenceEdits.forEach(field => field.style.display = 'block');
            editActions.style.display = 'flex';
            
            // Hide edit button
            editPreferencesBtn.style.display = 'none';
        });
    }
    
    // Cancel preferences edit
    const cancelPreferencesBtn = document.getElementById('cancel-preferences-btn');
    if (cancelPreferencesBtn) {
        cancelPreferencesBtn.addEventListener('click', () => {
            // Find the preferences section directly
            const preferencesSection = document.querySelector('.profile-section:nth-child(3)');
            if (preferencesSection) {
                const preferenceValues = preferencesSection.querySelectorAll('.preference-value');
                const preferenceEdits = preferencesSection.querySelectorAll('.preference-edit');
                const editActions = document.getElementById('preferences-edit-actions');
                
                preferenceValues.forEach(field => field.style.display = 'block');
                preferenceEdits.forEach(field => field.style.display = 'none');
                
                if (editActions) {
                    editActions.style.display = 'none';
                }
                
                // Show edit button
                if (editPreferencesBtn) {
                    editPreferencesBtn.style.display = 'inline-flex';
                }
            }
            
            // Reset form values
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const displayPrefs = userData.display_preferences || {};
            
            document.getElementById('edit-show-views').checked = displayPrefs.show_views !== false;
            document.getElementById('edit-show-joined').checked = displayPrefs.show_joined_date !== false;
            document.getElementById('edit-show-tags').checked = displayPrefs.show_tags !== false;
            document.getElementById('edit-show-location').checked = displayPrefs.show_location !== false;
            document.getElementById('edit-show-dob').checked = displayPrefs.show_dob !== false;
            document.getElementById('edit-show-gender').checked = displayPrefs.show_gender !== false;
            document.getElementById('edit-show-pronouns').checked = displayPrefs.show_pronouns !== false;
            document.getElementById('edit-show-timezone').checked = displayPrefs.show_timezone !== false;
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
                const showDob = document.getElementById('edit-show-dob').checked;
                const showGender = document.getElementById('edit-show-gender').checked;
                const showPronouns = document.getElementById('edit-show-pronouns').checked;
                const showTimezone = document.getElementById('edit-show-timezone').checked;
                
                // Submit update
                const response = await fetch(`${API_URL}/preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        show_views: showViews,
                        show_joined_date: showJoined,
                        show_tags: showTags,
                        show_location: showLocation,
                        show_dob: showDob,
                        show_gender: showGender,
                        show_pronouns: showPronouns,
                        show_timezone: showTimezone,
                        default_layout: "standard",
                        default_background: {
                            type: "solid",
                            value: "#ffffff"
                        },
                        default_name_style: {
                            color: "#000000",
                            font: {
                                name: "Default",
                                value: "",
                                link: ""
                            }
                        },
                        default_username_style: {
                            color: "#555555",
                            font: {
                                name: "Default",
                                value: "",
                                link: ""
                            }
                        }
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
                
                // Find the preferences section directly
                const preferencesSection = document.querySelector('.profile-section:nth-child(3)');
                if (preferencesSection) {
                    const preferenceValues = preferencesSection.querySelectorAll('.preference-value');
                    const preferenceEdits = preferencesSection.querySelectorAll('.preference-edit');
                    const editActions = document.getElementById('preferences-edit-actions');
                    
                    preferenceValues.forEach(field => field.style.display = 'block');
                    preferenceEdits.forEach(field => field.style.display = 'none');
                    
                    if (editActions) {
                        editActions.style.display = 'none';
                    }
                    
                    // Show edit button
                    if (editPreferencesBtn) {
                        editPreferencesBtn.style.display = 'inline-flex';
                    }
                }
                
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
    const changePasswordModal = document.getElementById('change-password-modal');
    
    if (changePasswordBtn && changePasswordModal) {
        changePasswordBtn.addEventListener('click', () => {
            // Open password change modal
            changePasswordModal.classList.add('active');
            changePasswordModal.style.display = 'flex';
            
            // Reset form
            document.getElementById('change-password-form').reset();
            document.getElementById('password-message').textContent = '';
            document.getElementById('password-message').className = 'auth-message';
            
            // Reset password requirements
            const pwReqLength = document.getElementById('pw-req-length');
            const pwReqUppercase = document.getElementById('pw-req-uppercase');
            const pwReqLowercase = document.getElementById('pw-req-lowercase');
            const pwReqNumber = document.getElementById('pw-req-number');
            
            pwReqLength.innerHTML = '<i class="fas fa-times"></i> At least 8 characters';
            pwReqLength.className = '';
            
            pwReqUppercase.innerHTML = '<i class="fas fa-times"></i> One uppercase letter';
            pwReqUppercase.className = '';
            
            pwReqLowercase.innerHTML = '<i class="fas fa-times"></i> One lowercase letter';
            pwReqLowercase.className = '';
            
            pwReqNumber.innerHTML = '<i class="fas fa-times"></i> One number';
            pwReqNumber.className = '';
        });
        
        // Close modal when clicking outside or on close button
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) {
                changePasswordModal.classList.remove('active');
                changePasswordModal.style.display = 'none';
            }
        });
        
        const modalClose = changePasswordModal.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                changePasswordModal.classList.remove('active');
                changePasswordModal.style.display = 'none';
            });
        }
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
                passwordMessage.style.display = 'block';
                return;
            }
            
            // Check if passwords match
            if (newPassword !== confirmPassword) {
                passwordMessage.textContent = 'Passwords do not match.';
                passwordMessage.className = 'auth-message error';
                passwordMessage.style.display = 'block';
                return;
            }
            
            passwordMessage.textContent = 'Changing password...';
            passwordMessage.className = 'auth-message info';
            passwordMessage.style.display = 'block';
            
            try {
                // Get user email from stored user data
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                const email = userData.email;
                
                if (!email) {
                    throw new Error('User email not found. Please log in again.');
                }
                
                // Request password reset code
                const resetResponse = await fetch(`${API_URL}/request-password-reset`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email
                    })
                });
                
                if (!resetResponse.ok) {
                    const errorData = await resetResponse.json();
                    throw new Error(errorData.detail || 'Failed to request password reset');
                }
                
                passwordMessage.textContent = 'A password reset code has been sent to your email. Please check your inbox and follow the instructions to complete the password change.';
                passwordMessage.className = 'auth-message success';
                
                // Close modal after a delay
                setTimeout(() => {
                    changePasswordModal.classList.remove('active');
                    changePasswordModal.style.display = 'none';
                }, 5000);
                
            } catch (error) {
                console.error('Password change error:', error);
                passwordMessage.textContent = error.message || 'An error occurred. Please try again.';
                passwordMessage.className = 'auth-message error';
                passwordMessage.style.display = 'block';
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
                
                // Get user email from stored user data
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                const email = userData.email;
                
                if (!email) {
                    throw new Error('User email not found. Please log in again.');
                }
                
                const response = await fetch(`${API_URL}/resend-verification`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email
                    })
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
                resendVerificationBtn.innerHTML = '<i class="fas fa-envelope"></i> Resend Verification Email';
                resendVerificationBtn.disabled = false;
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
        notification.style.display = 'block';
        
        // Show notification
        notification.classList.add('active');
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('active');
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 3000);
    };
    
    // Initialize page
    const initProfilePage = async () => {
        try {
            await loadUserData();
        } catch (error) {
            console.error('Error initializing profile page:', error);
            showNotification('Failed to load profile data. Please refresh the page.', 'error');
        }
    };
    
    initProfilePage();
});