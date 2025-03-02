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
    
    // Load user data for sidebar
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
                    return;
                }
                throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            
            // Update sidebar user info
            document.getElementById('sidebar-username').textContent = userData.username || 'User';
            document.getElementById('sidebar-email').textContent = userData.email;
            
            if (userData.avatar_url) {
                document.getElementById('sidebar-avatar').src = userData.avatar_url;
            }
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };
    
    // Load user's pages for dropdown
    const loadUserPages = async () => {
        try {
            const response = await fetch(`${API_URL}/pages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch pages');
            }
            
            const pages = await response.json();
            const pageSelector = document.getElementById('page-selector');
            
            // Clear existing options except the first one
            pageSelector.innerHTML = '<option value="">Select a page to edit</option>';
            
            // Add pages to dropdown
            pages.forEach(page => {
                const option = document.createElement('option');
                option.value = page.page_id;
                option.textContent = page.title;
                pageSelector.appendChild(option);
            });
            
            // Check if page_id is in URL query parameters
            const urlParams = new URLSearchParams(window.location.search);
            const pageId = urlParams.get('page_id');
            
            if (pageId) {
                pageSelector.value = pageId;
                loadPageData(pageId);
            }
            
            return pages;
        } catch (error) {
            console.error('Error loading pages:', error);
            return [];
        }
    };
    
    // Load page data for editing
    const loadPageData = async (pageId) => {
        try {
            const response = await fetch(`${API_URL}/pages/${pageId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch page data');
            }
            
            const pageData = await response.json();
            
            // Show editor and hide empty state
            document.getElementById('no-page-selected').style.display = 'none';
            document.getElementById('editor-container').style.display = 'grid';
            document.getElementById('save-actions').style.display = 'flex';
            
            // Show view page button
            const viewPageBtn = document.getElementById('view-page-btn');
            viewPageBtn.style.display = 'inline-flex';
            viewPageBtn.href = `https://versz.fun/p/${pageData.url}`;
            
            // Populate form fields
            populateFormFields(pageData);
            
            // Update preview
            updatePreview(pageData);
            
            return pageData;
        } catch (error) {
            console.error('Error loading page data:', error);
            showNotification('Failed to load page data', 'error');
        }
    };
    
    // Populate form fields with page data
    const populateFormFields = (pageData) => {
        // Basics tab
        document.getElementById('edit-title').value = pageData.title;
        document.getElementById('edit-url').value = pageData.url;
        document.getElementById('edit-name').value = pageData.display_name || '';
        document.getElementById('edit-bio').value = pageData.bio || '';
        document.getElementById('edit-avatar-url').value = pageData.avatar_url || '';
        document.getElementById('edit-avatar-animation').value = pageData.avatar_animation || 'none';
        
        // Update avatar preview
        const avatarPreviewImg = document.getElementById('avatar-preview-img');
        if (pageData.avatar_url) {
            avatarPreviewImg.src = pageData.avatar_url;
            avatarPreviewImg.onerror = () => {
                avatarPreviewImg.src = 'img/default-avatar.png';
            };
        } else {
            avatarPreviewImg.src = 'img/default-avatar.png';
        }
        
        // Appearance tab
        document.getElementById('edit-layout').value = pageData.layout.type;
        
        // Set background type
        const backgroundType = pageData.background.type;
        const bgOptions = document.querySelectorAll('.background-option');
        const bgSettings = document.querySelectorAll('.background-settings');
        
        bgOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.type === backgroundType);
        });
        
        bgSettings.forEach(setting => {
            setting.style.display = 'none';
        });
        
        document.getElementById(`edit-${backgroundType}-settings`).style.display = 'block';
        
        // Set background values based on type
        switch (backgroundType) {
            case 'solid':
                document.getElementById('edit-bg-color').value = pageData.background.value;
                break;
                
            case 'gradient':
                // Parse gradient value (format: linear-gradient(direction, start, end))
                const gradientMatch = pageData.background.value.match(/linear-gradient\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (gradientMatch) {
                    document.getElementById('edit-gradient-direction').value = gradientMatch[1].trim();
                    document.getElementById('edit-gradient-start').value = gradientMatch[2].trim();
                    document.getElementById('edit-gradient-end').value = gradientMatch[3].trim();
                }
                break;
                
            case 'image':
                document.getElementById('edit-bg-image-url').value = pageData.background.value;
                break;
        }
        
        // Set background opacity
        document.getElementById('edit-bg-opacity').value = pageData.background.opacity;
        document.getElementById('opacity-value').textContent = pageData.background.opacity.toFixed(1);
        
        // Container settings
        document.getElementById('container-enabled').checked = pageData.layout.container_style.enabled;
        document.getElementById('container-settings').style.display = pageData.layout.container_style.enabled ? 'block' : 'none';
        
        document.getElementById('edit-container-bg').value = pageData.layout.container_style.background_color;
        document.getElementById('edit-container-opacity').value = pageData.layout.container_style.opacity;
        document.getElementById('container-opacity-value').textContent = pageData.layout.container_style.opacity.toFixed(1);
        
        document.getElementById('edit-container-radius').value = pageData.layout.container_style.border_radius;
        document.getElementById('radius-value').textContent = `${pageData.layout.container_style.border_radius}px`;
        
        document.getElementById('container-shadow').checked = pageData.layout.container_style.shadow;
        
        // Content tab
        document.getElementById('edit-name-effect').value = pageData.name_effect || 'none';
        document.getElementById('edit-bio-effect').value = pageData.bio_effect || 'none';
        
        document.getElementById('show-joined-date').checked = pageData.show_joined_date;
        document.getElementById('show-views').checked = pageData.show_views;
        
        // Load songs
        const songsContainer = document.getElementById('songs-container');
        if (pageData.songs && pageData.songs.length > 0) {
            songsContainer.innerHTML = '';
            
            pageData.songs.forEach((song, index) => {
                const songElement = createSongElement(song, index);
                songsContainer.appendChild(songElement);
            });
        } else {
            songsContainer.innerHTML = `
                <div class="empty-songs">
                    <p>No songs added yet</p>
                </div>
            `;
        }
        
        // Social links tab
        const socialLinksContainer = document.getElementById('social-links-container');
        if (pageData.social_links && pageData.social_links.length > 0) {
            socialLinksContainer.innerHTML = '';
            
            pageData.social_links.forEach((link, index) => {
                const linkElement = createSocialLinkElement(link, index);
                socialLinksContainer.appendChild(linkElement);
            });
        } else {
            socialLinksContainer.innerHTML = `
                <div class="empty-social">
                    <p>No social links added yet</p>
                </div>
            `;
        }
        
        // Advanced tab
        document.getElementById('edit-custom-css').value = pageData.custom_css || '';
        document.getElementById('edit-custom-js').value = pageData.custom_js || '';
    };
    
    // Create a song element
    const createSongElement = (song, index) => {
        const songElement = document.createElement('div');
        songElement.className = 'song-item';
        songElement.dataset.index = index;
        
        songElement.innerHTML = `
            <div class="song-cover">
                <img src="${song.cover_url}" alt="${song.title}">
            </div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="song-actions">
                <button type="button" class="btn btn-sm btn-icon remove-song" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        return songElement;
    };
    
    // Create a social link element
    const createSocialLinkElement = (link, index) => {
        const linkElement = document.createElement('div');
        linkElement.className = 'social-item';
        linkElement.dataset.index = index;
        
        // Get platform icon
        let platformIcon = 'fa-link';
        switch (link.platform.toLowerCase()) {
            case 'instagram':
                platformIcon = 'fa-instagram';
                break;
            case 'twitter':
                platformIcon = 'fa-twitter';
                break;
            case 'facebook':
                platformIcon = 'fa-facebook-f';
                break;
            case 'youtube':
                platformIcon = 'fa-youtube';
                break;
            case 'tiktok':
                platformIcon = 'fa-tiktok';
                break;
            case 'twitch':
                platformIcon = 'fa-twitch';
                break;
            case 'linkedin':
                platformIcon = 'fa-linkedin-in';
                break;
            case 'github':
                platformIcon = 'fa-github';
                break;
            case 'discord':
                platformIcon = 'fa-discord';
                break;
            case 'spotify':
                platformIcon = 'fa-spotify';
                break;
            case 'snapchat':
                platformIcon = 'fa-snapchat';
                break;
            case 'reddit':
                platformIcon = 'fa-reddit-alien';
                break;
        }
        
        linkElement.innerHTML = `
            <div class="social-icon">
                <i class="fab ${platformIcon}"></i>
            </div>
            <div class="social-info">
                <div class="social-platform">${link.platform}</div>
                <div class="social-url">${link.display_name || link.url}</div>
            </div>
            <div class="social-actions">
                <button type="button" class="btn btn-sm btn-icon remove-social" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        return linkElement;
    };
    
    // Update preview iframe
    const updatePreview = (pageData) => {
        const previewFrame = document.getElementById('preview-frame');
        
        // Create a simple HTML representation of the page
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${pageData.title}</title>
                <style>
                    body {
                        font-family: 'Inter', sans-serif;
                        margin: 0;
                        padding: 0;
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background-color: ${pageData.background.type === 'solid' ? pageData.background.value : '#f5f5f5'};
                        background-image: ${pageData.background.type === 'gradient' ? pageData.background.value : (pageData.background.type === 'image' ? `url(${pageData.background.value})` : 'none')};
                        background-size: cover;
                        background-position: center;
                        color: #333;
                    }
                    
                    .container {
                        ${pageData.layout.container_style.enabled ? `
                            background-color: ${pageData.layout.container_style.background_color};
                            opacity: ${pageData.layout.container_style.opacity};
                            border-radius: ${pageData.layout.container_style.border_radius}px;
                            box-shadow: ${pageData.layout.container_style.shadow ? '0 4px 15px rgba(0, 0, 0, 0.1)' : 'none'};
                            padding: 2rem;
                            max-width: 600px;
                            width: 90%;
                            text-align: center;
                        ` : ''}
                    }
                    
                    .avatar {
                        width: 120px;
                        height: 120px;
                        border-radius: 50%;
                        overflow: hidden;
                        margin: 0 auto 1rem;
                    }
                    
                    .avatar img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    
                    h1 {
                        margin: 0 0 0.5rem;
                        font-size: 1.8rem;
                    }
                    
                    p {
                        margin: 0 0 1.5rem;
                        color: #666;
                    }
                    
                    .social-links {
                        display: flex;
                        justify-content: center;
                        flex-wrap: wrap;
                        gap: 1rem;
                        margin-bottom: 1.5rem;
                    }
                    
                    .social-link {
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background-color: #333;
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-decoration: none;
                    }
                    
                    .meta-info {
                        font-size: 0.8rem;
                        color: #999;
                        margin-top: 2rem;
                    }
                    
                    ${pageData.custom_css || ''}
                </style>
            </head>
            <body>
                <div class="container">
                    ${pageData.avatar_url ? `
                        <div class="avatar">
                            <img src="${pageData.avatar_url}" alt="${pageData.display_name || 'User'}">
                        </div>
                    ` : ''}
                    
                    <h1>${pageData.display_name || 'User'}</h1>
                    
                    ${pageData.bio ? `<p>${pageData.bio}</p>` : ''}
                    
                    ${pageData.social_links && pageData.social_links.length > 0 ? `
                        <div class="social-links">
                            ${pageData.social_links.map(link => {
                                let icon = 'fa-link';
                                switch (link.platform.toLowerCase()) {
                                    case 'instagram': icon = 'fa-instagram'; break;
                                    case 'twitter': icon = 'fa-twitter'; break;
                                    case 'facebook': icon = 'fa-facebook-f'; break;
                                    case 'youtube': icon = 'fa-youtube'; break;
                                    case 'tiktok': icon = 'fa-tiktok'; break;
                                    case 'twitch': icon = 'fa-twitch'; break;
                                    case 'linkedin': icon = 'fa-linkedin-in'; break;
                                    case 'github': icon = 'fa-github'; break;
                                    case 'discord': icon = 'fa-discord'; break;
                                    case 'spotify': icon = 'fa-spotify'; break;
                                    case 'snapchat': icon = 'fa-snapchat'; break;
                                    case 'reddit': icon = 'fa-reddit-alien'; break;
                                }
                                return `<a href="${link.url}" class="social-link" target="_blank"><i class="fab ${icon}"></i></a>`;
                            }).join('')}
                        </div>
                    ` : ''}
                    
                    ${pageData.show_joined_date || pageData.show_views ? `
                        <div class="meta-info">
                            ${pageData.show_joined_date ? `<div>Joined: January 2023</div>` : ''}
                            ${pageData.show_views ? `<div>Views: 0</div>` : ''}
                        </div>
                    ` : ''}
                </div>
                
                <script>
                    ${pageData.custom_js || ''}
                </script>
            </body>
            </html>
        `;
        
        // Set iframe content
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
    };
    
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.editor-tab');
    const tabContents = document.querySelectorAll('.editor-tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activate selected tab
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
    
    // Background type selection
    const bgOptions = document.querySelectorAll('.background-option');
    const bgSettings = document.querySelectorAll('.background-settings');
    
    bgOptions.forEach(option => {
        option.addEventListener('click', () => {
            const bgType = option.dataset.type;
            
            // Deactivate all options
            bgOptions.forEach(opt => opt.classList.remove('active'));
            bgSettings.forEach(setting => setting.style.display = 'none');
            
            // Activate selected option
            option.classList.add('active');
            document.getElementById(`edit-${bgType}-settings`).style.display = 'block';
        });
    });
    
    // Container toggle
    const containerEnabled = document.getElementById('container-enabled');
    const containerSettings = document.getElementById('container-settings');
    
    if (containerEnabled && containerSettings) {
        containerEnabled.addEventListener('change', () => {
            containerSettings.style.display = containerEnabled.checked ? 'block' : 'none';
        });
    }
    
    // URL availability check
    const checkUrlBtn = document.getElementById('edit-check-url-btn');
    const urlInput = document.getElementById('edit-url');
    const urlStatus = document.getElementById('edit-url-status');
    
    if (checkUrlBtn && urlInput) {
        checkUrlBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            const originalUrl = urlInput.dataset.originalUrl;
            
            if (!url) {
                urlStatus.textContent = 'Please enter a URL';
                urlStatus.className = 'input-status error';
                return;
            }
            
            // Check if URL contains only alphanumeric characters and underscores
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                urlStatus.textContent = 'URL can only contain letters, numbers, and underscores';
                urlStatus.className = 'input-status error';
                return;
            }
            
            // If URL is the same as original, it's valid
            if (url === originalUrl) {
                urlStatus.textContent = 'URL is valid';
                urlStatus.className = 'input-status success';
                return;
            }
            
            urlStatus.textContent = 'Checking...';
            urlStatus.className = 'input-status info';
            
            try {
                const response = await fetch(`${API_URL}/check-url?url=${url}`);
                const data = await response.json();
                
                if (data.available) {
                    urlStatus.textContent = 'URL is available!';
                    urlStatus.className = 'input-status success';
                } else {
                    urlStatus.textContent = 'URL is already taken';
                    urlStatus.className = 'input-status error';
                }
            } catch (error) {
                console.error('Error checking URL:', error);
                urlStatus.textContent = 'Failed to check URL';
                urlStatus.className = 'input-status error';
            }
        });
    }
    
    // Range inputs with value display
    const bgOpacityInput = document.getElementById('edit-bg-opacity');
    const bgOpacityValue = document.getElementById('opacity-value');
    
    if (bgOpacityInput && bgOpacityValue) {
        bgOpacityInput.addEventListener('input', () => {
            bgOpacityValue.textContent = parseFloat(bgOpacityInput.value).toFixed(1);
        });
    }
    
    const containerOpacityInput = document.getElementById('edit-container-opacity');
    const containerOpacityValue = document.getElementById('container-opacity-value');
    
    if (containerOpacityInput && containerOpacityValue) {
        containerOpacityInput.addEventListener('input', () => {
            containerOpacityValue.textContent = parseFloat(containerOpacityInput.value).toFixed(1);
        });
    }
    const containerRadiusInput = document.getElementById('edit-container-radius');
    const radiusValue = document.getElementById('radius-value');
    
    if (containerRadiusInput && radiusValue) {
        containerRadiusInput.addEventListener('input', () => {
            radiusValue.textContent = `${containerRadiusInput.value}px`;
        });
    }
    
    // Avatar URL preview
    const avatarUrlInput = document.getElementById('edit-avatar-url');
    const avatarPreviewImg = document.getElementById('avatar-preview-img');
    
    if (avatarUrlInput && avatarPreviewImg) {
        avatarUrlInput.addEventListener('blur', () => {
            const url = avatarUrlInput.value.trim();
            if (url) {
                avatarPreviewImg.src = url;
                avatarPreviewImg.onerror = () => {
                    avatarPreviewImg.src = 'img/default-avatar.png';
                };
            } else {
                avatarPreviewImg.src = 'img/default-avatar.png';
            }
        });
    }
    
    // Preview mode toggle (mobile/desktop)
    const previewMobileBtn = document.getElementById('preview-mobile-btn');
    const previewDesktopBtn = document.getElementById('preview-desktop-btn');
    const previewFrame = document.getElementById('preview-frame');
    
    if (previewMobileBtn && previewDesktopBtn && previewFrame) {
        previewMobileBtn.addEventListener('click', () => {
            previewMobileBtn.classList.add('active');
            previewDesktopBtn.classList.remove('active');
            previewFrame.style.width = '375px';
            previewFrame.style.height = '667px';
            previewFrame.style.margin = '0 auto';
        });
        
        previewDesktopBtn.addEventListener('click', () => {
            previewDesktopBtn.classList.add('active');
            previewMobileBtn.classList.remove('active');
            previewFrame.style.width = '100%';
            previewFrame.style.height = '100%';
            previewFrame.style.margin = '0';
        });
    }
    
    // Refresh preview button
    const refreshPreviewBtn = document.getElementById('refresh-preview-btn');
    
    if (refreshPreviewBtn) {
        refreshPreviewBtn.addEventListener('click', () => {
            const pageId = document.getElementById('page-selector').value;
            if (pageId) {
                collectFormData(pageId).then(pageData => {
                    updatePreview(pageData);
                });
            }
        });
    }
    
    // Add song button
    const addSongBtn = document.getElementById('add-song-btn');
    
    if (addSongBtn) {
        addSongBtn.addEventListener('click', () => {
            openAddSongModal();
        });
    }
    
    // Open add song modal
    const openAddSongModal = () => {
        const modal = document.getElementById('add-song-modal');
        modal.classList.add('active');
        
        // Reset form
        document.getElementById('song-form').reset();
        
        // Close modal when clicking outside or on close button
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        document.querySelector('#add-song-modal .modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    };
    
    // Song form submission
    const songForm = document.getElementById('song-form');
    
    if (songForm) {
        songForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const title = document.getElementById('song-title').value;
            const artist = document.getElementById('song-artist').value;
            const coverUrl = document.getElementById('song-cover').value;
            const youtubeUrl = document.getElementById('song-youtube').value;
            
            const song = {
                title: title,
                artist: artist,
                cover_url: coverUrl,
                youtube_url: youtubeUrl
            };
            
            // Add song to the list
            const songsContainer = document.getElementById('songs-container');
            const emptyMessage = songsContainer.querySelector('.empty-songs');
            
            if (emptyMessage) {
                songsContainer.innerHTML = '';
            }
            
            // Get the number of existing songs for index
            const existingSongs = songsContainer.querySelectorAll('.song-item');
            const index = existingSongs.length;
            
            const songElement = createSongElement(song, index);
            songsContainer.appendChild(songElement);
            
            // Add event listener to remove button
            const removeBtn = songElement.querySelector('.remove-song');
            removeBtn.addEventListener('click', () => {
                songElement.remove();
                
                // If no songs left, show empty message
                if (songsContainer.children.length === 0) {
                    songsContainer.innerHTML = `
                        <div class="empty-songs">
                            <p>No songs added yet</p>
                        </div>
                    `;
                }
            });
            
            // Close modal
            document.getElementById('add-song-modal').classList.remove('active');
        });
    }
    
    // Add social link button
    const addSocialBtn = document.getElementById('add-social-btn');
    
    if (addSocialBtn) {
        addSocialBtn.addEventListener('click', () => {
            openAddSocialModal();
        });
    }
    
    // Open add social link modal
    const openAddSocialModal = () => {
        const modal = document.getElementById('add-social-modal');
        modal.classList.add('active');
        
        // Reset form
        document.getElementById('social-link-form').reset();
        
        // Populate platform dropdown if needed
        const platformSelect = document.getElementById('social-platform');
        if (platformSelect.options.length <= 1) {
            const platforms = [
                'Instagram', 'Twitter', 'Facebook', 'YouTube', 'TikTok', 'Twitch',
                'LinkedIn', 'GitHub', 'Discord', 'Spotify', 'Snapchat', 'Reddit',
                'Website', 'Email', 'Phone', 'Other'
            ];
            
            platforms.forEach(platform => {
                const option = document.createElement('option');
                option.value = platform;
                option.textContent = platform;
                platformSelect.appendChild(option);
            });
        }
        
        // Close modal when clicking outside or on close button
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        document.querySelector('#add-social-modal .modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    };
    
    // Social link form submission
    const socialLinkForm = document.getElementById('social-link-form');
    
    if (socialLinkForm) {
        socialLinkForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const platform = document.getElementById('social-platform').value;
            const url = document.getElementById('social-url').value;
            const displayName = document.getElementById('social-display-name').value;
            
            const socialLink = {
                platform: platform,
                url: url,
                display_name: displayName || null
            };
            
            // Add social link to the list
            const socialLinksContainer = document.getElementById('social-links-container');
            const emptyMessage = socialLinksContainer.querySelector('.empty-social');
            
            if (emptyMessage) {
                socialLinksContainer.innerHTML = '';
            }
            
            // Get the number of existing links for index
            const existingLinks = socialLinksContainer.querySelectorAll('.social-item');
            const index = existingLinks.length;
            
            const linkElement = createSocialLinkElement(socialLink, index);
            socialLinksContainer.appendChild(linkElement);
            
            // Add event listener to remove button
            const removeBtn = linkElement.querySelector('.remove-social');
            removeBtn.addEventListener('click', () => {
                linkElement.remove();
                
                // If no links left, show empty message
                if (socialLinksContainer.children.length === 0) {
                    socialLinksContainer.innerHTML = `
                        <div class="empty-social">
                            <p>No social links added yet</p>
                        </div>
                    `;
                }
            });
            
            // Close modal
            document.getElementById('add-social-modal').classList.remove('active');
        });
    }
    
    // Collect form data for saving
    const collectFormData = async (pageId) => {
        // Get basic info
        const title = document.getElementById('edit-title').value;
        const url = document.getElementById('edit-url').value;
        const displayName = document.getElementById('edit-name').value;
        const bio = document.getElementById('edit-bio').value;
        const avatarUrl = document.getElementById('edit-avatar-url').value;
        const avatarAnimation = document.getElementById('edit-avatar-animation').value;
        
        // Get layout and background
        const layoutType = document.getElementById('edit-layout').value;
        
        // Get active background type
        const activeBackgroundOption = document.querySelector('.background-option.active');
        const backgroundType = activeBackgroundOption.dataset.type;
        
        // Get background value based on type
        let backgroundValue = '';
        
        switch (backgroundType) {
            case 'solid':
                backgroundValue = document.getElementById('edit-bg-color').value;
                break;
                
            case 'gradient':
                const gradientStart = document.getElementById('edit-gradient-start').value;
                const gradientEnd = document.getElementById('edit-gradient-end').value;
                const gradientDirection = document.getElementById('edit-gradient-direction').value;
                backgroundValue = `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`;
                break;
                
            case 'image':
                backgroundValue = document.getElementById('edit-bg-image-url').value;
                break;
        }
        
        const backgroundOpacity = parseFloat(document.getElementById('edit-bg-opacity').value);
        
        // Get container style
        const containerEnabled = document.getElementById('container-enabled').checked;
        const containerBg = document.getElementById('edit-container-bg').value;
        const containerOpacity = parseFloat(document.getElementById('edit-container-opacity').value);
        const containerRadius = parseInt(document.getElementById('edit-container-radius').value);
        const containerShadow = document.getElementById('container-shadow').checked;
        
        // Get content settings
        const nameEffect = document.getElementById('edit-name-effect').value;
        const bioEffect = document.getElementById('edit-bio-effect').value;
        const showJoinedDate = document.getElementById('show-joined-date').checked;
        const showViews = document.getElementById('show-views').checked;
        
        // Get songs
        const songs = [];
        const songElements = document.querySelectorAll('.song-item');
        
        songElements.forEach(element => {
            const title = element.querySelector('.song-title').textContent;
            const artist = element.querySelector('.song-artist').textContent;
            const coverUrl = element.querySelector('img').src;
            const youtubeUrl = element.dataset.youtubeUrl || '';
            
            songs.push({
                title: title,
                artist: artist,
                cover_url: coverUrl,
                youtube_url: youtubeUrl
            });
        });
        
        // Get social links
        const socialLinks = [];
        const socialElements = document.querySelectorAll('.social-item');
        
        socialElements.forEach(element => {
            const platform = element.querySelector('.social-platform').textContent;
            const url = element.dataset.url || element.querySelector('.social-url').textContent;
            const displayName = element.querySelector('.social-url').textContent;
            
            socialLinks.push({
                platform: platform,
                url: url,
                display_name: displayName !== url ? displayName : null
            });
        });
        
        // Get advanced settings
        const customCss = document.getElementById('edit-custom-css').value;
        const customJs = document.getElementById('edit-custom-js').value;
        
        // Create page data object
        const pageData = {
            page_id: pageId,
            url: url,
            title: title,
            display_name: displayName || null,
            bio: bio || null,
            avatar_url: avatarUrl || null,
            avatar_animation: avatarAnimation,
            name_effect: nameEffect,
            bio_effect: bioEffect,
            background: {
                type: backgroundType,
                value: backgroundValue,
                opacity: backgroundOpacity
            },
            layout: {
                type: layoutType,
                container_style: {
                    enabled: containerEnabled,
                    background_color: containerBg,
                    opacity: containerOpacity,
                    border_radius: containerRadius,
                    shadow: containerShadow
                }
            },
            social_links: socialLinks,
            songs: songs,
            show_joined_date: showJoinedDate,
            show_views: showViews,
            custom_css: customCss || null,
            custom_js: customJs || null
        };
        
        return pageData;
    };
    
    // Save page changes
    const saveBtn = document.getElementById('save-btn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const pageId = document.getElementById('page-selector').value;
            
            if (!pageId) {
                showNotification('No page selected', 'error');
                return;
            }
            
            try {
                const pageData = await collectFormData(pageId);
                
                // Validate URL format
                if (!/^[a-zA-Z0-9_]+$/.test(pageData.url)) {
                    showNotification('URL can only contain letters, numbers, and underscores', 'error');
                    return;
                }
                
                // Check URL availability if changed
                const originalUrl = document.getElementById('edit-url').dataset.originalUrl;
                
                if (pageData.url !== originalUrl) {
                    const checkResponse = await fetch(`${API_URL}/check-url?url=${pageData.url}`);
                    const checkData = await checkResponse.json();
                    
                    if (!checkData.available) {
                        showNotification('URL is already taken', 'error');
                        return;
                    }
                }
                
                // Show loading state
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                
                // Send update request
                const response = await fetch(`${API_URL}/pages/${pageId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(pageData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update page');
                }
                
                const updatedPage = await response.json();
                
                // Reset URL data attribute
                document.getElementById('edit-url').dataset.originalUrl = updatedPage.url;
                
                // Update view page button URL
                document.getElementById('view-page-btn').href = `https://versz.fun/p/${updatedPage.url}`;
                
                // Show success notification
                showNotification('Page updated successfully!', 'success');
                
                // Reset save button
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                
                // Update preview
                updatePreview(updatedPage);
                
            } catch (error) {
                console.error('Error updating page:', error);
                showNotification(error.message || 'Failed to update page', 'error');
                // Reset save button
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const pageId = document.getElementById('page-selector').value;
            if (pageId) {
                // Reload page data
                loadPageData(pageId);
            }
        });
    }
    
    // Page selector change
    const pageSelector = document.getElementById('page-selector');
    
    if (pageSelector) {
        pageSelector.addEventListener('change', () => {
            const pageId = pageSelector.value;
            
            if (pageId) {
                loadPageData(pageId);
                
                // Update URL
                const url = new URL(window.location);
                url.searchParams.set('page_id', pageId);
                window.history.pushState({}, '', url);
            } else {
                // Hide editor and show empty state
                document.getElementById('no-page-selected').style.display = 'flex';
                document.getElementById('editor-container').style.display = 'none';
                document.getElementById('save-actions').style.display = 'none';
                document.getElementById('view-page-btn').style.display = 'none';
                
                // Clear URL parameter
                const url = new URL(window.location);
                url.searchParams.delete('page_id');
                window.history.pushState({}, '', url);
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
    const initCustomizePage = async () => {
        await loadUserData();
        await loadUserPages();
    };
    
    initCustomizePage();
});