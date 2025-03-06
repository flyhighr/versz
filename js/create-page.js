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
                    const avatarLoading = document.querySelector('.avatar-loading');
                    if (avatarLoading) {
                        avatarLoading.style.display = 'none';
                    }
                };
                avatarImg.onerror = function() {
                    avatarImg.src = 'img/default-avatar.png';
                    avatarImg.classList.add('loaded');
                    const avatarLoading = document.querySelector('.avatar-loading');
                    if (avatarLoading) {
                        avatarLoading.style.display = 'none';
                    }
                };
            } else {
                const avatarImg = document.getElementById('sidebar-avatar');
                avatarImg.src = 'img/default-avatar.png';
                avatarImg.classList.add('loaded');
                const avatarLoading = document.querySelector('.avatar-loading');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
            }
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load user data', 'error');
            return null;
        }
    };
    
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.option-tab');
    const tabContents = document.querySelectorAll('.option-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activate selected tab
            button.classList.add('active');
            document.getElementById(`${tabName}-content`).classList.add('active');
            
            // Load templates if template tab is selected
            if (tabName === 'template') {
                loadTemplates();
            }
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
            document.getElementById(`${bgType}-settings`).style.display = 'block';
        });
    });
    
    // URL availability check for blank page
    const checkUrlBtn = document.getElementById('check-url-btn');
    const urlInput = document.getElementById('page-url');
    const urlStatus = document.getElementById('url-status');
    
    if (checkUrlBtn && urlInput) {
        checkUrlBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            
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
        
        // Auto-check URL after typing stops
        let urlCheckTimeout;
        urlInput.addEventListener('input', () => {
            clearTimeout(urlCheckTimeout);
            
            // Clear status if input is empty
            if (!urlInput.value.trim()) {
                urlStatus.textContent = '';
                urlStatus.className = 'input-status';
                return;
            }
            
            urlCheckTimeout = setTimeout(() => {
                checkUrlBtn.click();
            }, 800);
        });
    }
    
    // Load templates with retry mechanism
    const loadTemplates = async (page = 1, category = '', retryCount = 0) => {
        const templatesGrid = document.getElementById('templates-grid');
        const paginationContainer = document.getElementById('template-pagination');
        
        // Show loading
        templatesGrid.innerHTML = `
            <div class="loading-templates">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading templates...</p>
            </div>
        `;
        
        try {
            let url = `${API_URL}/templates?page=${page}&limit=9`;
            if (category && category !== 'all') {
                url += `&category=${category}`;
            }
            
            // Add cache-busting parameter
            url += `&_t=${new Date().getTime()}`;
            
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`);
            }
            
            // Try to parse the JSON response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                throw new Error(`Failed to parse response: ${parseError.message}`);
            }
            
            // Determine if the response is an array or an object with templates property
            const templates = Array.isArray(data) ? data : (data.templates || []);
            const totalPages = data.total_pages || 1;
            const currentPage = data.current_page || 1;
            
            // Clear loading
            templatesGrid.innerHTML = '';
            
            if (templates.length === 0) {
                templatesGrid.innerHTML = `
                    <div class="empty-templates">
                        <i class="fas fa-search"></i>
                        <p>No templates found</p>
                    </div>
                `;
                return;
            }
            
            // Create template cards
            templates.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'template-card';
                templateCard.dataset.id = template.id;
                
                // Add category class if available
                if (template.tags && template.tags.length > 0) {
                    template.tags.forEach(tag => {
                        templateCard.classList.add(tag.toLowerCase());
                    });
                }
                
                templateCard.innerHTML = `
                    <div class="template-image">
                        <img src="${template.preview_image || 'img/template-placeholder.jpg'}" alt="${template.name}" onerror="this.src='img/template-placeholder.jpg'">
                        <div class="template-overlay">
                            <button class="btn btn-sm btn-primary preview-btn" data-id="${template.id}">Preview</button>
                        </div>
                    </div>
                    <div class="template-info">
                        <h3>${template.name || 'Untitled Template'}</h3>
                        <p>${template.description ? (template.description.substring(0, 60) + (template.description.length > 60 ? '...' : '')) : 'No description available'}</p>
                        <div class="template-meta">
                            <span><i class="fas fa-user"></i> ${template.created_by_username || 'User'}</span>
                            <span><i class="fas fa-download"></i> ${template.use_count || 0} uses</span>
                        </div>
                    </div>
                `;
                
                templatesGrid.appendChild(templateCard);
            });
            
            // Add event listeners to preview buttons
            document.querySelectorAll('.preview-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const templateId = button.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            
            // Template cards click for preview
            document.querySelectorAll('.template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const templateId = card.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            
            // Create pagination if needed
            if (totalPages > 1) {
                paginationContainer.innerHTML = '';
                
                const paginationDiv = document.createElement('div');
                paginationDiv.className = 'pagination';
                
                // Previous button
                if (currentPage > 1) {
                    const prevBtn = document.createElement('button');
                    prevBtn.className = 'pagination-btn';
                    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                    prevBtn.addEventListener('click', () => {
                        loadTemplates(currentPage - 1, category);
                    });
                    paginationDiv.appendChild(prevBtn);
                }
                
                // Page numbers
                const startPage = Math.max(1, currentPage - 2);
                const endPage = Math.min(totalPages, startPage + 4);
                
                for (let i = startPage; i <= endPage; i++) {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
                    pageBtn.textContent = i;
                    
                    pageBtn.addEventListener('click', () => {
                        if (i !== currentPage) {
                            loadTemplates(i, category);
                        }
                    });
                    
                    paginationDiv.appendChild(pageBtn);
                }
                
                // Next button
                if (currentPage < totalPages) {
                    const nextBtn = document.createElement('button');
                    nextBtn.className = 'pagination-btn';
                    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                    nextBtn.addEventListener('click', () => {
                        loadTemplates(currentPage + 1, category);
                    });
                    paginationDiv.appendChild(nextBtn);
                }
                
                paginationContainer.appendChild(paginationDiv);
            } else {
                paginationContainer.innerHTML = '';
            }
            
        } catch (error) {
            console.error('Error loading templates:', error);
            
            // Handle retry logic
            if (retryCount < 2) { // Try up to 3 times (initial + 2 retries)
                console.log(`Retrying template load (attempt ${retryCount + 1})...`);
                setTimeout(() => {
                    loadTemplates(page, category, retryCount + 1);
                }, 1000); // Wait 1 second before retrying
                return;
            }
            
            templatesGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load templates. <button id="retry-load-btn" class="btn btn-sm">Retry</button></p>
                </div>
            `;
            
            // Add retry button functionality
            const retryBtn = document.getElementById('retry-load-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    loadTemplates(page, category);
                });
            }
            
            showNotification('Failed to load templates. Please try again.', 'error');
        }
    };
    
    // Open template preview modal
    const openTemplatePreview = async (templateId) => {
        const modal = document.getElementById('template-preview-modal');
        const templateNameEl = document.getElementById('preview-template-name');
        const templateImageEl = document.getElementById('preview-template-image');
        const templateDescEl = document.getElementById('preview-template-description');
        const templateCreatorEl = document.getElementById('preview-template-creator');
        const templateUsesEl = document.getElementById('preview-template-uses');
        const templateDateEl = document.getElementById('preview-template-date');
        const templateTagsEl = document.getElementById('preview-template-tags');
        const templateFeaturesEl = document.getElementById('template-features-list');
        const templateIdInput = document.getElementById('template-id');
        const templatePageTitleInput = document.getElementById('template-page-title');
        
        // Show loading state
        templateNameEl.textContent = 'Loading...';
        templateImageEl.src = 'img/template-placeholder.jpg';
        templateDescEl.textContent = 'Loading template details...';
        templateCreatorEl.textContent = '';
        templateUsesEl.textContent = '';
        templateDateEl.textContent = '';
        templateTagsEl.innerHTML = '';
        templateFeaturesEl.innerHTML = '<li><i class="fas fa-spinner fa-spin"></i> Loading features...</li>';
        
        // Clear URL input and status
        const templateUrlInput = document.getElementById('template-page-url');
        const templateUrlStatus = document.getElementById('template-url-status');
        
        if (templateUrlInput && templateUrlStatus) {
            templateUrlInput.value = '';
            templateUrlStatus.textContent = '';
            templateUrlStatus.className = 'input-status';
        }
        
        // Show modal
        modal.classList.add('active');
        
        try {
            const response = await fetch(`${API_URL}/templates/${templateId}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch template details');
            }
            
            const template = await response.json();
            
            // Update modal with template details
            templateNameEl.textContent = template.name || 'Untitled Template';
            templateImageEl.src = template.preview_image || 'img/template-placeholder.jpg';
            templateImageEl.onerror = () => {
                templateImageEl.src = 'img/template-placeholder.jpg';
            };
            templateDescEl.textContent = template.description || 'No description available';
            templateCreatorEl.textContent = template.created_by_username || 'User';
            templateUsesEl.textContent = `${template.use_count || 0} uses`;
            
            // Format date
            if (template.created_at) {
                const createdDate = new Date(template.created_at);
                templateDateEl.textContent = `Created on ${createdDate.toLocaleDateString()}`;
            } else {
                templateDateEl.textContent = 'Recently added';
            }
            
            // Populate tags
            templateTagsEl.innerHTML = '';
            if (template.tags && template.tags.length > 0) {
                template.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'template-tag';
                    tagEl.textContent = tag;
                    templateTagsEl.appendChild(tagEl);
                });
            } else {
                templateTagsEl.innerHTML = '<span class="template-tag">No tags</span>';
            }
            
            // Populate features
            templateFeaturesEl.innerHTML = '';
            
            // Extract features from template configuration
            const features = [];
            
            if (template.page_config) {
                const config = template.page_config;
                
                if (config.social_links && config.social_links.length > 0) {
                    features.push('Pre-configured social links');
                }
                
                if (config.songs && config.songs.length > 0) {
                    features.push('Built-in music player');
                }
                
                if (config.name_effect && config.name_effect.name !== 'none') {
                    features.push(`Name text effect: ${config.name_effect.name}`);
                }
                
                if (config.bio_effect && config.bio_effect.name !== 'none') {
                    features.push(`Bio text effect: ${config.bio_effect.name}`);
                }
                
                if (config.background) {
                    features.push(`Custom ${config.background.type} background`);
                }
                
                if (config.name_style && config.name_style.font && config.name_style.font.name !== 'Default') {
                    features.push(`Custom font: ${config.name_style.font.name}`);
                }
                
                if (config.custom_css) {
                    features.push('Custom CSS styling');
                }
                
                if (config.custom_js) {
                    features.push('Custom JavaScript');
                }
            }
            
            // If no features were found, add a default one
            if (features.length === 0) {
                features.push('Standard layout and styling');
                features.push('Fully customizable design');
            }
            
            // Add features to list
            features.forEach(feature => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<i class="fas fa-check"></i> ${feature}`;
                templateFeaturesEl.appendChild(listItem);
            });
            
            // Set template ID for the form
            templateIdInput.value = template.id;
            
            // Set a suggested title
            if (templatePageTitleInput) {
                templatePageTitleInput.value = template.name || 'My Page';
            }
            
            // Set up preview button
            const previewBtn = document.getElementById('template-view-preview-btn');
            if (previewBtn) {
                previewBtn.onclick = () => {
                    window.open(`https://versz.fun/template?id=${template.id}`, '_blank');
                };
            }
            
        } catch (error) {
            console.error('Error loading template details:', error);
            
            // Show error in modal
            templateNameEl.textContent = 'Error Loading Template';
            templateDescEl.textContent = 'Failed to load template details. Please try again.';
            templateFeaturesEl.innerHTML = '<li><i class="fas fa-exclamation-circle"></i> Error loading features</li>';
            
            showNotification('Failed to load template details', 'error');
        }
    };
    
    // Template URL check
    const templateCheckUrlBtn = document.getElementById('template-check-url-btn');
    const templateUrlInput = document.getElementById('template-page-url');
    const templateUrlStatus = document.getElementById('template-url-status');
    
    if (templateCheckUrlBtn && templateUrlInput) {
        templateCheckUrlBtn.addEventListener('click', async () => {
            const url = templateUrlInput.value.trim();
            
            if (!url) {
                templateUrlStatus.textContent = 'Please enter a URL';
                templateUrlStatus.className = 'input-status error';
                return;
            }
            
            // Check if URL contains only alphanumeric characters and underscores
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                templateUrlStatus.textContent = 'URL can only contain letters, numbers, and underscores';
                templateUrlStatus.className = 'input-status error';
                return;
            }
            
            templateUrlStatus.textContent = 'Checking...';
            templateUrlStatus.className = 'input-status info';
            
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
                    templateUrlStatus.textContent = 'URL is available!';
                    templateUrlStatus.className = 'input-status success';
                } else {
                    templateUrlStatus.textContent = 'URL is already taken';
                    templateUrlStatus.className = 'input-status error';
                }
            } catch (error) {
                console.error('Error checking URL:', error);
                templateUrlStatus.textContent = 'Failed to check URL';
                templateUrlStatus.className = 'input-status error';
            }
        });
        
        // Auto-check URL after typing stops
        let templateUrlCheckTimeout;
        templateUrlInput.addEventListener('input', () => {
            clearTimeout(templateUrlCheckTimeout);
            
            // Clear status if input is empty
            if (!templateUrlInput.value.trim()) {
                templateUrlStatus.textContent = '';
                templateUrlStatus.className = 'input-status';
                return;
            }
            
            templateUrlCheckTimeout = setTimeout(() => {
                templateCheckUrlBtn.click();
            }, 800);
        });
    }
    
    // Create blank page form submission
    const createBlankForm = document.getElementById('create-blank-form');
    
    if (createBlankForm) {
        createBlankForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = createBlankForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Page...';
            
            const title = document.getElementById('page-title').value.trim();
            const url = document.getElementById('page-url').value.trim();
            const layoutType = document.getElementById('page-layout').value;
            
            // Get background settings based on selected type
            const activeBackgroundType = document.querySelector('.background-option.active').dataset.type;
            let backgroundValue = '';
            let backgroundType = activeBackgroundType;
            
            switch (activeBackgroundType) {
                case 'solid':
                    backgroundValue = document.getElementById('bg-color').value;
                    break;
                case 'gradient':
                    const gradientStart = document.getElementById('gradient-start').value;
                    const gradientEnd = document.getElementById('gradient-end').value;
                    const gradientDirection = document.getElementById('gradient-direction').value;
                    backgroundValue = `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`;
                    break;
                case 'image':
                    backgroundValue = document.getElementById('bg-image-url').value.trim();
                    break;
            }
            
            // Validate URL again
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                showNotification('URL can only contain letters, numbers, and underscores', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Page';
                return;
            }
            
            // Check URL availability
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!checkResponse.ok) {
                    throw new Error('Failed to check URL availability');
                }
                
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Page';
                    return;
                }
                
                // Prepare page data
                const pageData = {
                    title: title,
                    url: url,
                    background: {
                        type: backgroundType,
                        value: backgroundValue,
                        opacity: 1.0
                    },
                    layout: {
                        type: layoutType,
                        container_style: {
                            enabled: true,
                            background_color: "#ffffff",
                            opacity: 0.8,
                            border_radius: 10,
                            shadow: true
                        }
                    },
                    social_links: [],
                    songs: [],
                    show_joined_date: true,
                    show_views: true,
                    show_timezone: true
                };
                
                // Create the page
                const createResponse = await fetch(`${API_URL}/pages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(pageData)
                });
                
                if (!createResponse.ok) {
                    const errorData = await createResponse.json();
                    throw new Error(errorData.detail || 'Failed to create page');
                }
                
                const createdPage = await createResponse.json();
                
                // Show success message and redirect
                showNotification('Page created successfully!', 'success');
                
                setTimeout(() => {
                    window.location.href = `customize.html?page_id=${createdPage.page_id}`;
                }, 1500);
                
            } catch (error) {
                console.error('Error creating page:', error);
                showNotification(error.message || 'Failed to create page', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Page';
            }
        });
    }
    
    // Use template form submission
    const useTemplateForm = document.getElementById('use-template-form');

    if (useTemplateForm) {
        useTemplateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = useTemplateForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Page...';
            
            const templateId = document.getElementById('template-id').value;
            const title = document.getElementById('template-page-title').value.trim();
            const url = document.getElementById('template-page-url').value.trim();
            
            // Validate URL again
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                showNotification('URL can only contain letters, numbers, and underscores', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-magic"></i> Use This Template';
                return;
            }
            
            // Check URL availability
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!checkResponse.ok) {
                    throw new Error('Failed to check URL availability');
                }
                
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-magic"></i> Use This Template';
                    return;
                }
                
                // Use the template
                const useResponse = await fetch(`${API_URL}/use-template/${templateId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        url: url,
                        title: title 
                    })
                });
                
                if (!useResponse.ok) {
                    const errorData = await useResponse.json();
                    throw new Error(errorData.detail || 'Failed to use template');
                }
                
                const result = await useResponse.json();
                
                // Show success message and redirect
                showNotification('Template applied successfully!', 'success');
                
                // Close modal
                document.getElementById('template-preview-modal').classList.remove('active');
                
                setTimeout(() => {
                    window.location.href = `customize.html?page_id=${result.page_id}`;
                }, 1500);
                
            } catch (error) {
                console.error('Error using template:', error);
                showNotification(error.message || 'Failed to apply template', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-magic"></i> Use This Template';
            }
        });
    }
    
    // Template search functionality
    const searchTemplatesInput = document.getElementById('search-templates');
    const filterTemplatesSelect = document.getElementById('filter-templates');
    
    if (searchTemplatesInput) {
        let searchTimeout;
        
        searchTemplatesInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                const searchTerm = searchTemplatesInput.value.trim().toLowerCase();
                const category = filterTemplatesSelect.value;
                
                if (searchTerm.length > 0) {
                    // API search when we have a search term
                    searchTemplates(searchTerm, category);
                } else {
                    // Regular load when search is cleared
                    loadTemplates(1, category);
                }
            }, 500);
        });
    }
    
    // Search templates via API
    const searchTemplates = async (query, category = '') => {
        const templatesGrid = document.getElementById('templates-grid');
        const paginationContainer = document.getElementById('template-pagination');
        
        // Show loading
        templatesGrid.innerHTML = `
            <div class="loading-templates">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Searching templates...</p>
            </div>
        `;
        
        try {
            let url = `${API_URL}/search-templates?q=${encodeURIComponent(query)}`;
            
            if (category && category !== 'all') {
                url += `&category=${category}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to search templates');
            }
            
            const searchResults = await response.json();
            
            // Clear loading
            templatesGrid.innerHTML = '';
            
            // Hide pagination for search results
            paginationContainer.innerHTML = '';
            
            if (searchResults.length === 0) {
                templatesGrid.innerHTML = `
                    <div class="empty-templates">
                        <i class="fas fa-search"></i>
                        <p>No templates found matching "${query}"</p>
                    </div>
                `;
                return;
            }
            
            // Create template cards for search results
            searchResults.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'template-card';
                templateCard.dataset.id = template.id;
                
                templateCard.innerHTML = `
                    <div class="template-image">
                        <img src="${template.preview_image || 'img/template-placeholder.jpg'}" alt="${template.name}" onerror="this.src='img/template-placeholder.jpg'">
                        <div class="template-overlay">
                            <button class="btn btn-sm btn-primary preview-btn" data-id="${template.id}">Preview</button>
                        </div>
                    </div>
                    <div class="template-info">
                        <h3>${template.name || 'Untitled Template'}</h3>
                        <p>${template.description ? (template.description.substring(0, 60) + (template.description.length > 60 ? '...' : '')) : 'No description available'}</p>
                        <div class="template-meta">
                            <span><i class="fas fa-user"></i> ${template.created_by_username || 'User'}</span>
                            <span><i class="fas fa-download"></i> ${template.use_count || 0} uses</span>
                        </div>
                    </div>
                `;
                
                templatesGrid.appendChild(templateCard);
            });
            
            // Add event listeners to preview buttons
            document.querySelectorAll('.preview-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const templateId = button.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            
            // Template cards click for preview
            document.querySelectorAll('.template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const templateId = card.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            
        } catch (error) {
            console.error('Error searching templates:', error);
            templatesGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to search templates. Please try again.</p>
                </div>
            `;
            showNotification('Failed to search templates', 'error');
        }
    };
    
    if (filterTemplatesSelect) {
        filterTemplatesSelect.addEventListener('change', () => {
            const category = filterTemplatesSelect.value;
            const searchTerm = searchTemplatesInput.value.trim();
            
            if (searchTerm.length > 0) {
                // Search with the current term and new category
                searchTemplates(searchTerm, category);
            } else {
                // Just load templates with the new category
                loadTemplates(1, category);
            }
        });
    }
    
    // Close modal when clicking outside or on close button
    const templateModal = document.getElementById('template-preview-modal');
    if (templateModal) {
        templateModal.addEventListener('click', (e) => {
            if (e.target === templateModal) {
                templateModal.classList.remove('active');
            }
        });
        
        const closeBtn = templateModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                templateModal.classList.remove('active');
            });
        }
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
    const initCreatePage = async () => {
        try {
            // Load user data
            await loadUserData();
            
            // Check for URL parameters (for direct links)
            const urlParams = new URLSearchParams(window.location.search);
            
            if (urlParams.has('template')) {
                // If template ID is provided, switch to template tab and open preview
                const templateId = urlParams.get('template');
                document.querySelector('.option-tab[data-tab="template"]').click();
                
                // Wait a bit for templates to load
                setTimeout(() => {
                    openTemplatePreview(templateId);
                }, 500);
            }
        } catch (error) {
            console.error('Error initializing page:', error);
            showNotification('There was an error initializing the page. Please refresh.', 'error');
        }
    };
    
    initCreatePage();
});
