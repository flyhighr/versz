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
    
    // Discord integration
    let discordStatus = null;

    const loadDiscordStatus = async () => {
        try {
            const response = await fetch(`${API_URL}/discord/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Not connected yet
                    renderDiscordConnection(null);
                    return null;
                }
                throw new Error('Failed to fetch Discord status');
            }
            
            const data = await response.json();
            renderDiscordConnection(data);
            return data;
        } catch (error) {
            console.error('Error loading Discord status:', error);
            renderDiscordConnection(null);
            return null;
        }
    };

    const connectDiscord = async () => {
        try {
            const connectBtn = document.querySelector('.discord-connect-btn');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                connectBtn.disabled = true;
            }
            
            const response = await fetch(`${API_URL}/discord/connect`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate Discord authorization URL');
            }
            
            const data = await response.json();
            
            // Open Discord OAuth in a popup
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            const popup = window.open(
                data.auth_url,
                'discord-oauth',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Create a message listener for the popup callback
            const messageListener = async (event) => {
                // Check if the message is from our popup with the code and state
                if (event.data && event.data.code && event.data.state) {
                    // Exchange the code for a token
                    try {
                        const exchangeResponse = await fetch(`${API_URL}/discord/exchange-code`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                code: event.data.code,
                                state: event.data.state
                            })
                        });
                        
                        if (!exchangeResponse.ok) {
                            throw new Error('Failed to exchange code for token');
                        }
                        
                        const exchangeData = await exchangeResponse.json();
                        
                        if (exchangeData.success) {
                            // Reload Discord status
                            await loadDiscordStatus();
                            showNotification('Discord account connected successfully!', 'success');
                        } else {
                            throw new Error('Failed to connect Discord account');
                        }
                    } catch (error) {
                        console.error('Error exchanging code:', error);
                        showNotification('Failed to connect Discord account', 'error');
                        if (connectBtn) {
                            connectBtn.innerHTML = '<i class="fab fa-discord"></i> Connect Discord';
                            connectBtn.disabled = false;
                        }
                    }
                    
                    // Remove the event listener
                    window.removeEventListener('message', messageListener);
                }
            };
            
            // Add the message listener
            window.addEventListener('message', messageListener);
            
            // Check if popup was closed without completing
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageListener);
                    
                    if (connectBtn) {
                        connectBtn.innerHTML = '<i class="fab fa-discord"></i> Connect Discord';
                        connectBtn.disabled = false;
                    }
                }
            }, 500);
            
        } catch (error) {
            console.error('Error connecting to Discord:', error);
            showNotification('Failed to connect to Discord', 'error');
            
            const connectBtn = document.querySelector('.discord-connect-btn');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fab fa-discord"></i> Connect Discord';
                connectBtn.disabled = false;
            }
        }
    };

    const disconnectDiscord = async () => {
        if (!confirm('Are you sure you want to disconnect your Discord account?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/discord/disconnect`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to disconnect Discord account');
            }
            
            // Reload Discord status
            await loadDiscordStatus();
            showNotification('Discord account disconnected successfully', 'success');
        } catch (error) {
            console.error('Error disconnecting Discord:', error);
            showNotification('Failed to disconnect Discord account', 'error');
        }
    };

    const refreshDiscordConnection = async () => {
        try {
            const refreshBtn = document.querySelector('.discord-refresh');
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                refreshBtn.disabled = true;
            }
            
            const response = await fetch(`${API_URL}/discord/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh Discord connection');
            }
            
            const data = await response.json();
            
            if (data.needs_verification) {
                // Need to re-authorize with Discord
                renderDiscordVerificationNeeded(data.auth_url || null);
            } else {
                // Reload Discord status
                await loadDiscordStatus();
                showNotification('Discord connection refreshed successfully', 'success');
            }
        } catch (error) {
            console.error('Error refreshing Discord:', error);
            showNotification('Failed to refresh Discord connection', 'error');
            
            const refreshBtn = document.querySelector('.discord-refresh');
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                refreshBtn.disabled = false;
            }
        }
    };

    const toggleDiscordSettings = () => {
        const preferencesContainer = document.querySelector('.discord-preferences');
        if (preferencesContainer) {
            const isVisible = preferencesContainer.style.display !== 'none';
            preferencesContainer.style.display = isVisible ? 'none' : 'block';
            
            const settingsBtn = document.querySelector('.discord-settings');
            if (settingsBtn) {
                settingsBtn.innerHTML = isVisible ? 
                    '<i class="fas fa-cog"></i> Settings' : 
                    '<i class="fas fa-times"></i> Close Settings';
            }
        }
    };

    const saveDiscordPreferences = async () => {
        try {
            const showDiscord = document.getElementById('show-discord').checked;
            const showActivity = document.getElementById('show-activity').checked;
            
            const saveBtn = document.getElementById('save-discord-prefs');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                saveBtn.disabled = true;
            }
            
            const response = await fetch(`${API_URL}/discord/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    show_discord: showDiscord,
                    show_activity: showActivity
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update Discord preferences');
            }
            
            // Reload Discord status
            await loadDiscordStatus();
            showNotification('Discord preferences updated successfully', 'success');
            
            // Close preferences panel
            toggleDiscordSettings();
        } catch (error) {
            console.error('Error updating Discord preferences:', error);
            showNotification('Failed to update Discord preferences', 'error');
            
            const saveBtn = document.getElementById('save-discord-prefs');
            if (saveBtn) {
                saveBtn.innerHTML = 'Save Preferences';
                saveBtn.disabled = false;
            }
        }
    };

    const verifyDiscord = async (authUrl) => {
        try {
            const verifyBtn = document.querySelector('.discord-verification-btn');
            if (verifyBtn) {
                verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
                verifyBtn.disabled = true;
            }
            
            // Open Discord OAuth in a popup
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            const popup = window.open(
                authUrl,
                'discord-oauth',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Create a message listener for the popup callback
            const messageListener = async (event) => {
                // Check if the message is from our popup with the code and state
                if (event.data && event.data.code && event.data.state) {
                    // Exchange the code for a token
                    try {
                        const exchangeResponse = await fetch(`${API_URL}/discord/exchange-code`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                code: event.data.code,
                                state: event.data.state
                            })
                        });
                        
                        if (!exchangeResponse.ok) {
                            throw new Error('Failed to exchange code for token');
                        }
                        
                        const exchangeData = await exchangeResponse.json();
                        
                        if (exchangeData.success) {
                            // Reload Discord status
                            await loadDiscordStatus();
                            showNotification('Discord account verified successfully!', 'success');
                        } else {
                            throw new Error('Failed to verify Discord account');
                        }
                    } catch (error) {
                        console.error('Error exchanging code:', error);
                        showNotification('Failed to verify Discord account', 'error');
                        
                        const verifyBtn = document.querySelector('.discord-verification-btn');
                        if (verifyBtn) {
                            verifyBtn.innerHTML = '<i class="fab fa-discord"></i> Verify with Discord';
                            verifyBtn.disabled = false;
                        }
                    }
                    
                    // Remove the event listener
                    window.removeEventListener('message', messageListener);
                }
            };
            
            // Add the message listener
            window.addEventListener('message', messageListener);
            
            // Check if popup was closed without completing
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageListener);
                    
                    const verifyBtn = document.querySelector('.discord-verification-btn');
                    if (verifyBtn) {
                        verifyBtn.innerHTML = '<i class="fab fa-discord"></i> Verify with Discord';
                        verifyBtn.disabled = false;
                    }
                }
            }, 500);
            
        } catch (error) {
            console.error('Error verifying Discord:', error);
            showNotification('Failed to verify Discord account', 'error');
            
            const verifyBtn = document.querySelector('.discord-verification-btn');
            if (verifyBtn) {
                verifyBtn.innerHTML = '<i class="fab fa-discord"></i> Verify with Discord';
                verifyBtn.disabled = false;
            }
        }
    };

    const renderDiscordConnection = (data) => {
        const container = document.getElementById('discord-connection');
        if (!container) return;
        
        // Save status globally
        discordStatus = data;
        
        if (!data || !data.connected) {
            // Not connected
            container.innerHTML = `
                <div class="discord-not-connected">
                    <p>Connect your Discord account to display your status and activity on your profile.</p>
                    <button class="discord-connect-btn" onclick="connectDiscord()">
                        <i class="fab fa-discord"></i> Connect Discord
                    </button>
                </div>
            `;
            
            // Hide edit button
            const editBtn = document.getElementById('edit-discord-btn');
            if (editBtn) {
                editBtn.style.display = 'none';
            }
            
            return;
        }
        
        // Show edit button
        const editBtn = document.getElementById('edit-discord-btn');
        if (editBtn) {
            editBtn.style.display = 'inline-flex';
        }
        
        // Format status
        const statusColor = getStatusColor(data.current_status);
        const statusText = getStatusText(data.current_status);
        
        // Format activity
        let activityHtml = '';
        if (data.current_activity && data.show_activity) {
            const activity = data.current_activity;
            const activityType = getActivityType(activity.type);
            
            activityHtml = `
                <div class="discord-activity">
                    <div class="activity-header">ACTIVITY</div>
                    <div class="activity-details">
                        <span class="activity-type">${activityType}</span>
                        <span class="activity-name">${activity.name}</span>
                    </div>
                    ${activity.details ? `<div class="activity-details">${activity.details}</div>` : ''}
                    ${activity.state ? `<div class="activity-details">${activity.state}</div>` : ''}
                </div>
            `;
        }
        
        // Render connected state
        container.innerHTML = `
            <div class="discord-card">
                <div class="discord-profile">
                    <div class="discord-avatar">
                        ${data.avatar_url ? `<img src="${data.avatar_url}" alt="Discord Avatar">` : '<div class="no-avatar"></div>'}
                    </div>
                    <div class="discord-info">
                        <div class="discord-username">
                            ${data.username} <span class="discord-tag">#${data.discriminator}</span>
                        </div>
                        <div class="discord-status">
                            <span class="status-indicator" style="background-color: ${statusColor};"></span>
                            ${statusText}
                        </div>
                        <div class="discord-actions">
                            <button class="discord-refresh" onclick="refreshDiscordConnection()">
                                <i class="fas fa-sync-alt"></i> Refresh
                            </button>
                            <button class="discord-settings" onclick="toggleDiscordSettings()">
                                <i class="fas fa-cog"></i> Settings
                            </button>
                            <button class="discord-disconnect" onclick="disconnectDiscord()">
                                <i class="fas fa-unlink"></i> Disconnect
                            </button>
                        </div>
                    </div>
                </div>
                ${activityHtml}
                <div class="discord-preferences" style="display: none;">
                    <h4>Privacy Settings</h4>
                    <div class="preference-toggles">
                        <div class="preference-toggle">
                            <span class="preference-toggle-label">Show Discord on Profile</span>
                            <label class="switch">
                                <input type="checkbox" id="show-discord" ${data.show_discord ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div class="preference-toggle">
                            <span class="preference-toggle-label">Show Activity Status</span>
                            <label class="switch">
                                <input type="checkbox" id="show-activity" ${data.show_activity ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; text-align: right;">
                        <button id="save-discord-prefs" class="btn btn-primary btn-sm" onclick="saveDiscordPreferences()">
                            Save Preferences
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // If connection needs verification, show that instead
        if (data.needs_verification) {
            renderDiscordVerificationNeeded(data.auth_url || null);
        }
    };

    const renderDiscordVerificationNeeded = (authUrl) => {
        const container = document.getElementById('discord-connection');
        if (!container) return;
        
        // If no authUrl is provided, we need to refresh the connection first
        const refreshButton = authUrl ? 
            `<button class="discord-verification-btn" onclick="verifyDiscord('${authUrl}')">
                <i class="fab fa-discord"></i> Verify with Discord
            </button>` :
            `<button class="discord-refresh-btn" onclick="refreshDiscordConnection()">
                <i class="fas fa-sync-alt"></i> Refresh Connection
            </button>`;
        
        container.innerHTML = `
            <div class="discord-verification-needed">
                <p>Your Discord connection needs to be verified again. This happens when permissions change or the connection expires.</p>
                ${refreshButton}
            </div>
        `;
        
        // Hide edit button
        const editBtn = document.getElementById('edit-discord-btn');
        if (editBtn) {
            editBtn.style.display = 'none';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#43b581';
            case 'idle': return '#faa61a';
            case 'dnd': return '#f04747';
            case 'streaming': return '#593695';
            default: return '#747f8d'; // offline or unknown
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'online': return 'Online';
            case 'idle': return 'Idle';
            case 'dnd': return 'Do Not Disturb';
            case 'streaming': return 'Streaming';
            default: return 'Offline';
        }
    };

    const getActivityType = (type) => {
        // Discord activity types
        switch (type) {
            case 0: return 'Playing';
            case 1: return 'Streaming';
            case 2: return 'Listening to';
            case 3: return 'Watching';
            case 4: return 'Custom:';
            case 5: return 'Competing in';
            default: return '';
        }
    };

    // Edit Discord preferences button
    const editDiscordBtn = document.getElementById('edit-discord-btn');
    if (editDiscordBtn) {
        editDiscordBtn.addEventListener('click', () => {
            toggleDiscordSettings();
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
            await loadDiscordStatus(); // Add this line
        } catch (error) {
            console.error('Error initializing profile page:', error);
            showNotification('Failed to load profile data. Please refresh the page.', 'error');
        }
    };
    
    initProfilePage();

    // Make functions globally available
    window.connectDiscord = connectDiscord;
    window.disconnectDiscord = disconnectDiscord;
    window.refreshDiscordConnection = refreshDiscordConnection;
    window.toggleDiscordSettings = toggleDiscordSettings;
    window.saveDiscordPreferences = saveDiscordPreferences;
    window.verifyDiscord = verifyDiscord;
});
