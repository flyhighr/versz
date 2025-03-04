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
                document.getElementById('sidebar-avatar').src = userData.avatar_url;
            }
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load user data', 'error');
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
    
    // URL availability check
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
    
    // Load templates
    const loadTemplates = async (page = 1, tag = '') => {
        const templatesGrid = document.getElementById('templates-grid');
        
        // Show loading
        templatesGrid.innerHTML = `
            <div class="loading-templates">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading templates...</p>
            </div>
        `;
        
        try {
            let url = `${API_URL}/templates?page=${page}&limit=9`;
            if (tag && tag !== 'all') {
                url += `&tag=${tag}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch templates');
            }
            
            const templates = await response.json();
            
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
            
        } catch (error) {
            console.error('Error loading templates:', error);
            templatesGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load templates. Please try again.</p>
                </div>
            `;
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
        const templateIdInput = document.getElementById('template-id');
        
        // Show loading state
        templateNameEl.textContent = 'Loading...';
        templateImageEl.src = 'img/template-placeholder.jpg';
        templateDescEl.textContent = '';
        templateCreatorEl.textContent = '';
        templateUsesEl.textContent = '';
        
        try {
            const response = await fetch(`${API_URL}/templates/${templateId}`);
            
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
            
            // Set template ID for the form
            templateIdInput.value = template.id;
            
            // Show modal
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Error loading template details:', error);
            // Show error in modal
            templateNameEl.textContent = 'Error';
            templateDescEl.textContent = 'Failed to load template details. Please try again.';
            modal.classList.add('active');
        }
    };
    
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
                const response = await fetch(`${API_URL}/check-url?url=${url}`);
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
                submitBtn.innerHTML = 'Create Page';
                return;
            }
            
            // Check URL availability
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Create Page';
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
                    show_views: true
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
                submitBtn.innerHTML = 'Create Page';
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
            const url = document.getElementById('template-page-url').value.trim();
            
            // Validate URL again
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                showNotification('URL can only contain letters, numbers, and underscores', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Use This Template';
                return;
            }
            
            // Check URL availability
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Use This Template';
                    return;
                }
                
                // Use the template - send JSON data as expected by the updated backend
                const useResponse = await fetch(`${API_URL}/use-template/${templateId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ url: url })
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
                submitBtn.innerHTML = 'Use This Template';
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
                
                // Filter template cards
                document.querySelectorAll('.template-card').forEach(card => {
                    const title = card.querySelector('h3').textContent.toLowerCase();
                    const description = card.querySelector('p').textContent.toLowerCase();
                    
                    // Check if card matches search term
                    const matchesSearch = searchTerm === '' || 
                                         title.includes(searchTerm) || 
                                         description.includes(searchTerm);
                    
                    // Check if card matches category filter
                    const matchesCategory = category === 'all' || card.classList.contains(category);
                    
                    // Show/hide card
                    card.style.display = (matchesSearch && matchesCategory) ? 'block' : 'none';
                });
                
                // Check if no results
                const visibleCards = document.querySelectorAll('.template-card[style="display: block"]');
                const templatesGrid = document.getElementById('templates-grid');
                
                if (visibleCards.length === 0) {
                    // If no empty state exists, add it
                    if (!document.querySelector('.empty-templates')) {
                        const emptyState = document.createElement('div');
                        emptyState.className = 'empty-templates';
                        emptyState.innerHTML = `
                            <i class="fas fa-search"></i>
                            <p>No templates found matching "${searchTerm}"</p>
                        `;
                        templatesGrid.appendChild(emptyState);
                    }
                } else {
                    // Remove empty state if it exists
                    const emptyState = document.querySelector('.empty-templates');
                    if (emptyState) {
                        emptyState.remove();
                    }
                }
            }, 300);
        });
    }
    
    if (filterTemplatesSelect) {
        filterTemplatesSelect.addEventListener('change', () => {
            const category = filterTemplatesSelect.value;
            
            // Reload templates with category filter if we're changing category
            if (category !== 'all') {
                loadTemplates(1, category);
            } else {
                // Just reload all templates
                loadTemplates(1);
            }
            
            // Clear search input
            if (searchTemplatesInput) {
                searchTemplatesInput.value = '';
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
    const initCreatePage = async () => {
        // Load user data
        await loadUserData();
        
        // Add a default gradient icon if Font Awesome doesn't have one
        const gradientIcons = document.querySelectorAll('.bg-icon .fa-gradient');
        if (gradientIcons.length > 0) {
            gradientIcons.forEach(icon => {
                const parent = icon.parentNode;
                parent.innerHTML = '<div style="background: linear-gradient(to right, #4ecdc4, #556270); width: 20px; height: 20px; border-radius: 3px;"></div>';
            });
        }
    };
    
    initCreatePage();
});