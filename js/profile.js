document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://api.versz.fun';
    
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
            sidebar.classList.toggle('show');
        });
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.remove('show');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && 
            !e.target.closest('.sidebar') && 
            !e.target.closest('#mobile-menu-toggle') &&
            sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    });
    
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
            const avatarImg = document.getElementById('sidebar-avatar');
            avatarImg.src = userData.avatar_url;
            avatarImg.onload = function() {
                avatarImg.classList.add('loaded');
                const avatarLoading = document.querySelector('.sidebar-user .avatar-loading');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            };
            avatarImg.onerror = function() {
                avatarImg.src = 'img/default-avatar.png';
                avatarImg.classList.add('loaded');
                const avatarLoading = document.querySelector('.sidebar-user .avatar-loading');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            };
        } else {
            const avatarImg = document.getElementById('sidebar-avatar');
            avatarImg.src = 'img/default-avatar.png';
            avatarImg.classList.add('loaded');
            const avatarLoading = document.querySelector('.sidebar-user .avatar-loading');
            if (avatarLoading) {
                avatarLoading.style.display = 'none';
            }
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
        
        // Calculate age if date of birth is available
        if (userData.date_of_birth) {
            const dob = new Date(userData.date_of_birth);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                age--;
            }
            
            document.getElementById('profile-age').textContent = age;
        } else {
            document.getElementById('profile-age').textContent = 'Not specified';
        }
        
        document.getElementById('profile-gender').textContent = userData.gender || 'Not specified';
        document.getElementById('profile-pronouns').textContent = userData.pronouns || 'Not specified';
        
        // Avatar
        if (userData.avatar_url) {
            const profileAvatar = document.getElementById('profile-avatar');
            profileAvatar.src = userData.avatar_url;
            profileAvatar.onload = function() {
                profileAvatar.classList.add('loaded');
                const avatarLoading = document.querySelector('.profile-avatar .avatar-loading');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            };
            profileAvatar.onerror = function() {
                profileAvatar.src = 'img/default-avatar.png';
                profileAvatar.classList.add('loaded');
                const avatarLoading = document.querySelector('.profile-avatar .avatar-loading');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            };
        } else {
            const profileAvatar = document.getElementById('profile-avatar');
            profileAvatar.src = 'img/default-avatar.png';
            profileAvatar.classList.add('loaded');
            const avatarLoading = document.querySelector('.profile-avatar .avatar-loading');
            if (avatarLoading) {
                avatarLoading.style.display = 'none';
            }
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
        document.getElementById('stat-views').textContent = totalViews.toLocaleString();
        
        document.getElementById('stat-templates').textContent = userData.templates_used || 0;
        
        // Set account status with appropriate styling
        const accountStatus = document.getElementById('stat-status');
        if (userData.is_verified) {
            accountStatus.textContent = 'Verified';
            accountStatus.classList.add('verified');
        } else {
            accountStatus.textContent = 'Pending Verification';
            accountStatus.classList.add('pending');
        }
        
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
        
        // Add Discord data
        loadDiscordData(userData);
        
        // Add show_discord preference to preferences section
        const preferencesGrid = document.querySelector('.preferences-grid');
        if (preferencesGrid) {
            // Check if Discord preference already exists
            const existingDiscordPref = document.getElementById('pref-show-discord');
            if (!existingDiscordPref) {
                // Create new preference item
                const discordPrefItem = document.createElement('div');
                discordPrefItem.className = 'preference-item';
                discordPrefItem.innerHTML = `
                    <div class="preference-label">Show Discord</div>
                    <div class="preference-value" id="pref-show-discord">${displayPrefs.show_discord !== false ? 'Yes' : 'No'}</div>
                    <div class="preference-edit" style="display: none;">
                        <label class="switch">
                            <input type="checkbox" id="edit-show-discord-pref" ${displayPrefs.show_discord !== false ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                `;
                preferencesGrid.appendChild(discordPrefItem);
            } else {
                // Update existing preference
                existingDiscordPref.textContent = displayPrefs.show_discord !== false ? 'Yes' : 'No';
                const discordPrefToggle = document.getElementById('edit-show-discord-pref');
                if (discordPrefToggle) {
                    discordPrefToggle.checked = displayPrefs.show_discord !== false;
                }
            }
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
            fieldEdits.forEach(field => {
                field.style.display = 'block';
                field.classList.add('fadeIn');
            });
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
            
            // Clear any status messages
            avatarUploadStatus.textContent = '';
            avatarUploadStatus.className = 'upload-status';
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
                const avatarUrl = document.getElementById('avatar-url').value;
                
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
                    const checkResponse = await fetch(`${API_URL}/check-url?url=${username}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!checkResponse.ok) {
                        throw new Error('Failed to check username availability');
                    }
                    
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
                        bio: bio || null,
                        avatar_url: avatarUrl || null
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update profile');
                }
                
                // Show success message
                showNotification('Profile updated successfully', 'success');
                
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
                updateAvatarBtn.innerHTML = 'Update Avatar';
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
            fieldEdits.forEach(field => {
                field.style.display = 'block';
                field.classList.add('fadeIn');
            });
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
            
            // If custom pronouns were selected, reset them
            if (userData.pronouns && !['he/him', 'she/her', 'they/them', ''].includes(userData.pronouns)) {
                document.getElementById('edit-pronouns').value = 'custom';
                document.getElementById('custom-pronouns').value = userData.pronouns;
                document.getElementById('custom-pronouns').style.display = 'block';
            }
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
            preferenceEdits.forEach(field => {
                field.style.display = 'block';
                field.classList.add('fadeIn');
            });
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
                const showDiscord = document.getElementById('edit-show-discord-pref')?.checked !== false;
                
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
                        show_discord: showDiscord,
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
            
            // Reset form
            document.getElementById('change-password-form').reset();
            document.getElementById('password-message').textContent = '';
            document.getElementById('password-message').className = 'auth-message';
            document.getElementById('password-message').style.display = 'none';
            
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
            }
        });
        
        const modalClose = changePasswordModal.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                changePasswordModal.classList.remove('active');
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
            
            // Show loading state
            const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing Password...';
            submitBtn.disabled = true;
            
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
                
                // Change password
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
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to change password');
                }
                
                // Show success
                passwordMessage.textContent = 'Password changed successfully! You may need to log in again.';
                passwordMessage.className = 'auth-message success';
                passwordMessage.style.display = 'block';
                
                showNotification('Password changed successfully', 'success');
                
                // Close modal after a delay
                setTimeout(() => {
                    changePasswordModal.classList.remove('active');
                }, 3000);
                
            } catch (error) {
                console.error('Password change error:', error);
                passwordMessage.textContent = error.message || 'An error occurred. Please try again.';
                passwordMessage.className = 'auth-message error';
                passwordMessage.style.display = 'block';
                
                showNotification(error.message || 'Failed to change password', 'error');
            } finally {
                submitBtn.innerHTML = 'Change Password';
                submitBtn.disabled = false;
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
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
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

    // Discord Integration Functions

    function loadDiscordData(userData) {
        console.log('Loading Discord data:', userData.discord);
        
        const discordNotConnected = document.getElementById('discord-not-connected');
        const discordConnected = document.getElementById('discord-connected');
        const connectDiscordBtn = document.getElementById('connect-discord-btn');
        const disconnectDiscordBtn = document.getElementById('disconnect-discord-btn');
        
        // Check if elements exist before proceeding
        if (!discordNotConnected || !discordConnected || !connectDiscordBtn) {
            console.error('Error loading Discord data: Required DOM elements not found');
            return;
        }
        
        if (!userData.discord) {
            // Not connected
            discordNotConnected.style.display = 'flex';
            discordConnected.style.display = 'none';
            connectDiscordBtn.style.display = 'inline-flex';
            if (disconnectDiscordBtn) {
                disconnectDiscordBtn.style.display = 'none';
            }
            const editDiscordBtn = document.getElementById('edit-discord-btn');
            if (editDiscordBtn) {
                editDiscordBtn.style.display = 'none';
            }
            return;
        }
        
        // Connected - update UI
        discordNotConnected.style.display = 'none';
        discordConnected.style.display = 'block';
        connectDiscordBtn.style.display = 'none';
        if (disconnectDiscordBtn) {
            disconnectDiscordBtn.style.display = 'inline-flex';
        }
        
        const editDiscordBtn = document.getElementById('edit-discord-btn');
        if (editDiscordBtn) {
            editDiscordBtn.style.display = 'inline-flex';
        }
        
        const discord = userData.discord;
        
        // Set avatar
        const discordAvatar = document.getElementById('discord-avatar');
        if (discordAvatar) {
            if (discord.avatar) {
                discordAvatar.src = `https://cdn.discordapp.com/avatars/${discord.discord_id}/${discord.avatar}.png`;
            } else {
                // Default avatar based on discriminator
                const discriminator = parseInt(discord.discriminator || '0') % 5;
                discordAvatar.src = `https://cdn.discordapp.com/embed/avatars/${discriminator}.png`;
            }
        }
        
        // Set username and tag
        const discordUsername = document.getElementById('discord-username');
        const discordTag = document.getElementById('discord-tag');
        
        if (discordUsername) {
            discordUsername.textContent = discord.username || 'Unknown';
        }
        
        if (discordTag) {
            discordTag.textContent = discord.discriminator ? `#${discord.discriminator}` : '';
        }
        
        // Set status
        const statusIndicator = document.getElementById('discord-status');
        const statusText = document.getElementById('discord-status-text');
        
        if (statusIndicator && statusText) {
            if (discord.status) {
                statusIndicator.className = `discord-status-indicator ${discord.status}`;
                
                // Format status text
                let formattedStatus = 'Offline';
                if (discord.status === 'online') formattedStatus = 'Online';
                else if (discord.status === 'idle') formattedStatus = 'Idle';
                else if (discord.status === 'dnd') formattedStatus = 'Do Not Disturb';
                
                statusText.textContent = formattedStatus;
            } else {
                statusIndicator.className = 'discord-status-indicator';
                statusText.textContent = 'Offline';
            }
        }
        
        // Set activity
        const discordActivity = document.getElementById('discord-activity');
        if (discordActivity) {
            discordActivity.textContent = discord.activity || 'None';
        }
        
        // Set connected date
        const discordConnectedAt = document.getElementById('discord-connected-at');
        if (discordConnectedAt) {
            if (discord.connected_at) {
                const connectedDate = new Date(discord.connected_at);
                discordConnectedAt.textContent = connectedDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } else {
                discordConnectedAt.textContent = 'Unknown';
            }
        }
        
        // Set show on profile preference
        const discordShowOnProfile = document.getElementById('discord-show-on-profile');
        const editShowDiscord = document.getElementById('edit-show-discord');
        
        if (discordShowOnProfile) {
            const showDiscord = userData.display_preferences?.show_discord !== false;
            discordShowOnProfile.textContent = showDiscord ? 'Yes' : 'No';
        }
        
        if (editShowDiscord) {
            const showDiscord = userData.display_preferences?.show_discord !== false;
            editShowDiscord.checked = showDiscord;
        }
    }

    // Initialize Discord integration
    function initDiscordIntegration() {
        // Check if we're returning from Discord OAuth
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('discord') === 'connected') {
            showNotification('Discord account connected successfully!', 'success');
            // Remove the query parameter
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Connect Discord button
        const connectDiscordBtn = document.getElementById('connect-discord-btn');
        if (connectDiscordBtn) {
            connectDiscordBtn.addEventListener('click', async () => {
                try {
                    // Show loading state
                    connectDiscordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                    connectDiscordBtn.disabled = true;
                    
                    // Get Discord auth URL
                    const response = await fetch(`${API_URL}/discord/auth-url`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to get Discord authorization URL');
                    }
                    
                    const data = await response.json();
                    console.log('Discord auth URL:', data);
                    
                    if (!data.auth_url) {
                        throw new Error('Invalid authorization URL received');
                    }
                    
                    // Redirect to Discord OAuth
                    window.location.href = data.auth_url;
                    
                } catch (error) {
                    console.error('Error connecting Discord:', error);
                    showNotification(error.message || 'Failed to connect Discord account', 'error');
                    
                    // Reset button
                    connectDiscordBtn.innerHTML = '<i class="fab fa-discord"></i> Connect Discord';
                    connectDiscordBtn.disabled = false;
                }
            });
        }
        
        // Disconnect Discord button
        const disconnectDiscordBtn = document.getElementById('disconnect-discord-btn');
        if (disconnectDiscordBtn) {
            disconnectDiscordBtn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to disconnect your Discord account?')) {
                    return;
                }
                
                try {
                    // Show loading state
                    disconnectDiscordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Disconnecting...';
                    disconnectDiscordBtn.disabled = true;
                    
                    // Disconnect Discord
                    const response = await fetch(`${API_URL}/discord/disconnect`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to disconnect Discord account');
                    }
                    
                    // Show success message
                    showNotification('Discord account disconnected successfully', 'success');
                    
                    // Reload user data
                    await loadUserData();
                    
                } catch (error) {
                    console.error('Error disconnecting Discord:', error);
                    showNotification(error.message || 'Failed to disconnect Discord account', 'error');
                    
                    // Reset button
                    disconnectDiscordBtn.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
                    disconnectDiscordBtn.disabled = false;
                }
            });
        }
        
        // Reconnect Discord button
        const reconnectDiscordBtn = document.getElementById('reconnect-discord-btn');
        if (reconnectDiscordBtn) {
            reconnectDiscordBtn.addEventListener('click', async () => {
                try {
                    // Show loading state
                    reconnectDiscordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reconnecting...';
                    reconnectDiscordBtn.disabled = true;
                    
                    // Get Discord auth URL
                    const response = await fetch(`${API_URL}/discord/auth-url`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to get Discord authorization URL');
                    }
                    
                    const data = await response.json();
                    
                    // Redirect to Discord OAuth
                    window.location.href = data.auth_url;
                    
                } catch (error) {
                    console.error('Error reconnecting Discord:', error);
                    showNotification(error.message || 'Failed to reconnect Discord account', 'error');
                    
                    // Reset button
                    reconnectDiscordBtn.innerHTML = '<i class="fab fa-discord"></i> Reconnect Discord';
                    reconnectDiscordBtn.disabled = false;
                }
            });
        }
        
        // Edit Discord preferences
        const editDiscordBtn = document.getElementById('edit-discord-btn');
        if (editDiscordBtn) {
            editDiscordBtn.addEventListener('click', () => {
                // Show edit fields, hide display values
                const discordSection = editDiscordBtn.closest('.profile-section');
                const fieldValues = discordSection.querySelectorAll('.field-value');
                const fieldEdits = discordSection.querySelectorAll('.field-edit');
                
                fieldValues.forEach(field => field.style.display = 'none');
                fieldEdits.forEach(field => {
                    field.style.display = 'block';
                    field.classList.add('fadeIn');
                });
                
                document.getElementById('discord-edit-actions').style.display = 'flex';
                
                // Hide edit button
                editDiscordBtn.style.display = 'none';
            });
        }
        
        // Cancel Discord edit
        const cancelDiscordBtn = document.getElementById('cancel-discord-btn');
        if (cancelDiscordBtn) {
            cancelDiscordBtn.addEventListener('click', () => {
                // Hide edit fields, show display values
                const discordSection = cancelDiscordBtn.closest('.profile-section');
                const fieldValues = discordSection.querySelectorAll('.field-value');
                const fieldEdits = discordSection.querySelectorAll('.field-edit');
                
                fieldValues.forEach(field => field.style.display = 'block');
                fieldEdits.forEach(field => field.style.display = 'none');
                
                document.getElementById('discord-edit-actions').style.display = 'none';
                
                // Show edit button
                if (editDiscordBtn) {
                    editDiscordBtn.style.display = 'inline-flex';
                }
                
                // Reset form values
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                const displayPrefs = userData.display_preferences || {};
                
                document.getElementById('edit-show-discord').checked = displayPrefs.show_discord !== false;
            });
        }
        
        // Save Discord preferences
        const saveDiscordBtn = document.getElementById('save-discord-btn');
        if (saveDiscordBtn) {
            saveDiscordBtn.addEventListener('click', async () => {
                try {
                    // Show loading state
                    saveDiscordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                    saveDiscordBtn.disabled = true;
                    
                    // Get current preferences
                    const userData = JSON.parse(localStorage.getItem('user') || '{}');
                    const displayPrefs = userData.display_preferences || {};
                    
                    // Update with new value
                    displayPrefs.show_discord = document.getElementById('edit-show-discord').checked;
                    
                    // Submit update
                    const response = await fetch(`${API_URL}/preferences`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(displayPrefs)
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to update preferences');
                    }
                    
                    // Show success message
                    showNotification('Discord preferences updated successfully', 'success');
                    
                    // Reload user data
                    await loadUserData();
                    
                    // Hide edit fields, show display values
                    const discordSection = saveDiscordBtn.closest('.profile-section');
                    const fieldValues = discordSection.querySelectorAll('.field-value');
                    const fieldEdits = discordSection.querySelectorAll('.field-edit');
                    
                    fieldValues.forEach(field => field.style.display = 'block');
                    fieldEdits.forEach(field => field.style.display = 'none');
                    
                    document.getElementById('discord-edit-actions').style.display = 'none';
                    
                    // Show edit button
                    if (editDiscordBtn) {
                        editDiscordBtn.style.display = 'inline-flex';
                    }
                    
                } catch (error) {
                    console.error('Error updating Discord preferences:', error);
                    showNotification(error.message || 'Failed to update Discord preferences', 'error');
                } finally {
                    saveDiscordBtn.innerHTML = 'Save Changes';
                    saveDiscordBtn.disabled = false;
                }
            });
        }
    }


    // Danger Zone functionality
    // Clear Data Modal
    const clearDataBtn = document.getElementById('clear-data-btn');
    const clearDataModal = document.getElementById('clear-data-modal');
    const clearDataForm = document.getElementById('clear-data-form');
    const clearDataCancel = document.getElementById('clear-data-cancel');
    const clearDataMessage = document.getElementById('clear-data-message');

    if (clearDataBtn && clearDataModal) {
        clearDataBtn.addEventListener('click', () => {
            clearDataModal.classList.add('active');
            if (clearDataMessage) {
                clearDataMessage.textContent = '';
                clearDataMessage.className = 'auth-message';
                clearDataMessage.style.display = 'none';
            }
            if (clearDataForm) {
                clearDataForm.reset();
            }
        });
        
        // Close modal when clicking outside
        clearDataModal.addEventListener('click', (e) => {
            if (e.target === clearDataModal) {
                clearDataModal.classList.remove('active');
            }
        });
        
        const modalClose = clearDataModal.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                clearDataModal.classList.remove('active');
            });
        }
        
        if (clearDataCancel) {
            clearDataCancel.addEventListener('click', () => {
                clearDataModal.classList.remove('active');
            });
        }
    }

    // Delete Account Modal
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteAccountModal = document.getElementById('delete-account-modal');
    const deleteAccountForm = document.getElementById('delete-account-form');
    const deleteAccountCancel = document.getElementById('delete-account-cancel');
    const deleteAccountMessage = document.getElementById('delete-account-message');

    if (deleteAccountBtn && deleteAccountModal) {
        deleteAccountBtn.addEventListener('click', () => {
            deleteAccountModal.classList.add('active');
            if (deleteAccountMessage) {
                deleteAccountMessage.textContent = '';
                deleteAccountMessage.className = 'auth-message';
                deleteAccountMessage.style.display = 'none';
            }
            if (deleteAccountForm) {
                deleteAccountForm.reset();
            }
        });
        
        // Close modal when clicking outside
        deleteAccountModal.addEventListener('click', (e) => {
            if (e.target === deleteAccountModal) {
                deleteAccountModal.classList.remove('active');
            }
        });
        
        const modalClose = deleteAccountModal.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                deleteAccountModal.classList.remove('active');
            });
        }
        
        if (deleteAccountCancel) {
            deleteAccountCancel.addEventListener('click', () => {
                deleteAccountModal.classList.remove('active');
            });
        }
    }

    // Handle Clear Data form submission
    if (clearDataForm) {
        clearDataForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const clearProfile = document.getElementById('clear-profile').checked;
            const clearAnalytics = document.getElementById('clear-analytics').checked;
            const clearTemplates = document.getElementById('clear-templates').checked;
            const clearPages = document.getElementById('clear-pages').checked;
            const password = document.getElementById('clear-data-password').value;
            
            // Validate at least one option is selected
            if (!clearProfile && !clearAnalytics && !clearTemplates && !clearPages) {
                clearDataMessage.textContent = 'Please select at least one data type to clear.';
                clearDataMessage.className = 'auth-message error';
                clearDataMessage.style.display = 'block';
                return;
            }
            
            // Validate password is provided
            if (!password) {
                clearDataMessage.textContent = 'Please enter your password to confirm.';
                clearDataMessage.className = 'auth-message error';
                clearDataMessage.style.display = 'block';
                return;
            }
            
            // Show loading state
            const submitBtn = clearDataForm.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.disabled = true;
            
            clearDataMessage.textContent = 'Processing your request...';
            clearDataMessage.className = 'auth-message info';
            clearDataMessage.style.display = 'block';
            
            try {
                const token = localStorage.getItem('token');
                
                // Send request to clear data
                const response = await fetch(`${API_URL}/clear-my-data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        password: password,
                        clear_profile: clearProfile,
                        clear_analytics: clearAnalytics,
                        clear_templates: clearTemplates,
                        clear_pages: clearPages
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || 'Failed to clear data');
                }
                
                // Show success message
                clearDataMessage.textContent = 'Selected data has been cleared successfully. The page will reload in a moment.';
                clearDataMessage.className = 'auth-message success';
                clearDataMessage.style.display = 'block';
                
                // Show notification
                showNotification('Data cleared successfully', 'success');
                
                // Reload the page after a delay
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
                
            } catch (error) {
                console.error('Error clearing data:', error);
                
                clearDataMessage.textContent = error.message || 'An error occurred. Please try again.';
                clearDataMessage.className = 'auth-message error';
                clearDataMessage.style.display = 'block';
                
                showNotification(error.message || 'Failed to clear data', 'error');
                
                // Reset button
                submitBtn.innerHTML = 'Clear Selected Data';
                submitBtn.disabled = false;
            }
        });
    }

    // Handle Delete Account form submission
    if (deleteAccountForm) {
        deleteAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('delete-account-password').value;
            const confirmCheckbox = document.getElementById('delete-confirm').checked;
            
            // Validate confirmation checkbox
            if (!confirmCheckbox) {
                deleteAccountMessage.textContent = 'Please confirm that you understand this action is permanent.';
                deleteAccountMessage.className = 'auth-message error';
                deleteAccountMessage.style.display = 'block';
                return;
            }
            
            // Validate password is provided
            if (!password) {
                deleteAccountMessage.textContent = 'Please enter your password to confirm.';
                deleteAccountMessage.className = 'auth-message error';
                deleteAccountMessage.style.display = 'block';
                return;
            }
            
            // Show loading state
            const submitBtn = deleteAccountForm.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            submitBtn.disabled = true;
            
            deleteAccountMessage.textContent = 'Processing your request...';
            deleteAccountMessage.className = 'auth-message info';
            deleteAccountMessage.style.display = 'block';
            
            try {
                const token = localStorage.getItem('token');
                
                // Send request to delete account
                const response = await fetch(`${API_URL}/account`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        password: password
                    })
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || 'Failed to delete account');
                }
                
                // Show success message
                deleteAccountMessage.textContent = 'Your account has been successfully deleted. You will be redirected to the login page.';
                deleteAccountMessage.className = 'auth-message success';
                deleteAccountMessage.style.display = 'block';
                
                // Show notification
                showNotification('Account deleted successfully', 'success');
                
                // Clear local storage and redirect to login page after a delay
                setTimeout(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                }, 3000);
                
            } catch (error) {
                console.error('Error deleting account:', error);
                
                deleteAccountMessage.textContent = error.message || 'An error occurred. Please try again.';
                deleteAccountMessage.className = 'auth-message error';
                deleteAccountMessage.style.display = 'block';
                
                showNotification(error.message || 'Failed to delete account', 'error');
                
                // Reset button
                submitBtn.innerHTML = 'Delete My Account';
                submitBtn.disabled = false;
            }
        });
    }

    
    
    // Improved notification system
    const showNotification = (message, type = 'info') => {
        const notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            const container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Set icon based on notification type
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-exclamation-circle';
        else if (type === 'warning') iconClass = 'fa-exclamation-triangle';
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
            <div class="notification-progress"></div>
        `;
        
        // Add to container
        document.querySelector('.notification-container').appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Set up close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    };
    
    // Initialize page
    const initProfilePage = async () => {
        try {
            await loadUserData();
            initDiscordIntegration();
        } catch (error) {
            console.error('Error initializing profile page:', error);
            showNotification('Failed to load profile data. Please refresh the page.', 'error');
        }
    };
    
    initProfilePage();
});

