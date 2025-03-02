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
                            <div class="template-actions">
                                <button class="btn btn-sm btn-primary preview-btn" data-id="${template.id}">Preview</button>
                                <button class="btn btn-sm btn-outline use-btn" data-id="${template.id}">Use</button>
                            </div>
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
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.template-actions')) {
                        const templateId = card.dataset.id;
                        openTemplateModal(templateId);
                    }
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
            
            // Add event listeners to use buttons
            document.querySelectorAll('.use-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const templateId = button.dataset.id;
                    openTemplateModal(templateId);
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
                    <p>Failed to load templates. Please try again later.</p>
                </div>
            `;
        }
    };
    
    // Open template preview in a new tab
    const openTemplatePreview = (templateId) => {
        window.open(`/?template=${templateId}`, '_blank');
    };
    
    // Open template modal with details
    const openTemplateModal = async (templateId) => {
        const modal = document.getElementById('template-preview-modal');
        
        try {
            // Fetch template details
            const response = await fetch(`${API_URL}/templates/${templateId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch template details');
            }
            
            const template = await response.json();
            
            // Populate modal with template details
            document.getElementById('preview-template-name').textContent = template.name;
            document.getElementById('preview-template-image').src = template.preview_image;
            document.getElementById('preview-template-description').textContent = template.description;
            document.getElementById('preview-template-creator').textContent = template.created_by_username || 'User';
            document.getElementById('preview-template-uses').textContent = `${template.use_count} uses`;
            
            // Format date
            const createdDate = new Date(template.created_at);
            document.getElementById('preview-template-date').textContent = `Created on ${createdDate.toLocaleDateString()}`;
            
            // Populate tags
            const tagsContainer = document.getElementById('preview-template-tags');
            tagsContainer.innerHTML = '';
            
            if (template.tags && template.tags.length > 0) {
                template.tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'template-tag';
                    tagElement.textContent = tag;
                    tagsContainer.appendChild(tagElement);
                });
            } else {
                tagsContainer.innerHTML = '<span class="no-tags">No tags</span>';
            }
            
            // Set template ID for use form
            document.getElementById('template-id').value = template.id;
            
            // Set up preview button
            document.getElementById('template-view-preview-btn').addEventListener('click', () => {
                openTemplatePreview(template.id);
            });
            
            // Show modal
            modal.classList.add('active');
            
            // Check if template ID is in URL (for direct linking)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('use') && urlParams.get('use') === templateId) {
                // Focus on URL input
                document.getElementById('template-page-url').focus();
            }
            
        } catch (error) {
            console.error('Error fetching template details:', error);
            showNotification('Failed to load template details', 'error');
        }
    };
    
    // URL availability check
    const checkUrlBtn = document.getElementById('template-check-url-btn');
    const urlInput = document.getElementById('template-page-url');
    const urlStatus = document.getElementById('template-url-status');
    
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
    
    // Handle use template form submission
    const useTemplateForm = document.getElementById('use-template-form');
    
    if (useTemplateForm) {
        useTemplateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const templateId = document.getElementById('template-id').value;
            const url = document.getElementById('template-page-url').value.trim();
            
            if (!url) {
                showNotification('Please enter a URL', 'error');
                return;
            }
            
            // Check if URL contains only alphanumeric characters and underscores
            if (!/^[a-zA-Z0-9_]+$/.test(url)) {
                showNotification('URL can only contain letters, numbers, and underscores', 'error');
                return;
            }
            
            try {
                // Check URL availability
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`);
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    return;
                }
                
                // Submit the form
                const submitBtn = useTemplateForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Page...';
                
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
                    throw new Error(errorData.detail || 'Failed to create page from template');
                }
                
                const data = await response.json();
                
                // Show success notification
                showNotification('Page created successfully!', 'success');
                
                // Close modal
                document.getElementById('template-preview-modal').classList.remove('active');
                
                // Redirect to new page or customize page
                setTimeout(() => {
                    window.location.href = `customize.html?page_id=${data.page_id}`;
                }, 1000);
                
            } catch (error) {
                console.error('Error using template:', error);
                showNotification(error.message || 'Failed to create page from template', 'error');
                
                // Reset submit button
                const submitBtn = useTemplateForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Use This Template';
            }
        });
    }
    
    // Filter templates by category
    const categoryButtons = document.querySelectorAll('.category-btn');
    
    if (categoryButtons.length > 0) {
        categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Get category tag
                const tag = button.dataset.category;
                
                // Update filter dropdown
                document.getElementById('filter-by-tag').value = tag;
                
                // Load templates with filter
                loadTemplates(1, tag, document.getElementById('sort-templates').value);
            });
        });
    }
    
    // Filter and sort dropdowns
    const filterByTag = document.getElementById('filter-by-tag');
    const sortTemplates = document.getElementById('sort-templates');
    
    if (filterByTag) {
        filterByTag.addEventListener('change', () => {
            const tag = filterByTag.value;
            const sortBy = sortTemplates.value;
            
            // Update category buttons
            categoryButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === tag);
            });
            
            loadTemplates(1, tag, sortBy);
        });
    }
    
    if (sortTemplates) {
        sortTemplates.addEventListener('change', () => {
            const tag = filterByTag.value;
            const sortBy = sortTemplates.value;
            
            loadTemplates(1, tag, sortBy);
        });
    }
    
    // Search templates
    const searchInput = document.getElementById('search-templates');
    
    if (searchInput) {
        let searchTimeout;
        
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                const searchTerm = searchInput.value.trim().toLowerCase();
                
                // For simplicity, we'll just filter the currently displayed templates
                // In a real app, you might want to send the search term to the server
                const templateCards = document.querySelectorAll('.template-card');
                
                templateCards.forEach(card => {
                    const templateName = card.querySelector('h3').textContent.toLowerCase();
                    const templateDesc = card.querySelector('p').textContent.toLowerCase();
                    
                    const matches = templateName.includes(searchTerm) || templateDesc.includes(searchTerm);
                    
                    card.style.display = matches ? 'block' : 'none';
                });
                
                // Show message if no results
                const templatesGrid = document.getElementById('templates-grid');
                const visibleCards = document.querySelectorAll('.template-card[style="display: block"]');
                
                if (searchTerm && visibleCards.length === 0) {
                    // Check if there's already a no-results message
                    if (!document.querySelector('.no-results')) {
                        const noResults = document.createElement('div');
                        noResults.className = 'no-results';
                        noResults.innerHTML = `<p>No templates found matching "${searchTerm}"</p>`;
                        templatesGrid.appendChild(noResults);
                    }
                } else {
                    // Remove no-results message if it exists
                    const noResults = document.querySelector('.no-results');
                    if (noResults) {
                        noResults.remove();
                    }
                }
            }, 300);
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
    const initTemplatesPage = async () => {
        await loadUserData();
        
        // Check if template ID is in URL (for direct linking)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('use')) {
            openTemplateModal(urlParams.get('use'));
        }
        
        // Load templates
        loadTemplates();
    };
    
    initTemplatesPage();
});