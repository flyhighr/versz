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
            if (tag) {
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
                
                templateCard.innerHTML = `
                    <div class="template-image">
                        <img src="${template.preview_image}" alt="${template.name}">
                        <div class="template-overlay">
                            <button class="btn btn-sm btn-primary preview-btn" data-id="${template.id}">Preview</button>
                        </div>
                    </div>
                    <div class="template-info">
                        <h3>${template.name}</h3>
                        <p>${template.description.substring(0, 60)}${template.description.length > 60 ? '...' : ''}</p>
                        <div class="template-meta">
                            <span><i class="fas fa-user"></i> ${template.created_by_username || 'User'}</span>
                            <span><i class="fas fa-download"></i> ${template.use_count} uses</span>
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
        templateImageEl.src = '';
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
            templateNameEl.textContent = template.name;
            templateImageEl.src = template.preview_image;
            templateDescEl.textContent = template.description;
            templateCreatorEl.textContent = template.created_by_username || 'User';
            templateUsesEl.textContent = `${template.use_count} uses`;
            
            // Set template ID for the form
            templateIdInput.value = template.id;
            
            // Show modal
            modal.classList.add('active');
            
            // Close modal when clicking outside or on close button
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
            
            document.querySelector('#template-preview-modal .modal-close').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            
        } catch (error) {
            console.error('Error loading template details:', error);
            // Show error in modal
            templateNameEl.textContent = 'Error';
            templateDescEl.textContent = 'Failed to load template details. Please try again.';
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
                return;
            }
            
            // Check URL availability
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
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
                    throw new Error('Failed to create page');
                }
                
                const createdPage = await createResponse.json();
                
                // Show success message and redirect
                showNotification('Page created successfully!', 'success');
                
                setTimeout(() => {
                    window.location.href = `customize.html?page_id=${createdPage.page_id}`;
                }, 1500);
                
            } catch (error) {
                console.error('Error creating page:', error);
                showNotification('Failed to create page', 'error');
            }
        });
    }
    
    // Use template form submission
    const useTemplateForm = document.getElementById('use-template-form');
    
    if (useTemplateForm) {
        useTemplateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const templateId = document.getElementById('template-id').value;
            const url = document.getElementById('template-page-url').value.trim();
            
            // Validate URL again
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                showNotification('URL can only contain letters, numbers, and underscores', 'error');
                return;
            }
            
            // Check URL availability
            try {
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    return;
                }
                
                // Use the template
                const useResponse = await fetch(`${API_URL}/use-template/${templateId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ url: url })
                });
                
                if (!useResponse.ok) {
                    throw new Error('Failed to use template');
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
                showNotification('Failed to apply template', 'error');
            }
        });
    }
    
    // Template search functionality
    const searchTemplatesInput = document.getElementById('search-templates');
    const filterTemplatesSelect = document.getElementById('filter-templates');
    
    if (searchTemplatesInput) {
        searchTemplatesInput.addEventListener('input', () => {
            const searchTerm = searchTemplatesInput.value.trim().toLowerCase();
            const category = filterTemplatesSelect.value;
            
            // Filter template cards
            document.querySelectorAll('.template-card').forEach(card => {
                const title = card.querySelector('h3').textContent.toLowerCase();
                const description = card.querySelector('p').textContent.toLowerCase();
                
                // Check if card matches search term
                const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
                
                // Check if card matches category filter
                const matchesCategory = category === 'all' || card.classList.contains(category);
                
                // Show/hide card
                if (matchesSearch && matchesCategory) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
    
    if (filterTemplatesSelect) {
        filterTemplatesSelect.addEventListener('change', () => {
            const searchTerm = searchTemplatesInput.value.trim().toLowerCase();
            const category = filterTemplatesSelect.value;
            
            // Reload templates with category filter
            loadTemplates(1, category);
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
    const initCreatePage = async () => {
        // Load user data
        await loadUserData();
    };
    
    initCreatePage();
});