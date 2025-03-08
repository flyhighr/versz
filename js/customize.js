document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://api.versz.fun';
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // FIXED: Mobile menu toggle - completely rewritten
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    // Add CSS to ensure proper initial state for mobile
    if (window.innerWidth <= 992) {
        // On mobile, sidebar is initially hidden
        sidebar.style.transform = 'translateX(-100%)';
        sidebar.style.position = 'fixed';
        sidebar.style.top = '0';
        sidebar.style.left = '0';
        sidebar.style.height = '100%';
        sidebar.style.zIndex = '1000';
        sidebar.style.transition = 'transform 0.3s ease';
        sidebar.style.backgroundColor = 'var(--darker-bg)';
        sidebar.style.width = '80%';
        sidebar.style.maxWidth = '300px';
    }
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            // Toggle sidebar visibility
            if (sidebar.style.transform === 'translateX(0%)' || sidebar.classList.contains('active')) {
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.classList.remove('active');
            } else {
                sidebar.style.transform = 'translateX(0%)';
                sidebar.classList.add('active');
            }
        });
    }
    
    // Sidebar close button
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.style.transform = 'translateX(-100%)';
            sidebar.classList.remove('active');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 992 && 
            sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            e.target !== mobileMenuToggle && 
            !mobileMenuToggle.contains(e.target)) {
            sidebar.style.transform = 'translateX(-100%)';
            sidebar.classList.remove('active');
        }
    });
    
    // Adjust sidebar position on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 992) {
            // On desktop, reset sidebar styles
            sidebar.style.transform = '';
            sidebar.style.position = '';
            sidebar.style.top = '';
            sidebar.style.left = '';
            sidebar.style.height = '';
            sidebar.style.zIndex = '';
            sidebar.style.width = '';
            sidebar.style.maxWidth = '';
        } else {
            // On mobile, set sidebar styles if not already set
            if (sidebar.style.transform !== 'translateX(-100%)' && !sidebar.classList.contains('active')) {
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.style.position = 'fixed';
                sidebar.style.top = '0';
                sidebar.style.left = '0';
                sidebar.style.height = '100%';
                sidebar.style.zIndex = '1000';
                sidebar.style.backgroundColor = 'var(--darker-bg)';
                sidebar.style.width = '80%';
                sidebar.style.maxWidth = '300px';
                sidebar.style.transition = 'transform 0.3s ease';
            }
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
                const avatarImg = document.getElementById('sidebar-avatar');
                avatarImg.src = userData.avatar_url;
                avatarImg.onload = function() {
                    avatarImg.classList.add('loaded');
                };
                avatarImg.onerror = function() {
                    avatarImg.src = 'img/default-avatar.png';
                    avatarImg.classList.add('loaded');
                };
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
            } else {
                // Ensure the empty state is visible when no page is selected
                document.getElementById('no-page-selected').style.display = 'flex';
                document.getElementById('editor-container').style.display = 'none';
                document.getElementById('save-actions').style.display = 'none';
                document.getElementById('view-page-btn').style.display = 'none';
                document.getElementById('preview-page-btn').style.display = 'none';
            }
            
            return pages;
        } catch (error) {
            console.error('Error loading pages:', error);
            return [];
        }
    };
    
    // Load page data for editing
    const loadPageData = async (pageId) => {
        // Show loading state
        const loadingState = document.createElement('div');
        loadingState.className = 'loading-state';
        loadingState.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading page data...</p>
        `;
        
        // Apply some quick styles to the loading state
        loadingState.style.display = 'flex';
        loadingState.style.flexDirection = 'column';
        loadingState.style.alignItems = 'center';
        loadingState.style.justifyContent = 'center';
        loadingState.style.padding = '3rem';
        loadingState.style.backgroundColor = 'var(--light-bg)';
        loadingState.style.borderRadius = 'var(--card-radius)';
        loadingState.style.textAlign = 'center';
        
        // Replace current content with loading state
        const customizeContainer = document.getElementById('customize-container');
        const editorContainer = document.getElementById('editor-container');
        const noPageSelected = document.getElementById('no-page-selected');
        const saveActions = document.getElementById('save-actions');
        
        noPageSelected.style.display = 'none';
        editorContainer.style.display = 'none';
        saveActions.style.display = 'none';
        
        customizeContainer.insertBefore(loadingState, noPageSelected);
        
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
            
            // Remove loading state
            if (loadingState.parentNode) {
                loadingState.parentNode.removeChild(loadingState);
            }
            
            // Show editor and hide empty state
            noPageSelected.style.display = 'none';
            editorContainer.style.display = 'grid';
            saveActions.style.display = 'flex';
            
            // Show view page and preview buttons
            const viewPageBtn = document.getElementById('view-page-btn');
            const previewPageBtn = document.getElementById('preview-page-btn');
            
            viewPageBtn.style.display = 'inline-flex';
            viewPageBtn.href = `/${pageData.url}`;
            
            previewPageBtn.style.display = 'inline-flex';
            
            // Populate form fields
            populateFormFields(pageData);
            
            return pageData;
        } catch (error) {
            console.error('Error loading page data:', error);
            
            // Remove loading state
            if (loadingState.parentNode) {
                loadingState.parentNode.removeChild(loadingState);
            }
            
            // Show error message
            noPageSelected.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading page</h3>
                <p>There was a problem loading the page data. Please try again.</p>
            `;
            noPageSelected.style.display = 'flex';
            
            showNotification('Failed to load page data', 'error');
        }
    };
    
    const populateFormFields = (pageData) => {
        // Basics tab
        document.getElementById('edit-title').value = pageData.title;
        document.getElementById('edit-url').value = pageData.url;
        document.getElementById('edit-url').dataset.originalUrl = pageData.url;
        document.getElementById('edit-name').value = pageData.name || '';
        document.getElementById('edit-bio').value = pageData.bio || '';
        document.getElementById('edit-avatar-url').value = pageData.avatar_url || '';
        document.getElementById('edit-avatar-decoration').value = pageData.avatar_decoration || '';
        document.getElementById('edit-timezone').value = pageData.timezone || '';
        
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
        
        // Update avatar decoration preview
        const avatarDecorationPreview = document.getElementById('avatar-decoration-preview');
        if (pageData.avatar_decoration) {
            avatarDecorationPreview.src = pageData.avatar_decoration;
            avatarDecorationPreview.style.display = 'block';
            avatarDecorationPreview.onerror = () => {
                avatarDecorationPreview.style.display = 'none';
            };
        } else {
            avatarDecorationPreview.style.display = 'none';
        }
        
        // Appearance tab - layout is now only "standard"
        document.getElementById('edit-layout').value = "standard";
        
        // Set background type
        const backgroundType = pageData.background ? pageData.background.type : 'solid';
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
        if (pageData.background) {
            switch (backgroundType) {
                case 'solid':
                    document.getElementById('edit-bg-color').value = pageData.background.value || '#ffffff';
                    break;
                    
                case 'gradient':
                    // Parse gradient value (format: linear-gradient(direction, start, end))
                    const gradientMatch = pageData.background.value ? pageData.background.value.match(/linear-gradient\(([^,]+),\s*([^,]+),\s*([^)]+)\)/) : null;
                    if (gradientMatch) {
                        document.getElementById('edit-gradient-direction').value = gradientMatch[1].trim();
                        document.getElementById('edit-gradient-start').value = gradientMatch[2].trim();
                        document.getElementById('edit-gradient-end').value = gradientMatch[3].trim();
                    } else {
                        // Default values if no match
                        document.getElementById('edit-gradient-direction').value = 'to right';
                        document.getElementById('edit-gradient-start').value = '#4ecdc4';
                        document.getElementById('edit-gradient-end').value = '#556270';
                    }
                    break;
                    
                case 'image':
                    document.getElementById('edit-bg-image-url').value = pageData.background.value || '';
                    break;
            }
            
            // Set background opacity
            document.getElementById('edit-bg-opacity').value = pageData.background.opacity || 1;
            document.getElementById('opacity-value').textContent = (pageData.background.opacity || 1).toFixed(1);
        }
        
        // Container settings
        const containerEnabled = pageData.layout && pageData.layout.container_style ? pageData.layout.container_style.enabled !== false : true;
        document.getElementById('container-enabled').checked = containerEnabled;
        document.getElementById('container-settings').style.display = containerEnabled ? 'block' : 'none';
        
        if (pageData.layout && pageData.layout.container_style) {
            document.getElementById('edit-container-bg').value = pageData.layout.container_style.background_color || '#ffffff';
            document.getElementById('edit-container-opacity').value = pageData.layout.container_style.opacity || 0.8;
            document.getElementById('container-opacity-value').textContent = (pageData.layout.container_style.opacity || 0.8).toFixed(1);
            
            document.getElementById('edit-container-radius').value = pageData.layout.container_style.border_radius || 10;
            document.getElementById('radius-value').textContent = `${pageData.layout.container_style.border_radius || 10}px`;
            
            document.getElementById('container-shadow').checked = pageData.layout.container_style.shadow !== false;
        }
        
        // Text styling - new in this version
        if (pageData.name_style) {
            document.getElementById('edit-name-color').value = pageData.name_style.color || '#000000';
            if (pageData.name_style.font && pageData.name_style.font.name) {
                document.getElementById('edit-name-font').value = pageData.name_style.font.name;
            }
        }
        
        if (pageData.username_style) {
            document.getElementById('edit-username-color').value = pageData.username_style.color || '#555555';
            if (pageData.username_style.font && pageData.username_style.font.name) {
                document.getElementById('edit-username-font').value = pageData.username_style.font.name;
            }
        }
        
        // Content tab
        document.getElementById('edit-name-effect').value = pageData.name_effect?.name || 'none';
        document.getElementById('edit-bio-effect').value = pageData.bio_effect?.name || 'none';
        
        document.getElementById('show-joined-date').checked = pageData.show_joined_date !== false;
        document.getElementById('show-views').checked = pageData.show_views !== false;
        document.getElementById('show-timezone').checked = pageData.show_timezone !== false;
        
        // Messages, Drawings, and Analytics settings
        if (pageData.messages_config) {
            document.getElementById('enable-messages').checked = pageData.messages_config.enabled || false;
            document.getElementById('messages-settings').style.display = pageData.messages_config.enabled ? 'block' : 'none';
            document.getElementById('messages-require-approval').checked = pageData.messages_config.require_approval !== false;
            document.getElementById('messages-allow-anonymous').checked = pageData.messages_config.allow_anonymous !== false;
            document.getElementById('messages-placeholder').value = pageData.messages_config.placeholder_text || 'Leave a message...';
        } else {
            document.getElementById('enable-messages').checked = false;
            document.getElementById('messages-settings').style.display = 'none';
        }
    
        if (pageData.drawings_config) {
            document.getElementById('enable-drawings').checked = pageData.drawings_config.enabled || false;
            document.getElementById('drawings-settings').style.display = pageData.drawings_config.enabled ? 'block' : 'none';
            document.getElementById('drawings-require-approval').checked = pageData.drawings_config.require_approval !== false;
            document.getElementById('drawings-allow-anonymous').checked = pageData.drawings_config.allow_anonymous !== false;
        } else {
            document.getElementById('enable-drawings').checked = false;
            document.getElementById('drawings-settings').style.display = 'none';
        }
    
        if (pageData.analytics_config) {
            document.getElementById('enable-analytics').checked = pageData.analytics_config.enabled !== false;
            document.getElementById('analytics-settings').style.display = pageData.analytics_config.enabled !== false ? 'block' : 'none';
            document.getElementById('analytics-show-country').checked = pageData.analytics_config.show_country_data !== false;
            document.getElementById('analytics-show-time').checked = pageData.analytics_config.show_time_data !== false;
        } else {
            document.getElementById('enable-analytics').checked = true;
            document.getElementById('analytics-settings').style.display = 'block';
        }
        
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
    songElement.dataset.youtubeUrl = song.youtube_url;
    
    songElement.innerHTML = `
        <div class="song-cover">
            <img src="${song.cover_url}" alt="${song.title}" onerror="this.src='img/placeholder-music.png'">
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
    
    // Add event listener to remove button
    const removeBtn = songElement.querySelector('.remove-song');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            songElement.remove();
            
            // If no songs left, show empty message
            const songsContainer = document.getElementById('songs-container');
            if (songsContainer.children.length === 0) {
                songsContainer.innerHTML = `
                    <div class="empty-songs">
                        <p>No songs added yet</p>
                    </div>
                `;
            }
        });
    }
    
    return songElement;
};

// Create a social link element
const createSocialLinkElement = (link, index) => {
    const linkElement = document.createElement('div');
    linkElement.className = 'social-item';
    linkElement.dataset.index = index;
    linkElement.dataset.url = link.url;
    
    // Get platform icon
    let platformIcon = 'fa-link';
    switch (link.platform.toLowerCase()) {
        case 'instagram': platformIcon = 'fa-instagram'; break;
        case 'twitter': platformIcon = 'fa-twitter'; break;
        case 'facebook': platformIcon = 'fa-facebook-f'; break;
        case 'youtube': platformIcon = 'fa-youtube'; break;
        case 'tiktok': platformIcon = 'fa-tiktok'; break;
        case 'twitch': platformIcon = 'fa-twitch'; break;
        case 'linkedin': platformIcon = 'fa-linkedin-in'; break;
        case 'github': platformIcon = 'fa-github'; break;
        case 'discord': platformIcon = 'fa-discord'; break;
        case 'spotify': platformIcon = 'fa-spotify'; break;
        case 'snapchat': platformIcon = 'fa-snapchat'; break;
        case 'reddit': platformIcon = 'fa-reddit-alien'; break;
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
    
    // Add event listener to remove button
    const removeBtn = linkElement.querySelector('.remove-social');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            linkElement.remove();
            
            // If no links left, show empty message
            const socialLinksContainer = document.getElementById('social-links-container');
            if (socialLinksContainer.children.length === 0) {
                socialLinksContainer.innerHTML = `
                    <div class="empty-social">
                        <p>No social links added yet</p>
                    </div>
                `;
            }
        });
    }
    
    return linkElement;
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

// Fix URL checking functionality
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
            const response = await fetch(`${API_URL}/check-url?url=${url}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to check URL');
            }
            
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

