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
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Load user data
    loadUserData();
    
    // Load social platforms
    loadSocialPlatforms();
    
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
                }
                return;
            }
            
            const userData = await response.json();
            
            // Update sidebar user info
            document.getElementById('sidebar-username').textContent = userData.username || 'User';
            document.getElementById('sidebar-email').textContent = userData.email;
            
            if (userData.avatar_url) {
                document.getElementById('sidebar-avatar').src = userData.avatar_url;
            }
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    async function loadSocialPlatforms() {
        try {
            const response = await fetch(`${API_URL}/social-platforms`);
            const data = await response.json();
            
            const platformSelect = document.getElementById('social-platform');
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
            });
        });
        
        // Container toggle
        const containerToggle = document.getElementById('container-enabled');
        containerToggle.addEventListener('change', () => {
            document.getElementById('container-settings').style.display = containerToggle.checked ? 'block' : 'none';
        });
        
        // Range input values
        document.getElementById('bg-opacity').addEventListener('input', function() {
            document.getElementById('opacity-value').textContent = this.value;
        });
        
        document.getElementById('container-opacity').addEventListener('input', function() {
            document.getElementById('container-opacity-value').textContent = this.value;
        });
        
        document.getElementById('container-radius').addEventListener('input', function() {
            document.getElementById('radius-value').textContent = `${this.value}px`;
        });
        
        // Preview image
        document.getElementById('template-preview').addEventListener('input', function() {
            const previewImage = document.getElementById('preview-image');
            if (this.value) {
                previewImage.src = this.value;
                previewImage.onerror = () => {
                    previewImage.src = 'img/template-placeholder.jpg';
                };
            } else {
                previewImage.src = 'img/template-placeholder.jpg';
            }
        });
        
        // Remove preview-related buttons functionality
        const previewSection = document.querySelector('.template-preview-section');
        if (previewSection) {
            previewSection.remove();
        }
        
        // Social links
        document.getElementById('add-social-btn').addEventListener('click', function() {
            const modal = document.getElementById('add-social-modal');
            modal.classList.add('active');
        });
        
        document.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', function() {
                this.closest('.modal').classList.remove('active');
            });
        });
        
        document.getElementById('social-link-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const platform = document.getElementById('social-platform').value;
            const url = document.getElementById('social-url').value;
            const displayName = document.getElementById('social-display-name').value;
            
            if (!platform || !url) {
                return;
            }
            
            const selectedOption = document.querySelector(`#social-platform option[value="${platform}"]`);
            const icon = selectedOption.dataset.icon;
            
            addSocialLink({
                platform: platform,
                url: url,
                display_name: displayName,
                icon: icon
            });
            
            document.getElementById('add-social-modal').classList.remove('active');
            document.getElementById('social-link-form').reset();
        });
        
        // Songs
        document.getElementById('add-song-btn').addEventListener('click', function() {
            const modal = document.getElementById('add-song-modal');
            modal.classList.add('active');
        });
        
        document.getElementById('song-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const title = document.getElementById('song-title').value;
            const artist = document.getElementById('song-artist').value;
            const coverUrl = document.getElementById('song-cover').value;
            const youtubeUrl = document.getElementById('song-youtube').value;
            
            if (!title || !artist || !coverUrl || !youtubeUrl) {
                return;
            }
            
            addSong({
                title: title,
                artist: artist,
                cover_url: coverUrl,
                youtube_url: youtubeUrl
            });
            
            document.getElementById('add-song-modal').classList.remove('active');
            document.getElementById('song-form').reset();
        });
        
        // Tags
        const tagInput = document.getElementById('tag-input');
        tagInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const tag = this.value.trim();
                if (tag) {
                    addTag(tag);
                    this.value = '';
                }
            }
        });
        
        document.querySelectorAll('.tag-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', function() {
                addTag(this.dataset.tag);
            });
        });
        
        // Save template
        document.getElementById('save-template-btn').addEventListener('click', saveTemplate);
        
        // Cancel button
        document.getElementById('cancel-template-btn').addEventListener('click', function() {
            window.location.href = 'templates.html';
        });
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
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
                <button type="button" class="btn btn-sm btn-icon remove-social-btn">
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
                <img src="${song.cover_url}" alt="${song.title}">
            </div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="song-actions">
                <button type="button" class="btn btn-sm btn-icon remove-song-btn">
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
        }
        
        // Get container settings
        const containerEnabled = document.getElementById('container-enabled').checked;
        const containerBg = document.getElementById('container-bg').value;
        const containerOpacity = document.getElementById('container-opacity').value;
        const containerRadius = document.getElementById('container-radius').value;
        const containerShadow = document.getElementById('container-shadow').checked;
        
        // Get social links
        const socialLinks = [];
        document.querySelectorAll('.social-item').forEach(item => {
            const platform = item.querySelector('.social-platform').textContent;
            const url = item.querySelector('.social-url').textContent;
            const icon = item.querySelector('.social-icon i').className;
            
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
                avatar_animation: document.getElementById('template-avatar-animation').value,
                background: {
                    type: backgroundType,
                    value: backgroundValue,
                    opacity: parseFloat(document.getElementById('bg-opacity').value)
                },
                layout: {
                    type: document.getElementById('template-layout').value,
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
    
    function showNotification(message, type = 'info') {
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
    }
});