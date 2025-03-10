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
    
    // Add CSS to ensure proper initial state
    if (window.innerWidth <= 992) {
        // On mobile, sidebar is initially hidden
        sidebar.style.transform = 'translateX(-100%)';
        sidebar.style.position = 'fixed';
        sidebar.style.top = '0';
        sidebar.style.left = '0';
        sidebar.style.height = '100%';
        sidebar.style.zIndex = '1000';
        sidebar.style.transition = 'transform 0.3s ease';
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
        } else {
            // On mobile, set sidebar styles if not already set
            if (!sidebar.style.position) {
                sidebar.style.transform = 'translateX(-100%)';
                sidebar.style.position = 'fixed';
                sidebar.style.top = '0';
                sidebar.style.left = '0';
                sidebar.style.height = '100%';
                sidebar.style.zIndex = '1000';
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
            showNotification('Error loading user data. Please refresh the page.', 'error');
        }
    };
    
    // NEW: Function to get user's pages for the apply template dropdown
    const getUserPages = async () => {
        try {
            const response = await fetch(`${API_URL}/pages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user pages');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching user pages:', error);
            showNotification('Failed to load your pages', 'error');
            return [];
        }
    };
    
    // NEW: Function to apply template to an existing page
    const applyTemplateToPage = async (templateId, pageId) => {
        try {
            const response = await fetch(`${API_URL}/apply-template/${pageId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    template_id: templateId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to apply template to page');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error applying template:', error);
            throw error;
        }
    };
    
    // Load template categories
    const loadCategories = async () => {
        try {
            // Since the /template-categories endpoint doesn't exist, use hardcoded categories
            const categories = [
                { slug: "personal", name: "Personal" },
                { slug: "business", name: "Business" },
                { slug: "creative", name: "Creative" },
                { slug: "portfolio", name: "Portfolio" },
                { slug: "social", name: "Social" }
            ];
            
            // Populate filter dropdown
            const filterByTag = document.getElementById('filter-by-tag');
            filterByTag.innerHTML = '<option value="">All Categories</option>';
            
            // Populate category buttons
            const categoriesContainer = document.getElementById('templates-categories');
            // Keep the "All" button
            categoriesContainer.innerHTML = '<button class="category-btn active" data-category="">All</button>';
            
            categories.forEach(category => {
                // Add to dropdown
                const option = document.createElement('option');
                option.value = category.slug;
                option.textContent = category.name;
                filterByTag.appendChild(option);
                
                // Add as button
                const button = document.createElement('button');
                button.className = 'category-btn';
                button.dataset.category = category.slug;
                button.textContent = category.name;
                categoriesContainer.appendChild(button);
            });
            
            // Add event listeners to category buttons
            document.querySelectorAll('.category-btn').forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons
                    document.querySelectorAll('.category-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Add active class to clicked button
                    button.classList.add('active');
                    
                    // Get category and update filter
                    const category = button.dataset.category;
                    filterByTag.value = category;
                    
                    // Load templates with this filter
                    loadTemplates(1, category, document.getElementById('sort-templates').value);
                });
            });
            
            return categories;
        } catch (error) {
            console.error('Error loading categories:', error);
            showNotification('Error loading categories. Please refresh the page.', 'error');
            return [];
        }
    };
    
    // Load templates with improved error handling - FIXED: better error handling and retry logic
    const loadTemplates = async (page = 1, category = '', sortBy = 'popular', retryCount = 0) => {
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
            
            if (category) {
                url += `&category=${category}`;
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
            
            // Add cache-busting parameter to prevent browser caching
            url += `&_t=${new Date().getTime()}`;
            
            // FIXED: Add timeout to fetch request to avoid hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
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
                        <p>No templates found</p>
                    </div>
                `;
                paginationContainer.innerHTML = '';
                return;
            }
            
            // Create template cards
            templates.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'template-card';
                templateCard.dataset.id = template.id;
                
                const tags = template.tags && template.tags.length > 0 
                    ? template.tags.slice(0, 3).map(tag => `<span class="template-tag-mini">${tag}</span>`).join('') 
                    : '';
                
                templateCard.innerHTML = `
                    <div class="template-image">
                        <img src="${template.preview_image || 'img/template-placeholder.jpg'}" alt="${template.name}" onerror="this.src='img/template-placeholder.jpg'">
                        <div class="template-overlay">
                            <div class="template-actions">
                                <button class="btn btn-sm btn-primary preview-btn" data-id="${template.id}">Preview</button>
                                <button class="btn btn-sm btn-outline use-btn" data-id="${template.id}">Use</button>
                            </div>
                        </div>
                    </div>
                    <div class="template-info">
                        <h3>${template.name}</h3>
                        <p>${template.description ? (template.description.substring(0, 60) + (template.description.length > 60 ? '...' : '')) : 'No description available'}</p>
                        <div class="template-meta">
                            <span><i class="fas fa-user"></i> ${template.created_by_username || 'User'}</span>
                            <span><i class="fas fa-download"></i> ${template.use_count || 0} uses</span>
                        </div>
                        <div class="template-tags-mini">
                            ${tags}
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
            
            document.querySelectorAll('.preview-btn').forEach(button => {
                // Remove existing event listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                // Add new event listener
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const templateId = newButton.dataset.id;
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
            
            // Create pagination
            paginationContainer.innerHTML = '';
            
            if (totalPages > 1) {
                const paginationDiv = document.createElement('div');
                paginationDiv.className = 'pagination';
                
                // Previous button
                if (currentPage > 1) {
                    const prevBtn = document.createElement('button');
                    prevBtn.className = 'pagination-btn';
                    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                    prevBtn.addEventListener('click', () => {
                        loadTemplates(currentPage - 1, category, sortBy);
                        
                        // Scroll to top of templates grid
                        templatesGrid.scrollIntoView({ behavior: 'smooth' });
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
                            loadTemplates(i, category, sortBy);
                            
                            // Scroll to top of templates grid
                            templatesGrid.scrollIntoView({ behavior: 'smooth' });
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
                        loadTemplates(currentPage + 1, category, sortBy);
                        
                        // Scroll to top of templates grid
                        templatesGrid.scrollIntoView({ behavior: 'smooth' });
                    });
                    paginationDiv.appendChild(nextBtn);
                }
                
                paginationContainer.appendChild(paginationDiv);
            }
            
        } catch (error) {
            console.error('Error loading templates:', error);
            
            // Handle retry logic
            if (retryCount < 2) { // Try up to 3 times (initial + 2 retries)
                console.log(`Retrying template load (attempt ${retryCount + 1})...`);
                
                // Show retrying message
                templatesGrid.innerHTML = `
                    <div class="loading-templates">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Retrying... (${retryCount + 1}/2)</p>
                    </div>
                `;
                
                setTimeout(() => {
                    loadTemplates(page, category, sortBy, retryCount + 1);
                }, 1500); // Wait 1.5 seconds before retrying
                return;
            }
            
            templatesGrid.innerHTML = `
                <div class="error-message">
                    <p>Failed to load templates. <button id="retry-load-btn" class="btn btn-sm">Retry</button></p>
                </div>
            `;
            
            // Add retry button functionality
            const retryBtn = document.getElementById('retry-load-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    loadTemplates(page, category, sortBy);
                });
            }
            
            // Clear pagination
            paginationContainer.innerHTML = '';
            
            // Show notification
            showNotification('Failed to load templates. Please try again.', 'error');
        }
    };
    
    // Open template preview in a new tab
    const openTemplatePreview = (templateId) => {
        window.open(`https://versz.fun/template?id=${templateId}`, '_blank');
    };
    
    // UPDATED: Open template modal with details - now includes apply to existing page functionality
    const openTemplateModal = async (templateId) => {
        const modal = document.getElementById('template-preview-modal');
        
        try {
            // Show loading state in modal
            document.getElementById('preview-template-name').textContent = 'Loading...';
            document.getElementById('preview-template-image').src = 'img/template-placeholder.jpg';
            document.getElementById('preview-template-description').textContent = 'Loading template details...';
            document.getElementById('preview-template-creator').textContent = '';
            document.getElementById('preview-template-uses').textContent = '';
            document.getElementById('preview-template-date').textContent = '';
            document.getElementById('preview-template-tags').innerHTML = '';
            document.getElementById('template-features-list').innerHTML = '<li><i class="fas fa-spinner fa-spin"></i> Loading features...</li>';
            
            // Clear any previous URL check status
            const urlStatus = document.getElementById('template-url-status');
            if (urlStatus) {
                urlStatus.textContent = '';
                urlStatus.className = 'input-status';
            }
            
            // Reset URL input field
            const urlInput = document.getElementById('template-page-url');
            if (urlInput) {
                urlInput.value = '';
            }
            
            // Show modal immediately with loading state
            modal.classList.add('active');
            
            // FIXED: Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            // Fetch template details
            const response = await fetch(`${API_URL}/templates/${templateId}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Failed to fetch template details');
            }
            
            const template = await response.json();
            
            // Populate modal with template details
            document.getElementById('preview-template-name').textContent = template.name;
            document.getElementById('preview-template-image').src = template.preview_image || 'img/template-placeholder.jpg';
            document.getElementById('preview-template-description').textContent = template.description || 'No description available';
            document.getElementById('preview-template-creator').textContent = template.created_by_username || 'User';
            document.getElementById('preview-template-uses').textContent = `${template.use_count || 0} uses`;
            
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
            
            // Populate features
            const featuresList = document.getElementById('template-features-list');
            featuresList.innerHTML = '';
            
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
                
                if (config.timezone) {
                    features.push(`Default timezone: ${config.timezone}`);
                }
            }
            
            // If no features were found, add a default one
            if (features.length === 0) {
                features.push('Standard layout and styling');
            }
            
            // Add features to list
            features.forEach(feature => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<i class="fas fa-check"></i> ${feature}`;
                featuresList.appendChild(listItem);
            });
            
            // Set template ID for use form
            document.getElementById('template-id').value = template.id;
            
            document.querySelectorAll('.preview-btn').forEach(button => {
                // Remove existing event listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                // Add new event listener
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const templateId = newButton.dataset.id;
                    openTemplatePreview(templateId);
                });
            });
            // NEW: Fetch user's pages for the apply to existing page dropdown
            const userPages = await getUserPages();
            const existingPagesDropdown = document.getElementById('existing-pages-dropdown');
            
            if (existingPagesDropdown) {
                existingPagesDropdown.innerHTML = '<option value="">Select an existing page</option>';
                
                if (userPages && userPages.length > 0) {
                    userPages.forEach(page => {
                        const option = document.createElement('option');
                        option.value = page.page_id;
                        option.textContent = `${page.title} (/${page.url})`;
                        existingPagesDropdown.appendChild(option);
                    });
                    
                    // Show the apply to existing page section
                    const applyToExistingSection = document.getElementById('apply-to-existing-page');
                    if (applyToExistingSection) {
                        applyToExistingSection.style.display = 'block';
                    }
                } else {
                    // Hide the apply to existing page section if no pages
                    const applyToExistingSection = document.getElementById('apply-to-existing-page');
                    if (applyToExistingSection) {
                        applyToExistingSection.style.display = 'none';
                    }
                }
            }
            
        } catch (error) {
            console.error('Error fetching template details:', error);
            
            // Update modal with error message
            document.getElementById('preview-template-name').textContent = 'Error Loading Template';
            document.getElementById('preview-template-description').textContent = 'Failed to load template details. Please try again later.';
            document.getElementById('template-features-list').innerHTML = '<li><i class="fas fa-exclamation-circle"></i> Error loading features</li>';
            
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
        
        // Also check URL when input changes after typing stops
        let urlCheckTimeout;
        urlInput.addEventListener('input', () => {
            clearTimeout(urlCheckTimeout);
            
            // Reset status if input is empty
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
                const checkResponse = await fetch(`${API_URL}/check-url?url=${url}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const checkData = await checkResponse.json();
                
                if (!checkData.available) {
                    showNotification('URL is already taken', 'error');
                    return;
                }
                
                // Submit the form
                const submitBtn = useTemplateForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Page...';
                
                // The backend expects a request body with template_id and url
                const response = await fetch(`${API_URL}/use-template/${templateId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        template_id: templateId,
                        url: url
                    })
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
                
                // Redirect to customize page
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
    
    // NEW: Handle apply to existing page button click
    const applyToExistingBtn = document.getElementById('apply-to-existing-btn');
    
    if (applyToExistingBtn) {
        applyToExistingBtn.addEventListener('click', async () => {
            const templateId = document.getElementById('template-id').value;
            const pageId = document.getElementById('existing-pages-dropdown').value;
            
            if (!pageId) {
                showNotification('Please select a page', 'error');
                return;
            }
            
            // Show loading state
            applyToExistingBtn.disabled = true;
            applyToExistingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
            
            try {
                const result = await applyTemplateToPage(templateId, pageId);
                
                // Show success notification
                showNotification('Template applied successfully!', 'success');
                
                // Close modal
                document.getElementById('template-preview-modal').classList.remove('active');
                
                // Redirect to customize page
                setTimeout(() => {
                    window.location.href = `customize.html?page_id=${pageId}`;
                }, 1000);
                
            } catch (error) {
                console.error('Error applying template:', error);
                showNotification(error.message || 'Failed to apply template to page', 'error');
                
                // Reset button
                applyToExistingBtn.disabled = false;
                applyToExistingBtn.innerHTML = 'Apply to This Page';
            }
        });
    }
    
    // Filter and sort dropdowns
    const filterByTag = document.getElementById('filter-by-tag');
    const sortTemplates = document.getElementById('sort-templates');
    
    if (filterByTag) {
        filterByTag.addEventListener('change', () => {
            const category = filterByTag.value;
            const sortBy = sortTemplates.value;
            
            // Update category buttons
            document.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === category);
            });
            
            loadTemplates(1, category, sortBy);
        });
    }
    
    if (sortTemplates) {
        sortTemplates.addEventListener('change', () => {
            const category = filterByTag.value;
            const sortBy = sortTemplates.value;
            
            loadTemplates(1, category, sortBy);
        });
    }
    
    // Search templates
    const searchInput = document.getElementById('search-templates');

    if (searchInput) {
        let searchTimeout;
        
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(async () => {
                const searchTerm = searchInput.value.trim();
                
                if (searchTerm.length < 2) {
                    // If search is cleared, reload all templates
                    if (searchTerm.length === 0) {
                        const category = filterByTag.value;
                        const sortBy = sortTemplates.value;
                        loadTemplates(1, category, sortBy);
                    }
                    return;
                }
                
                // Show loading
                const templatesGrid = document.getElementById('templates-grid');
                templatesGrid.innerHTML = `
                    <div class="loading-templates">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Searching templates...</p>
                    </div>
                `;
                
                try {
                    // API call to search templates
                    const response = await fetch(`${API_URL}/search-templates?q=${encodeURIComponent(searchTerm)}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to search templates');
                    }
                    
                    const data = await response.json();
                    
                    // FIXED: Get templates from the templates property of the response
                    const searchResults = data.templates || [];
                    
                    // Clear loading
                    templatesGrid.innerHTML = '';
                    
                    if (searchResults.length === 0) {
                        templatesGrid.innerHTML = `
                            <div class="no-results">
                                <p>No templates found matching "${searchTerm}"</p>
                            </div>
                        `;
                        return;
                    }
                    
                    // Create template cards for search results
                    searchResults.forEach(template => {
                        const templateCard = document.createElement('div');
                        templateCard.className = 'template-card';
                        templateCard.dataset.id = template.id;
                        
                        const tags = template.tags && template.tags.length > 0 
                            ? template.tags.slice(0, 3).map(tag => `<span class="template-tag-mini">${tag}</span>`).join('') 
                            : '';
                        
                        templateCard.innerHTML = `
                            <div class="template-image">
                                <img src="${template.preview_image || 'img/template-placeholder.jpg'}" alt="${template.name}" onerror="this.src='img/template-placeholder.jpg'">
                                <div class="template-overlay">
                                    <div class="template-actions">
                                        <button class="btn btn-sm btn-primary preview-btn" data-id="${template.id}">Preview</button>
                                        <button class="btn btn-sm btn-outline use-btn" data-id="${template.id}">Use</button>
                                    </div>
                                </div>
                            </div>
                            <div class="template-info">
                                <h3>${template.name}</h3>
                                <p>${template.description ? (template.description.substring(0, 60) + (template.description.length > 60 ? '...' : '')) : 'No description available'}</p>
                                <div class="template-meta">
                                    <span><i class="fas fa-user"></i> ${template.created_by_username || 'User'}</span>
                                    <span><i class="fas fa-download"></i> ${template.use_count || 0} uses</span>
                                </div>
                                <div class="template-tags-mini">
                                    ${tags}
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
                    
                    document.querySelectorAll('.preview-btn').forEach(button => {
                        // Remove existing event listeners
                        const newButton = button.cloneNode(true);
                        button.parentNode.replaceChild(newButton, button);
                        
                        // Add new event listener
                        newButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const templateId = newButton.dataset.id;
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
                    
                    // ADDED: Show pagination if provided by the backend
                    if (data.total_pages && data.total_pages > 1) {
                        const paginationContainer = document.getElementById('templates-pagination');
                        const paginationDiv = document.createElement('div');
                        paginationDiv.className = 'pagination';
                        
                        // Previous button
                        if (data.page > 1) {
                            const prevBtn = document.createElement('button');
                            prevBtn.className = 'pagination-btn';
                            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                            prevBtn.addEventListener('click', async () => {
                                try {
                                    // Search with previous page
                                    const prevResponse = await fetch(`${API_URL}/search-templates?q=${encodeURIComponent(searchTerm)}&page=${data.page - 1}`, {
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });
                                    
                                    if (!prevResponse.ok) {
                                        throw new Error('Failed to search templates');
                                    }
                                    
                                    // Refresh the search with updated page
                                    searchInput.dispatchEvent(new Event('input'));
                                } catch (error) {
                                    console.error('Error changing page:', error);
                                    showNotification('Failed to load next page of results', 'error');
                                }
                            });
                            paginationDiv.appendChild(prevBtn);
                        }
                        
                        // Page numbers
                        const startPage = Math.max(1, data.page - 2);
                        const endPage = Math.min(data.total_pages, startPage + 4);
                        
                        for (let i = startPage; i <= endPage; i++) {
                            const pageBtn = document.createElement('button');
                            pageBtn.className = `pagination-btn ${i === data.page ? 'active' : ''}`;
                            pageBtn.textContent = i;
                            
                            pageBtn.addEventListener('click', async () => {
                                if (i !== data.page) {
                                    try {
                                        // Search with the selected page
                                        const pageResponse = await fetch(`${API_URL}/search-templates?q=${encodeURIComponent(searchTerm)}&page=${i}`, {
                                            headers: {
                                                'Authorization': `Bearer ${token}`
                                            }
                                        });
                                        
                                        if (!pageResponse.ok) {
                                            throw new Error('Failed to search templates');
                                        }
                                        
                                        // Refresh the search with updated page
                                        searchInput.dispatchEvent(new Event('input'));
                                    } catch (error) {
                                        console.error('Error changing page:', error);
                                        showNotification('Failed to load page of results', 'error');
                                    }
                                }
                            });
                            
                            paginationDiv.appendChild(pageBtn);
                        }
                        
                        // Next button
                        if (data.page < data.total_pages) {
                            const nextBtn = document.createElement('button');
                            nextBtn.className = 'pagination-btn';
                            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                            nextBtn.addEventListener('click', async () => {
                                try {
                                    // Search with next page
                                    const nextResponse = await fetch(`${API_URL}/search-templates?q=${encodeURIComponent(searchTerm)}&page=${data.page + 1}`, {
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });
                                    
                                    if (!nextResponse.ok) {
                                        throw new Error('Failed to search templates');
                                    }
                                    
                                    // Refresh the search with updated page
                                    searchInput.dispatchEvent(new Event('input'));
                                } catch (error) {
                                    console.error('Error changing page:', error);
                                    showNotification('Failed to load next page of results', 'error');
                                }
                            });
                            paginationDiv.appendChild(nextBtn);
                        }
                        
                        paginationContainer.innerHTML = '';
                        paginationContainer.appendChild(paginationDiv);
                    } else {
                        // Clear pagination if not needed
                        document.getElementById('templates-pagination').innerHTML = '';
                    }
                    
                } catch (error) {
                    console.error('Error searching templates:', error);
                    templatesGrid.innerHTML = `
                        <div class="error-message">
                            <p>Failed to search templates. Please try again later.</p>
                        </div>
                    `;
                }
            }, 500);
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
    const initTemplatesPage = async () => {
        try {
            await loadUserData();
            await loadCategories();
            
            // Check if template ID is in URL (for direct linking)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('use')) {
                openTemplateModal(urlParams.get('use'));
            }
            
            // Load templates with retries
            await loadTemplates();
        } catch (error) {
            console.error('Error initializing templates page:', error);
            showNotification('There was an error loading the page. Please refresh.', 'error');
        }
    };

    // Start the initialization
    initTemplatesPage();
});