// Avatar decoration preview
const decorationUrlInput = document.getElementById('edit-avatar-decoration');
const decorationPreviewImg = document.getElementById('avatar-decoration-preview');

if (decorationUrlInput && decorationPreviewImg) {
    decorationUrlInput.addEventListener('blur', () => {
        const url = decorationUrlInput.value.trim();
        if (url) {
            decorationPreviewImg.src = url;
            decorationPreviewImg.style.display = 'block';
            decorationPreviewImg.onerror = () => {
                decorationPreviewImg.style.display = 'none';
            };
        } else {
            decorationPreviewImg.style.display = 'none';
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

// Add these functions to load timezones and fonts
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

const loadFonts = async () => {
    try {
        const nameFontSelect = document.getElementById('edit-name-font');
        const usernameFontSelect = document.getElementById('edit-username-font');
        
        if (!nameFontSelect || !usernameFontSelect) return;
        
        const response = await fetch(`${API_URL}/fonts`);
        if (!response.ok) {
            console.error('Failed to load fonts');
            return;
        }
        
        const data = await response.json();
        const fonts = data.fonts;
        
        // Clear existing options except the first one
        while (nameFontSelect.options.length > 1) {
            nameFontSelect.remove(1);
        }
        
        while (usernameFontSelect.options.length > 1) {
            usernameFontSelect.remove(1);
        }
        
        // Add fonts to select dropdowns
        fonts.forEach(font => {
            const nameOption = document.createElement('option');
            nameOption.value = font.name;
            nameOption.textContent = font.name;
            nameFontSelect.appendChild(nameOption);
            
            const usernameOption = document.createElement('option');
            usernameOption.value = font.name;
            usernameOption.textContent = font.name;
            usernameFontSelect.appendChild(usernameOption);
        });
    } catch (error) {
        console.error('Error loading fonts:', error);
    }
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
        
        // Close modal
        document.getElementById('add-social-modal').classList.remove('active');
    });
}

const collectFormData = async (pageId) => {
    // Get basic info
    const title = document.getElementById('edit-title').value;
    const url = document.getElementById('edit-url').value;
    const name = document.getElementById('edit-name').value;
    const bio = document.getElementById('edit-bio').value;
    const avatarUrl = document.getElementById('edit-avatar-url').value;
    const avatarDecoration = document.getElementById('edit-avatar-decoration').value;
    const timezone = document.getElementById('edit-timezone').value;
    
    // Get layout and background
    const layoutType = "standard"; // Now fixed to "standard"
    
    // Get active background type
    const activeBackgroundOption = document.querySelector('.background-option.active');
    const backgroundType = activeBackgroundOption ? activeBackgroundOption.dataset.type : 'solid';
    
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
    
    // Get text styling - new in this version
    const nameColor = document.getElementById('edit-name-color').value;
    const nameFont = document.getElementById('edit-name-font').value;
    const usernameColor = document.getElementById('edit-username-color').value;
    const usernameFont = document.getElementById('edit-username-font').value;
    
    // Get font data for the selected fonts
    let nameFontValue = "";
    let nameFontLink = "";
    let usernameFontValue = "";
    let usernameFontLink = "";
    
    // Fetch font data from API to get the correct values and links
    try {
        const response = await fetch(`${API_URL}/fonts`);
        if (response.ok) {
            const data = await response.json();
            const fonts = data.fonts;
            
            // Find the selected name font
            const selectedNameFont = fonts.find(font => font.name === nameFont);
            if (selectedNameFont) {
                nameFontValue = selectedNameFont.value;
                nameFontLink = selectedNameFont.link;
            }
            
            // Find the selected username font
            const selectedUsernameFont = fonts.find(font => font.name === usernameFont);
            if (selectedUsernameFont) {
                usernameFontValue = selectedUsernameFont.value;
                usernameFontLink = selectedUsernameFont.link;
            }
        }
    } catch (error) {
        console.error('Error fetching font data:', error);
    }
    
    // Get content settings
    const nameEffect = document.getElementById('edit-name-effect').value;
    const bioEffect = document.getElementById('edit-bio-effect').value;
    const showJoinedDate = document.getElementById('show-joined-date').checked;
    const showViews = document.getElementById('show-views').checked;
    const showTimezone = document.getElementById('show-timezone').checked;
    
    // Get messages settings
    const messagesEnabled = document.getElementById('enable-messages').checked;
    const messagesRequireApproval = document.getElementById('messages-require-approval').checked;
    const messagesAllowAnonymous = document.getElementById('messages-allow-anonymous').checked;
    const messagesPlaceholder = document.getElementById('messages-placeholder').value;

    // Get drawings settings
    const drawingsEnabled = document.getElementById('enable-drawings').checked;
    const drawingsRequireApproval = document.getElementById('drawings-require-approval').checked;
    const drawingsAllowAnonymous = document.getElementById('drawings-allow-anonymous').checked;

    // Get analytics settings
    const analyticsEnabled = document.getElementById('enable-analytics').checked;
    const analyticsShowCountry = document.getElementById('analytics-show-country').checked;
    const analyticsShowTime = document.getElementById('analytics-show-time').checked;
    
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
        name: name || null,
        bio: bio || null,
        avatar_url: avatarUrl || null,
        avatar_decoration: avatarDecoration || null,
        timezone: timezone || null,
        name_style: {
            color: nameColor,
            font: {
                name: nameFont,
                value: nameFontValue,
                link: nameFontLink
            }
        },
        username_style: {
            color: usernameColor,
            font: {
                name: usernameFont,
                value: usernameFontValue,
                link: usernameFontLink
            }
        },
        name_effect: nameEffect !== 'none' ? { name: nameEffect } : null,
        bio_effect: bioEffect !== 'none' ? { name: bioEffect } : null,
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
        messages_config: {
            enabled: messagesEnabled,
            require_approval: messagesRequireApproval,
            allow_anonymous: messagesAllowAnonymous,
            placeholder_text: messagesPlaceholder || 'Leave a message...'
        },
        drawings_config: {
            enabled: drawingsEnabled,
            require_approval: drawingsRequireApproval,
            allow_anonymous: drawingsAllowAnonymous
        },
        analytics_config: {
            enabled: analyticsEnabled,
            show_country_data: analyticsShowCountry,
            show_time_data: analyticsShowTime
        },
        social_links: socialLinks,
        songs: songs,
        show_joined_date: showJoinedDate,
        show_views: showViews,
        show_timezone: showTimezone,
        custom_css: customCss || null,
        custom_js: customJs || null
    };
    
    return pageData;
};

// Create page preview
const createPagePreview = async (pageData) => {
    try {
        const response = await fetch(`${API_URL}/preview-page`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(pageData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create preview');
        }
        
        const previewData = await response.json();
        return previewData.preview_id;
        
    } catch (error) {
        console.error('Error creating preview:', error);
        showNotification('Failed to create preview', 'error');
        return null;
    }
};

// Preview button
const previewPageBtn = document.getElementById('preview-page-btn');

if (previewPageBtn) {
    previewPageBtn.addEventListener('click', async () => {
        const pageId = document.getElementById('page-selector').value;
        
        if (!pageId) {
            showNotification('No page selected', 'error');
            return;
        }
        
        try {
            // Show loading state
            previewPageBtn.disabled = true;
            previewPageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            
            // Collect form data
            const pageData = await collectFormData(pageId);
            
            // Create preview
            const previewId = await createPagePreview(pageData);
            
            if (previewId) {
                // Get the current URL for the page
                const pageUrl = document.getElementById('edit-url').value;
                
                // Open preview in new tab - using the page URL with preview parameter
                window.open(`/${pageUrl}?preview=${previewId}`, '_blank');
            } else {
                // Fallback - just open the current page
                const url = document.getElementById('edit-url').value;
                if (url) {
                    showNotification('Preview creation failed. Opening current page instead.', 'warning');
                    window.open(`/${url}`, '_blank');
                }
            }
            
            // Reset button
            previewPageBtn.disabled = false;
            previewPageBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
            
        } catch (error) {
            console.error('Error creating preview:', error);
            showNotification('Failed to create preview', 'error');
            
            // Reset button
            previewPageBtn.disabled = false;
            previewPageBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
        }
    });
}

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
            document.getElementById('view-page-btn').href = `/${updatedPage.url}`;
            
            // Show success notification
            showNotification('Page updated successfully!', 'success');
            
            // Reset save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            
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
            document.getElementById('preview-page-btn').style.display = 'none';
            
            // Clear URL parameter
            const url = new URL(window.location);
            url.searchParams.delete('page_id');
            window.history.pushState({}, '', url);
        }
    });
}

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


