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
    
    // Load user data
    loadUserData();
    
    // Load fonts, timezones, and social platforms
    loadFonts();
    loadTimezones();
    loadSocialPlatforms();
    loadEffects();
    
    // Initialize event listeners
    initEventListeners();
    
    async function loadUserData() {
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
                    return;
                }
                throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            
            // Update sidebar user info
            const sidebarUsername = document.getElementById('sidebar-username');
            const sidebarEmail = document.getElementById('sidebar-email');
            const sidebarAvatar = document.getElementById('sidebar-avatar');
            
            if (sidebarUsername) sidebarUsername.textContent = userData.username || 'User';
            if (sidebarEmail) sidebarEmail.textContent = userData.email;
            
            if (sidebarAvatar && userData.avatar_url) {
                sidebarAvatar.src = userData.avatar_url;
                sidebarAvatar.onload = function() {
                    sidebarAvatar.classList.add('loaded');
                    const avatarLoading = document.querySelector('.avatar-loading');
                    if (avatarLoading) {
                        avatarLoading.style.display = 'none';
                    }
                };
                sidebarAvatar.onerror = function() {
                    sidebarAvatar.src = 'img/default-avatar.png';
                    sidebarAvatar.classList.add('loaded');
                    const avatarLoading = document.querySelector('.avatar-loading');
                    if (avatarLoading) {
                        avatarLoading.style.display = 'none';
                    }
                };
            } else if (sidebarAvatar) {
                sidebarAvatar.src = 'img/default-avatar.png';
                sidebarAvatar.classList.add('loaded');
                const avatarLoading = document.querySelector('.avatar-loading');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            }
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load user data', 'error');
        }
    }
    
    async function loadFonts() {
        try {
            const response = await fetch(`${API_URL}/fonts`);
            if (!response.ok) {
                throw new Error('Failed to load fonts');
            }
            
            const data = await response.json();
            const fonts = data.fonts;
            
            const nameFontSelect = document.getElementById('name-font');
            const usernameFontSelect = document.getElementById('username-font');
            
            if (!nameFontSelect || !usernameFontSelect) return;
            
            // Clear existing options except the first one
            while (nameFontSelect.options.length > 1) {
                nameFontSelect.remove(1);
            }
            
            while (usernameFontSelect.options.length > 1) {
                usernameFontSelect.remove(1);
            }
            
            // Add fonts to the dropdowns
            fonts.forEach(font => {
                // For name font
                const nameOption = document.createElement('option');
                nameOption.value = font.name;
                nameOption.textContent = font.name;
                nameFontSelect.appendChild(nameOption);
                
                // For username font
                const usernameOption = document.createElement('option');
                usernameOption.value = font.name;
                usernameOption.textContent = font.name;
                usernameFontSelect.appendChild(usernameOption);
            });
        } catch (error) {
            console.error('Error loading fonts:', error);
            showNotification('Failed to load fonts', 'warning');
        }
    }
    
    async function loadTimezones() {
        try {
            const response = await fetch(`${API_URL}/timezones`);
            if (!response.ok) {
                throw new Error('Failed to load timezones');
            }
            
            const data = await response.json();
            const timezones = data.timezones;
            
            const timezoneSelect = document.getElementById('template-timezone');
            if (!timezoneSelect) return;
            
            // Clear existing options except the first one
            while (timezoneSelect.options.length > 1) {
                timezoneSelect.remove(1);
            }
            
            // Add timezones to the dropdown
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
            showNotification('Failed to load timezones', 'warning');
        }
    }
    
    async function loadSocialPlatforms() {
        try {
            const response = await fetch(`${API_URL}/social-platforms`);
            if (!response.ok) {
                throw new Error('Failed to load social platforms');
            }
            
            const data = await response.json();
            
            const platformSelect = document.getElementById('social-platform');
            if (!platformSelect) return;
            
            platformSelect.innerHTML = '<option value="">Select Platform</option>';
            
            data.platforms.forEach(platform => {
                const option = document.createElement('option');
                option.value = platform.name;
                option.textContent = platform.name.charAt(0).toUpperCase() + platform.name.slice(1);
                option.dataset.icon = platform.icon;
                option.dataset.prefix = platform.url_prefix;
                platformSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading social platforms:', error);
            showNotification('Failed to load social platforms', 'warning');
        }
    }
    
    async function loadEffects() {
        try {
            const response = await fetch(`${API_URL}/effects`);
            if (!response.ok) {
                throw new Error('Failed to load effects');
            }
            
            const data = await response.json();
            const effects = data.effects || [
                {name: 'none', label: 'None'},
                {name: 'typewriter', label: 'Typewriter'},
                {name: 'fade-in', label: 'Fade In'},
                {name: 'bounce', label: 'Bounce'},
                {name: 'pulse', label: 'Pulse'}
            ];
            
            const nameEffectSelect = document.getElementById('name-effect');
            const bioEffectSelect = document.getElementById('bio-effect');
            
            if (!nameEffectSelect || !bioEffectSelect) return;
            
            // Clear existing options
            nameEffectSelect.innerHTML = '';
            bioEffectSelect.innerHTML = '';
            
            // Add effects to the dropdowns
            effects.forEach(effect => {
                // For name effect
                const nameOption = document.createElement('option');
                nameOption.value = effect.name;
                nameOption.textContent = effect.label;
                nameEffectSelect.appendChild(nameOption);
                
                // For bio effect
                const bioOption = document.createElement('option');
                bioOption.value = effect.name;
                bioOption.textContent = effect.label;
                bioEffectSelect.appendChild(bioOption);
            });
        } catch (error) {
            console.error('Error loading effects:', error);
            
            // Fallback to hardcoded effects if API fails
            const fallbackEffects = [
                {name: 'none', label: 'None'},
                {name: 'typewriter', label: 'Typewriter'},
                {name: 'fade-in', label: 'Fade In'},
                {name: 'bounce', label: 'Bounce'},
                {name: 'pulse', label: 'Pulse'}
            ];
            
            const nameEffectSelect = document.getElementById('name-effect');
            const bioEffectSelect = document.getElementById('bio-effect');
            
            if (nameEffectSelect && bioEffectSelect) {
                nameEffectSelect.innerHTML = '';
                bioEffectSelect.innerHTML = '';
                
                fallbackEffects.forEach(effect => {
                    // For name effect
                    const nameOption = document.createElement('option');
                    nameOption.value = effect.name;
                    nameOption.textContent = effect.label;
                    nameEffectSelect.appendChild(nameOption);
                    
                    // For bio effect
                    const bioOption = document.createElement('option');
                    bioOption.value = effect.name;
                    bioOption.textContent = effect.label;
                    bioEffectSelect.appendChild(bioOption);
                });
            }
        }
    }
    
    function initEventListeners() {
        // Tab navigation
        const configTabs = document.querySelectorAll('.config-tab');
        const configContents = document.querySelectorAll('.config-content');
        
        configTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Update active tab
                configTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show corresponding content
                configContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}-content`) {
                        content.classList.add('active');
                    }
                });
            });
        });
        
        // Background type selection
        const bgOptions = document.querySelectorAll('.background-option');
        bgOptions.forEach(option => {
            option.addEventListener('click', () => {
                const bgType = option.dataset.type;
                
                // Update active option
                bgOptions.forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                
                // Show corresponding settings
                document.getElementById('solid-settings').style.display = bgType === 'solid' ? 'block' : 'none';
                document.getElementById('gradient-settings').style.display = bgType === 'gradient' ? 'block' : 'none';
                document.getElementById('image-settings').style.display = bgType === 'image' ? 'block' : 'none';
                document.getElementById('video-settings').style.display = bgType === 'video' ? 'block' : 'none';
            });
        });
        
        // Container toggle
        const containerToggle = document.getElementById('container-enabled');
        if (containerToggle) {
            containerToggle.addEventListener('change', () => {
                document.getElementById('container-settings').style.display = containerToggle.checked ? 'block' : 'none';
            });
        }
        
        // Range input values
        const bgOpacity = document.getElementById('bg-opacity');
        const opacityValue = document.getElementById('opacity-value');
        if (bgOpacity && opacityValue) {
            bgOpacity.addEventListener('input', function() {
                opacityValue.textContent = parseFloat(this.value).toFixed(1);
            });
        }
        
        const containerOpacity = document.getElementById('container-opacity');
        const containerOpacityValue = document.getElementById('container-opacity-value');
        if (containerOpacity && containerOpacityValue) {
            containerOpacity.addEventListener('input', function() {
                containerOpacityValue.textContent = parseFloat(this.value).toFixed(1);
            });
        }
        
        const containerRadius = document.getElementById('container-radius');
        const radiusValue = document.getElementById('radius-value');
        if (containerRadius && radiusValue) {
            containerRadius.addEventListener('input', function() {
                radiusValue.textContent = `${this.value}px`;
            });
        }
        
        // Preview image
        const templatePreview = document.getElementById('template-preview');
        const previewImage = document.getElementById('preview-image');
        const previewLoading = document.querySelector('.preview-loading');
        
        if (templatePreview && previewImage) {
            templatePreview.addEventListener('input', function() {
                if (this.value) {
                    previewLoading.style.display = 'flex';
                    previewImage.style.opacity = '0';
                    
                    previewImage.src = this.value;
                    previewImage.onload = () => {
                        previewLoading.style.display = 'none';
                        previewImage.style.opacity = '1';
                    };
                    previewImage.onerror = () => {
                        previewImage.src = 'img/template-placeholder.jpg';
                        previewLoading.style.display = 'none';
                        previewImage.style.opacity = '1';
                        showNotification('Invalid image URL', 'warning');
                    };
                } else {
                    previewImage.src = 'img/template-placeholder.jpg';
                }
            });
        }
        
        // Social links
        const addSocialBtn = document.getElementById('add-social-btn');
        if (addSocialBtn) {
            addSocialBtn.addEventListener('click', function() {
                const modal = document.getElementById('add-social-modal');
                modal.classList.add('active');
            });
        }
        
        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(button => {
            button.addEventListener('click', function() {
                this.closest('.modal').classList.remove('active');
            });
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Social link form submission
        const socialLinkForm = document.getElementById('social-link-form');
        if (socialLinkForm) {
            socialLinkForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const platform = document.getElementById('social-platform').value;
                const url = document.getElementById('social-url').value;
                const displayName = document.getElementById('social-display-name').value;
                
                if (!platform || !url) {
                    showNotification('Please fill in all required fields', 'error');
                    return;
                }
                
                const selectedOption = document.querySelector(`#social-platform option[value="${platform}"]`);
                const icon = selectedOption.dataset.icon || 'fab fa-link';
                
                addSocialLink({
                    platform: platform,
                    url: url,
                    display_name: displayName,
                    icon: icon
                });
                
                document.getElementById('add-social-modal').classList.remove('active');
                socialLinkForm.reset();
                showNotification('Social link added', 'success');
            });
        }
        
        // Songs
        const addSongBtn = document.getElementById('add-song-btn');
        if (addSongBtn) {
            addSongBtn.addEventListener('click', function() {
                const modal = document.getElementById('add-song-modal');
                modal.classList.add('active');
            });
        }
        
        // Song form submission
        const songForm = document.getElementById('song-form');
        if (songForm) {
            songForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const title = document.getElementById('song-title').value;
                const artist = document.getElementById('song-artist').value;
                const coverUrl = document.getElementById('song-cover').value;
                const youtubeUrl = document.getElementById('song-youtube').value;
                
                if (!title || !artist || !coverUrl || !youtubeUrl) {
                    showNotification('Please fill in all required fields', 'error');
                    return;
                }
                
                addSong({
                    title: title,
                    artist: artist,
                    cover_url: coverUrl,
                    youtube_url: youtubeUrl
                });
                
                document.getElementById('add-song-modal').classList.remove('active');
                songForm.reset();
                showNotification('Song added', 'success');
            });
        }
        
        // Tags
        const tagInput = document.getElementById('tag-input');
        if (tagInput) {
            tagInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const tag = this.value.trim().toLowerCase();
                    if (tag) {
                        addTag(tag);
                        this.value = '';
                    }
                }
            });
        }
        
        // Tag suggestions
        document.querySelectorAll('.tag-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', function() {
                addTag(this.dataset.tag);
            });
        });
        
        // Save template
        const saveTemplateBtn = document.getElementById('save-template-btn');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', saveTemplate);
        }
        
        // Cancel button
        const cancelTemplateBtn = document.getElementById('cancel-template-btn');
        if (cancelTemplateBtn) {
            cancelTemplateBtn.addEventListener('click', function() {
                if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                    window.location.href = 'templates.html';
                }
            });
        }
        
        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            });
        }
    }
    
    function addSocialLink(socialLink) {
        const container = document.getElementById('social-links-container');
        const emptyMessage = container.querySelector('.empty-social');
        if (emptyMessage) {
            emptyMessage.remove();
        }
        
        const socialItem = document.createElement('div');
        socialItem.className = 'social-item';
        socialItem.innerHTML = `
            <div class="social-icon">
                <i class="${socialLink.icon}"></i>
            </div>
            <div class="social-info">
                <div class="social-platform">${socialLink.platform}</div>
                <div class="social-url">${socialLink.display_name || socialLink.url}</div>
            </div>
            <div class="social-actions">
                <button type="button" class="remove-social-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        const removeBtn = socialItem.querySelector('.remove-social-btn');
        removeBtn.addEventListener('click', function() {
            socialItem.remove();
            if (container.querySelectorAll('.social-item').length === 0) {
                container.innerHTML = `
                    <div class="empty-social">
                        <p>No social links added yet</p>
                    </div>
                `;
            }
        });
        
        container.appendChild(socialItem);
    }
    
    function addSong(song) {
        const container = document.getElementById('songs-container');
        const emptyMessage = container.querySelector('.empty-songs');
        if (emptyMessage) {
            emptyMessage.remove();
        }
        
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.dataset.youtubeUrl = song.youtube_url;
        songItem.innerHTML = `
            <div class="song-cover">
                <img src="${song.cover_url}" alt="${song.title}" onerror="this.src='img/placeholder-music.png'">
            </div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="song-actions">
                <button type="button" class="remove-song-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        const removeBtn = songItem.querySelector('.remove-song-btn');
        removeBtn.addEventListener('click', function() {
            songItem.remove();
            if (container.querySelectorAll('.song-item').length === 0) {
                container.innerHTML = `
                    <div class="empty-songs">
                        <p>No songs added yet</p>
                    </div>
                `;
            }
        });
        
        container.appendChild(songItem);
    }
    
    function addTag(tag) {
        // Clean the tag - lowercase, no spaces, max 20 chars
        tag = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 20);
        
        if (!tag) return;
        
        // Check if tag already exists
        const existingTags = Array.from(document.querySelectorAll('.selected-tag')).map(el => el.dataset.tag);
        if (existingTags.includes(tag)) {
            return;
        }
        
        const tagsContainer = document.getElementById('selected-tags');
        const tagElement = document.createElement('div');
        tagElement.className = 'selected-tag';
        tagElement.dataset.tag = tag;
        tagElement.innerHTML = `
            <span>${tag}</span>
            <button type="button" class="remove-tag-btn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const removeBtn = tagElement.querySelector('.remove-tag-btn');
        removeBtn.addEventListener('click', function() {
            tagElement.remove();
        });
        
        tagsContainer.appendChild(tagElement);
    }
    
    function getTemplateData() {
        // Get user ID from stored user data
        let userId = null;
        try {
            const userData = JSON.parse(localStorage.getItem('user'));
            userId = userData._id || userData.id;
        } catch (e) {
            console.error('Error getting user ID:', e);
        }
    
        // Get background type
        const activeBackgroundOption = document.querySelector('.background-option.active');
        const backgroundType = activeBackgroundOption ? activeBackgroundOption.dataset.type : 'solid';
        
        // Get background value based on type
        let backgroundValue = '';
        if (backgroundType === 'solid') {
            backgroundValue = document.getElementById('bg-color').value;
        } else if (backgroundType === 'gradient') {
            const startColor = document.getElementById('gradient-start').value;
            const endColor = document.getElementById('gradient-end').value;
            const direction = document.getElementById('gradient-direction').value;
            backgroundValue = `linear-gradient(${direction}, ${startColor}, ${endColor})`;
        } else if (backgroundType === 'image') {
            backgroundValue = document.getElementById('bg-image-url').value || 'https://source.unsplash.com/random';
        } else if (backgroundType === 'video') {
            backgroundValue = document.getElementById('bg-video-url').value || '';
        }
                
        // Get container settings
        const containerEnabled = document.getElementById('container-enabled').checked;
        const containerBg = document.getElementById('container-bg').value;
        const containerOpacity = document.getElementById('container-opacity').value;
        const containerRadius = document.getElementById('container-radius').value;
        const containerShadow = document.getElementById('container-shadow').checked;
        
        // Get text styling
        const nameColor = document.getElementById('name-color').value;
        const nameFont = document.getElementById('name-font').value;
        const usernameColor = document.getElementById('username-color').value;
        const usernameFont = document.getElementById('username-font').value;
        
        // Get social links
        const socialLinks = [];
        document.querySelectorAll('.social-item').forEach(item => {
            const platform = item.querySelector('.social-platform').textContent;
            const url = item.querySelector('.social-url').textContent;
            
            socialLinks.push({
                platform: platform,
                url: url,
                display_name: url !== item.querySelector('.social-url').textContent ? item.querySelector('.social-url').textContent : null
            });
        });
        
        // Get songs
        const songs = [];
        document.querySelectorAll('.song-item').forEach(item => {
            const title = item.querySelector('.song-title').textContent;
            const artist = item.querySelector('.song-artist').textContent;
            const coverUrl = item.querySelector('.song-cover img').src;
            const youtubeUrl = item.dataset.youtubeUrl || '';
            
            songs.push({
                title: title,
                artist: artist,
                cover_url: coverUrl,
                youtube_url: youtubeUrl
            });
        });
        
        // Get tags
        const tags = [];
        document.querySelectorAll('.selected-tag').forEach(tag => {
            tags.push(tag.dataset.tag);
        });
        
        // Generate a template name for the URL if one isn't provided
        const templateName = document.getElementById('template-name').value || 'My Template';
        const templateUrl = templateName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        return {
            name: templateName,
            description: document.getElementById('template-description').value || 'A custom template',
            preview_image: document.getElementById('template-preview').value || 'img/template-placeholder.jpg',
            tags: tags,
            created_by: userId, // Add the user ID
            page_config: {
                title: document.getElementById('template-title').value || 'My Page',
                url: templateUrl, // Add the generated URL
                name: document.getElementById('template-name-display').value || 'Your Name',
                bio: document.getElementById('template-bio').value || '',
                avatar_url: document.getElementById('template-avatar-url').value || '',
                timezone: document.getElementById('template-timezone').value || null,
                name_style: {
                    color: nameColor,
                    font: {
                        name: nameFont,
                        value: "",
                        link: ""
                    }
                },
                username_style: {
                    color: usernameColor,
                    font: {
                        name: usernameFont,
                        value: "",
                        link: ""
                    }
                },
                background: {
                    type: backgroundType,
                    value: backgroundValue,
                    opacity: parseFloat(document.getElementById('bg-opacity').value)
                },
                layout: {
                    type: "standard",
                    container_style: {
                        enabled: containerEnabled,
                        background_color: containerBg,
                        opacity: parseFloat(containerOpacity),
                        border_radius: parseInt(containerRadius),
                        shadow: containerShadow
                    }
                },
                social_links: socialLinks,
                songs: songs,
                show_joined_date: document.getElementById('show-joined-date').checked,
                show_views: document.getElementById('show-views').checked,
                show_timezone: document.getElementById('show-timezone').checked,
                name_effect: {
                    name: document.getElementById('name-effect').value
                },
                bio_effect: {
                    name: document.getElementById('bio-effect').value
                },
                custom_css: document.getElementById('custom-css').value,
                custom_js: document.getElementById('custom-js').value
            }
        };
    }
    
    async function saveTemplate() {
        try {
            // Show loading state
            const saveBtn = document.getElementById('save-template-btn');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            const templateData = getTemplateData();
            
            // Validate required fields
            if (!templateData.name) {
                showNotification('Template name is required', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
                return;
            }
            
            if (!templateData.description) {
                showNotification('Template description is required', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
                return;
            }
            
            if (!templateData.preview_image) {
                showNotification('Preview image is required', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
                return;
            }
            
            if (templateData.tags.length === 0) {
                showNotification('Please add at least one tag', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
                return;
            }
            
            if (!templateData.created_by) {
                showNotification('User ID is missing. Try logging out and back in.', 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
                return;
            }
            
            // Send to API
            const response = await fetch(`${API_URL}/templates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(templateData)
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to create template';
                
                try {
                    const errorData = await response.json();
                    
                    if (errorData.detail && Array.isArray(errorData.detail)) {
                        // Format validation errors for better display
                        const errors = errorData.detail.map(err => {
                            // Convert the location path to a more readable format
                            const field = err.loc.slice(1).join('.');
                            return `${field}: ${err.msg}`;
                        });
                        
                        errorMessage = `Validation errors:\n${errors.join('\n')}`;
                    } else if (errorData.detail) {
                        errorMessage = errorData.detail;
                    }
                } catch (e) {
                    // If response is not JSON
                    errorMessage = `Server error: ${response.status}`;
                }
                
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            showNotification('Template created successfully!', 'success');
            
            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = 'templates.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error saving template:', error);
            showNotification(`Error: ${error.message}`, 'error');
            
            // Reset button state
            const saveBtn = document.getElementById('save-template-btn');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Template';
        }
    }
    
    // Improved notification system
    function showNotification(message, type = 'info') {
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
    }
});
