document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Load user data
    loadUserData();
    
    // Load social platforms
    loadSocialPlatforms();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize preview
    updatePreview();
    
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
                
                updatePreview();
            });
        });
        
        // Container toggle
        const containerToggle = document.getElementById('container-enabled');
        containerToggle.addEventListener('change', () => {
            document.getElementById('container-settings').style.display = containerToggle.checked ? 'block' : 'none';
            updatePreview();
        });
        
        // Range input values
        document.getElementById('bg-opacity').addEventListener('input', function() {
            document.getElementById('opacity-value').textContent = this.value;
            updatePreview();
        });
        
        document.getElementById('container-opacity').addEventListener('input', function() {
            document.getElementById('container-opacity-value').textContent = this.value;
            updatePreview();
        });
        
        document.getElementById('container-radius').addEventListener('input', function() {
            document.getElementById('radius-value').textContent = `${this.value}px`;
            updatePreview();
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
        
        // Preview buttons
        document.getElementById('preview-mobile-btn').addEventListener('click', function() {
            document.getElementById('preview-desktop-btn').classList.remove('active');
            this.classList.add('active');
            document.querySelector('.preview-frame-container').classList.add('mobile-view');
            updatePreview();
        });
        
        document.getElementById('preview-desktop-btn').addEventListener('click', function() {
            document.getElementById('preview-mobile-btn').classList.remove('active');
            this.classList.add('active');
            document.querySelector('.preview-frame-container').classList.remove('mobile-view');
            updatePreview();
        });
        
        document.getElementById('refresh-preview-btn').addEventListener('click', updatePreview);
        
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
            updatePreview();
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
            updatePreview();
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
            updatePreview();
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
            updatePreview();
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
    
    function updatePreview() {
        const previewFrame = document.getElementById('preview-frame');
        const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        
        // Get template data
        const templateData = getTemplateData();
        
        // Create HTML content
        const html = generatePreviewHTML(templateData);
        
        // Update preview
        previewDoc.open();
        previewDoc.write(html);
        previewDoc.close();
    }
    
    function getTemplateData() {
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
                icon: icon
            });
        });
        
        // Get songs
        const songs = [];
        document.querySelectorAll('.song-item').forEach(item => {
            const title = item.querySelector('.song-title').textContent;
            const artist = item.querySelector('.song-artist').textContent;
            const coverUrl = item.querySelector('.song-cover img').src;
            
            songs.push({
                title: title,
                artist: artist,
                cover_url: coverUrl,
                youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' // Placeholder
            });
        });
        
        // Get tags
        const tags = [];
        document.querySelectorAll('.selected-tag').forEach(tag => {
            tags.push(tag.dataset.tag);
        });
        
        return {
            name: document.getElementById('template-name').value || 'My Template',
            description: document.getElementById('template-description').value || 'A custom template',
            preview_image: document.getElementById('template-preview').value || 'img/template-placeholder.jpg',
            tags: tags,
            page_config: {
                title: document.getElementById('template-title').value || 'My Page',
                name: document.getElementById('template-name-display').value || 'Your Name',
                bio: document.getElementById('template-bio').value || '',
                avatar_url: document.getElementById('template-avatar-url').value || '',
                avatar_animation: document.getElementById('template-avatar-animation').value,
                background: {
                    type: backgroundType,
                    value: backgroundValue,
                    opacity: document.getElementById('bg-opacity').value
                },
                layout: {
                    type: document.getElementById('template-layout').value,
                    container_style: {
                        enabled: containerEnabled,
                        background_color: containerBg,
                        opacity: containerOpacity,
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
    
    function generatePreviewHTML(templateData) {
        const pageConfig = templateData.page_config;
        const background = pageConfig.background;
        const layout = pageConfig.layout;
        
        // Generate background style
        let backgroundStyle = '';
        if (background.type === 'solid') {
            backgroundStyle = `background-color: ${background.value}; opacity: ${background.opacity};`;
        } else if (background.type === 'gradient') {
            backgroundStyle = `background: ${background.value}; opacity: ${background.opacity};`;
        } else if (background.type === 'image') {
            backgroundStyle = `background-image: url('${background.value}'); background-size: cover; background-position: center; opacity: ${background.opacity};`;
        }
        
        // Generate container style
        let containerStyle = '';
        if (layout.container_style.enabled) {
            containerStyle = `
                background-color: ${layout.container_style.background_color};
                opacity: ${layout.container_style.opacity};
                border-radius: ${layout.container_style.border_radius}px;
                ${layout.container_style.shadow ? 'box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);' : ''}
            `;
        }
        
        // Generate social links HTML
        const socialLinksHTML = pageConfig.social_links.map(link => {
            return `
                <a href="${link.url}" class="social-link" target="_blank" rel="noopener noreferrer">
                    <i class="${link.icon}"></i>
                </a>
            `;
        }).join('');
        
        // Generate songs HTML
        const songsHTML = pageConfig.songs.map(song => {
            return `
                <div class="song">
                    <div class="song-cover">
                        <img src="${song.cover_url}" alt="${song.title}">
                    </div>
                    <div class="song-info">
                        <div class="song-title">${song.title}</div>
                        <div class="song-artist">${song.artist}</div>
                    </div>
                    <div class="song-play">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
            `;
        }).join('');
        
        // Create HTML
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${pageConfig.title}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Inter', sans-serif;
                        min-height: 100vh;
                        color: #fffffe;
                        line-height: 1.6;
                    }
                    
                    .page-background {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: -1;
                        ${backgroundStyle}
                    }
                    
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 2rem;
                        ${containerStyle}
                    }
                    
                    .profile {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }
                    
                    .avatar {
                        width: 120px;
                        height: 120px;
                        border-radius: 50%;
                        overflow: hidden;
                        margin-bottom: 1rem;
                        border: 3px solid #4ecdc4;
                    }
                    
                    .avatar img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    
                    .profile-name {
                        font-size: 2rem;
                        font-weight: 700;
                        margin-bottom: 0.5rem;
                    }
                    
                    .profile-bio {
                        margin-bottom: 2rem;
                        color: rgba(255, 255, 255, 0.8);
                    }
                    
                    .social-links {
                        display: flex;
                        justify-content: center;
                        flex-wrap: wrap;
                        gap: 1rem;
                        margin-bottom: 2rem;
                    }
                    
                    .social-link {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background-color: rgba(78, 205, 196, 0.2);
                        color: #fffffe;
                        transition: all 0.3s ease;
                    }
                    
                    .social-link:hover {
                        background-color: #4ecdc4;
                        transform: translateY(-3px);
                    }
                    
                    .songs-container {
                        margin-top: 2rem;
                    }
                    
                    .song {
                        display: flex;
                        align-items: center;
                        padding: 1rem;
                        background-color: rgba(0, 0, 0, 0.2);
                        border-radius: 8px;
                        margin-bottom: 1rem;
                        transition: all 0.3s ease;
                    }
                    
                    .song:hover {
                        background-color: rgba(0, 0, 0, 0.3);
                    }
                    
                    .song-cover {
                        width: 50px;
                        height: 50px;
                        border-radius: 4px;
                        overflow: hidden;
                        margin-right: 1rem;
                    }
                    
                    .song-cover img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    
                    .song-info {
                        flex-grow: 1;
                    }
                    
                    .song-title {
                        font-weight: 600;
                    }
                    
                    .song-artist {
                        font-size: 0.875rem;
                        color: rgba(255, 255, 255, 0.7);
                    }
                    
                    .song-play {
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background-color: #4ecdc4;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    
                    .song-play:hover {
                        transform: scale(1.1);
                    }
                    
                    .profile-footer {
                        margin-top: 2rem;
                        text-align: center;
                        font-size: 0.875rem;
                        color: rgba(255, 255, 255, 0.6);
                    }
                    
                    /* Custom avatar animations */
                    .avatar-animation-pulse {
                        animation: pulse 2s infinite;
                    }
                    
                    .avatar-animation-bounce {
                        animation: bounce 2s infinite;
                    }
                    
                    .avatar-animation-rotate {
                        animation: rotate 10s linear infinite;
                    }
                    
                    .avatar-animation-shake:hover {
                        animation: shake 0.5s ease-in-out;
                    }
                    
                    @keyframes pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.7); }
                        50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(78, 205, 196, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(78, 205, 196, 0); }
                    }
                    
                    @keyframes bounce {
                        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                        40% { transform: translateY(-10px); }
                        60% { transform: translateY(-5px); }
                    }
                    
                    @keyframes rotate {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes shake {
                        0% { transform: translateX(0); }
                        25% { transform: translateX(-5px); }
                        50% { transform: translateX(5px); }
                        75% { transform: translateX(-5px); }
                        100% { transform: translateX(0); }
                    }
                    
                    /* Custom layout adjustments */
                    .layout-card .container {
                        border-radius: 20px;
                        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
                    }
                    
                    .layout-modern .profile-name {
                        text-transform: uppercase;
                        letter-spacing: 2px;
                    }
                    
                    .layout-minimalist {
                        font-family: 'Helvetica', sans-serif;
                    }
                    
                    .layout-minimalist .social-link {
                        border-radius: 4px;
                    }
                    
                    .layout-creative .avatar {
                        border-radius: 10px;
                        transform: rotate(3deg);
                    }
                    
                    /* Text animations */
                    .text-animation-typewriter {
                        overflow: hidden;
                        white-space: nowrap;
                        border-right: 3px solid #4ecdc4;
                        animation: typing 3.5s steps(30, end), blink-caret 0.75s step-end infinite;
                    }
                    
                    .text-animation-fade-in {
                        animation: fadeIn 2s ease;
                    }
                    
                    .text-animation-bounce {
                        animation: textBounce 1s ease;
                    }
                    
                    .text-animation-pulse {
                        animation: textPulse 2s infinite;
                    }
                    
                    @keyframes typing {
                        from { width: 0 }
                        to { width: 100% }
                    }
                    
                    @keyframes blink-caret {
                        from, to { border-color: transparent }
                        50% { border-color: #4ecdc4 }
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes textBounce {
                        0% { transform: translateY(-20px); opacity: 0; }
                        100% { transform: translateY(0); opacity: 1; }
                    }
                    
                    @keyframes textPulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.6; }
                        100% { opacity: 1; }
                    }
                    
                    /* Add custom CSS */
                    ${pageConfig.custom_css}
                </style>
            </head>
            <body class="layout-${layout.type}">
                <div class="page-background"></div>
                
                <div class="container">
                    <div class="profile">
                        <div class="avatar ${pageConfig.avatar_animation !== 'none' ? 'avatar-animation-' + pageConfig.avatar_animation : ''}">
                            <img src="${pageConfig.avatar_url || 'img/default-avatar.png'}" alt="${pageConfig.name}">
                        </div>
                        
                        <h1 class="profile-name ${pageConfig.name_effect && pageConfig.name_effect.name !== 'none' ? 'text-animation-' + pageConfig.name_effect.name : ''}">${pageConfig.name}</h1>
                        
                        <p class="profile-bio ${pageConfig.bio_effect && pageConfig.bio_effect.name !== 'none' ? 'text-animation-' + pageConfig.bio_effect.name : ''}">${pageConfig.bio || 'Welcome to my page'}</p>
                        
                        <div class="social-links">
                            ${socialLinksHTML}
                        </div>
                        
                        ${pageConfig.songs.length > 0 ? `
                            <div class="songs-container">
                                <h2>My Music</h2>
                                ${songsHTML}
                            </div>
                        ` : ''}
                        
                        <div class="profile-footer">
                            ${pageConfig.show_joined_date ? '<p>Joined: January 2023</p>' : ''}
                            ${pageConfig.show_views ? '<p>Views: 123</p>' : ''}
                        </div>
                    </div>
                </div>
                
                <script>
                    /* Add custom JavaScript */
                    ${pageConfig.custom_js}
                </script>
            </body>
            </html>
        `;
    }
    
    async function saveTemplate() {
        try {
            const templateData = getTemplateData();
            
            // Validate required fields
            if (!templateData.name || !templateData.description || !templateData.preview_image) {
                alert('Please fill in all required template information fields');
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
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create template');
            }
            
            const result = await response.json();
            
            alert('Template created successfully!');
            window.location.href = 'templates.html';
            
        } catch (error) {
            console.error('Error saving template:', error);
            alert('Error creating template: ' + error.message);
        }
    }
});