// Add loading state styling
const addLoadingStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem;
            background-color: var(--light-bg);
            border-radius: var(--card-radius);
            text-align: center;
            width: 100%;
            margin-bottom: 1.5rem;
        }
        
        .loading-spinner {
            margin-bottom: 1rem;
            color: var(--primary-color);
        }
        
        .loading-spinner i {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .loading-state p {
            color: var(--text-muted);
            font-size: 1rem;
        }
        
        /* Empty state styling enhancements */
        #no-page-selected {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem;
            background-color: var(--light-bg);
            border-radius: var(--card-radius);
            text-align: center;
            width: 100%;
            margin-bottom: 1.5rem;
        }
        
        #no-page-selected i {
            font-size: 3rem;
            color: var(--primary-color);
            margin-bottom: 1rem;
        }
        
        #no-page-selected h3 {
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
        }
        
        #no-page-selected p {
            color: var(--text-muted);
            max-width: 500px;
            margin: 0 auto;
        }
    `;
    document.head.appendChild(style);
};

// Initialize page
const initCustomizePage = async () => {
    // Add loading styles
    addLoadingStyles();
    
    // Show loading indicator while initializing
    const customizeContainer = document.getElementById('customize-container');
    const noPageSelected = document.getElementById('no-page-selected');
    
    const initialLoadingState = document.createElement('div');
    initialLoadingState.className = 'loading-state';
    initialLoadingState.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
        </div>
        <p>Loading customization options...</p>
    `;
    
    customizeContainer.insertBefore(initialLoadingState, noPageSelected);
    noPageSelected.style.display = 'none';
    
    try {
        await loadUserData();
        await loadFonts();
        await loadTimezones();
        await loadUserPages();
        
        // Load social platforms for the dropdown
        const response = await fetch(`${API_URL}/social-platforms`);
        if (response.ok) {
            const data = await response.json();
            const platformSelect = document.getElementById('social-platform');
            
            // Clear existing options except the first one
            while (platformSelect.options.length > 1) {
                platformSelect.remove(1);
            }
            
            // Add platforms to dropdown
            data.platforms.forEach(platform => {
                const option = document.createElement('option');
                option.value = platform.name;
                option.textContent = platform.name.charAt(0).toUpperCase() + platform.name.slice(1);
                platformSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error initializing customize page:', error);
        showNotification('Failed to load some customization options', 'warning');
    } finally {
        // Remove initial loading state
        if (initialLoadingState.parentNode) {
            initialLoadingState.parentNode.removeChild(initialLoadingState);
        }
        
        // Check if a page is selected in the dropdown
        const pageSelector = document.getElementById('page-selector');
        if (pageSelector && pageSelector.value) {
            // A page is selected, we'll let loadPageData handle the UI
        } else {
            // No page selected, show the empty state
            noPageSelected.style.display = 'flex';
        }
    }
    
    const enableMessages = document.getElementById('enable-messages');
    const messagesSettings = document.getElementById('messages-settings');
    if (enableMessages && messagesSettings) {
        enableMessages.addEventListener('change', () => {
            messagesSettings.style.display = enableMessages.checked ? 'block' : 'none';
        });
    }

    const enableDrawings = document.getElementById('enable-drawings');
    const drawingsSettings = document.getElementById('drawings-settings');
    if (enableDrawings && drawingsSettings) {
        enableDrawings.addEventListener('change', () => {
            drawingsSettings.style.display = enableDrawings.checked ? 'block' : 'none';
        });
    }

    const enableAnalytics = document.getElementById('enable-analytics');
    const analyticsSettings = document.getElementById('analytics-settings');
    if (enableAnalytics && analyticsSettings) {
        enableAnalytics.addEventListener('change', () => {
            analyticsSettings.style.display = enableAnalytics.checked ? 'block' : 'none';
        });
    }
};

// Call init function when DOM is loaded
initCustomizePage();
});
