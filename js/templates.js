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
    
    // Load templates
    const loadTemplates = async (page = 1, tag = '', sortBy = 'popular') => {
        const templatesGrid = document.getElementById('templates-grid');
        const paginationContainer = document.getElementById('templates-pagination');
        
        // Show loading
        templatesGrid.innerHTML = `
            <div class="loading-templates">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading templates...</p>
            </div>
        `;
        
        try {
            let url = `${API_URL}/templates?page=${page}&limit=12`;
            
            if (tag) {
                url += `&tag=${tag}`;
            }
            
            // Map UI sort options to API parameters
            let apiSortBy = 'use_count';
            let sortOrder = 'desc';
            
            switch (sortBy) {
                case 'popular':
                    apiSortBy = 'use_count';
                    sortOrder = 'desc';
                    break;
                case 'newest':
                    apiSortBy = 'created_at';
                    sortOrder = 'desc';
                    break;
                case 'oldest':
                    apiSortBy = 'created_at';
                    sortOrder = 'asc';
                    break;
            }
            
            url += `&sort_by=${apiSortBy}&sort_order=${sortOrder}`;
            
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
            
            // Add event listeners to template cards
            document.querySelectorAll('.template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const templateId = card.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            
            // Add event listeners to preview buttons
            document.querySelectorAll('.preview-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const templateId = button.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            
            // Create pagination if needed
            // For simplicity, we'll just show prev/next buttons
            paginationContainer.innerHTML = '';
            
            if (templates.length === 12) { // If we got a full page, there might be more
                const paginationDiv = document.createElement('div');
                paginationDiv.className = 'pagination';
                
                if (page > 1) {
                    const prevBtn = document.createElement('button');
                    prevBtn.className = 'pagination-btn';
                    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                    prevBtn.addEventListener('click', () => {
                        loadTemplates(page - 1, tag, sortBy);
                    });
                    paginationDiv.appendChild(prevBtn);
                }
                
                const pageIndicator = document.createElement('span');
                pageIndicator.className = 'pagination-text';
                pageIndicator.textContent = `Page ${page}`;
                paginationDiv.appendChild(pageIndicator);
                
                const nextBtn = document.createElement('button');
                nextBtn.className = 'pagination-btn';
                nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                nextBtn.addEventListener('click', () => {
                    loadTemplates(page + 1, tag, sortBy);
                });
                paginationDiv.appendChild(nextBtn);
                
                paginationContainer.appendChild(paginationDiv);
            }
            
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
        const templateDateEl = document.getElementById('preview-template-date');
        const templateTagsEl = document.getElementById('preview-template-tags');
        const templateIdInput = document.getElementById('template-id');
        
        // Show loading state
        templateNameEl.textContent = 'Loading...';
        templateImageEl.src = '';
        templateDescEl.textContent = '';
        templateCreatorEl.textContent = '';
        templateUsesEl.textContent = '';
        templateDateEl.textContent = '';
        templateTagsEl.innerHTML = '';
        
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
            
            // Format date
            const createdDate = new Date(template.created_at);
            const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
            templateDateEl.textContent = `Created on ${createdDate.toLocaleDateString('en-US', dateOptions)}`;
            
            // Add tags
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
    
    // Use template form submission
    const useTemplateForm = document.getElementById('use-template-form');
    
    if (useTemplateForm) {
        useTemplateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const templateId = document.getElementById('template-id').value;
            const url = document.getElementById('template-page-url').value;
            
            // Validate URL format
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                templateUrlStatus.textContent = 'URL can only contain letters, numbers, and underscores';
                templateUrlStatus.className = 'input-status error';
                return;
            }
            
            try {
                // Check URL availability
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    templateUrlStatus.textContent = 'URL is already taken';
                    templateUrlStatus.className = 'input-status error';
                    return;
                }
                
                // Use template
                const response = await fetch(`${API_URL}/use-template/${templateId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ url: url })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to use template');
                }
                
                const result = await response.json();
                
                // Show success notification and redirect
                showNotification('Page created from template!', 'success');
                
                setTimeout(() => {
                    window.location.href = `customize.html?page_id=${result.page_id}`;
                }, 1000);
                
            } catch (error) {
                console.error('Error using template:', error);
                showNotification(error.message || 'Failed to use template', 'error');
            }
        });
    }
    
    // Category filters
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Deactivate all buttons
            categoryBtns.forEach(b => b.classList.remove('active'));
            
            // Activate clicked button
            btn.classList.add('active');
            
            // Get filter value
            const category = btn.dataset.category;
            
            // Update dropdown to match
            const filterSelect = document.getElementById('filter-by-tag');
            if (filterSelect) {
                filterSelect.value = category;
            }
            
            // Load templates with filter
            loadTemplates(1, category, document.getElementById('sort-templates').value);
        });
    });
    
    // Search and filter
    const searchInput = document.getElementById('search-templates');
    const filterSelect = document.getElementById('filter-by-tag');
    const sortSelect = document.getElementById('sort-templates');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            const category = filterSelect.value;
            const sortBy = sortSelect.value;
            loadTemplates(1, category, sortBy);
        }, 500));
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            const category = filterSelect.value;
            const sortBy = sortSelect.value;
            
            // Update category buttons to match
            categoryBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === category);
            });
            
            loadTemplates(1, category, sortBy);
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const category = filterSelect.value;
            const sortBy = sortSelect.value;
            loadTemplates(1, category, sortBy);
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
    
    // Debounce function for search input
    function debounce(func, delay) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    // Initialize page
    const initTemplatesPage = async () => {
        await loadUserData();
        loadTemplates();
    };
    
    initTemplatesPage();
});