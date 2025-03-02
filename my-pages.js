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
                    // Token expired or invalid
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
    
    // Load all user pages
    const loadAllPages = async () => {
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
            return pages;
        } catch (error) {
            console.error('Error loading pages:', error);
            return [];
        }
    };
    
    // Get views for a page
    const getPageViews = async (url) => {
        try {
            const response = await fetch(`${API_URL}/views/${url}`);
            if (!response.ok) {
                return 0;
            }
            const data = await response.json();
            return data.views;
        } catch (error) {
            console.error(`Error fetching views for ${url}:`, error);
            return 0;
        }
    };
    
    // Render pages list
    const renderPages = async (pages, sortMethod = 'newest') => {
        const pagesList = document.getElementById('pages-list');
        const noPages = document.getElementById('no-pages-found');
        
        if (!pages || pages.length === 0) {
            pagesList.innerHTML = '';
            noPages.style.display = 'flex';
            return;
        }
        
        noPages.style.display = 'none';
        
        // Get views for all pages
        const pagesWithViews = await Promise.all(
            pages.map(async (page) => {
                const views = await getPageViews(page.url);
                return { ...page, views };
            })
        );
        
        // Sort pages based on selected method
        let sortedPages = [...pagesWithViews];
        
        switch (sortMethod) {
            case 'newest':
                sortedPages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'oldest':
                sortedPages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'views':
                sortedPages.sort((a, b) => b.views - a.views);
                break;
            case 'name':
                sortedPages.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }
        
        // Clear existing content
        pagesList.innerHTML = '';
        
        // Create page items
        sortedPages.forEach(page => {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';
            pageItem.dataset.pageId = page.page_id;
            
            const createdDate = new Date(page.created_at);
            const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
            
            pageItem.innerHTML = `
                <div class="page-info">
                    <div class="page-title">${page.title}</div>
                    <div class="page-url">versz.fun/${page.url}</div>
                    <div class="page-meta">
                        <span><i class="fas fa-eye"></i> ${page.views} views</span>
                        <span><i class="fas fa-calendar-alt"></i> ${createdDate.toLocaleDateString('en-US', dateOptions)}</span>
                        <span><i class="fas fa-layer-group"></i> ${page.layout.type}</span>
                    </div>
                </div>
                <div class="page-actions">
                    <button class="btn btn-sm action-btn" data-action="view" data-url="${page.url}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm action-btn" data-action="edit" data-page-id="${page.page_id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm action-btn" data-action="more" data-page-id="${page.page_id}" data-url="${page.url}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            `;
            
            pagesList.appendChild(pageItem);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', handlePageAction);
        });
    };
    
    // Handle page actions
    const handlePageAction = (e) => {
        const action = e.currentTarget.dataset.action;
        const pageId = e.currentTarget.dataset.pageId;
        const url = e.currentTarget.dataset.url;
        
        switch (action) {
            case 'view':
                window.open(`https://versz.fun/${url}`, '_blank');
                break;
            case 'edit':
                window.location.href = `customize.html?page_id=${pageId}`;
                break;
            case 'more':
                openPageActionsModal(pageId, url);
                break;
        }
    };
    
    // Open page actions modal
    const openPageActionsModal = (pageId, url) => {
        const modal = document.getElementById('page-actions-modal');
        const viewBtn = document.getElementById('view-page-btn');
        const editBtn = document.getElementById('edit-page-btn');
        const copyBtn = document.getElementById('copy-url-btn');
        const deleteBtn = document.getElementById('delete-page-btn');
        
        // Set up button actions
        viewBtn.href = `https://versz.fun/${url}`;
        editBtn.href = `customize.html?page_id=${pageId}`;
        
        // Set up copy URL action
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(`https://versz.fun/${url}`);
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy URL';
            }, 2000);
        });
        
        // Set up delete action
        deleteBtn.dataset.pageId = pageId;
        deleteBtn.addEventListener('click', () => {
            openDeleteConfirmModal(pageId);
            modal.classList.remove('active');
        });
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        document.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    };
    // Open delete confirmation modal
    const openDeleteConfirmModal = (pageId) => {
        const modal = document.getElementById('delete-confirm-modal');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const cancelBtn = document.getElementById('cancel-delete-btn');
        
        // Set up confirm button
        confirmBtn.dataset.pageId = pageId;
        confirmBtn.addEventListener('click', deletePage);
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        document.querySelector('#delete-confirm-modal .modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    };
    
    // Delete page function
    const deletePage = async (e) => {
        const pageId = e.currentTarget.dataset.pageId;
        const modal = document.getElementById('delete-confirm-modal');
        
        try {
            const response = await fetch(`${API_URL}/pages/${pageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete page');
            }
            
            // Close modal and refresh page list
            modal.classList.remove('active');
            
            // Show success message
            showNotification('Page deleted successfully', 'success');
            
            // Reload pages
            const pages = await loadAllPages();
            const sortMethod = document.getElementById('sort-pages').value;
            renderPages(pages, sortMethod);
        } catch (error) {
            console.error('Error deleting page:', error);
            showNotification('Failed to delete page', 'error');
        }
    };
    
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
    
    // Search pages functionality
    const searchPages = (query, pages) => {
        if (!query) return pages;
        
        query = query.toLowerCase();
        return pages.filter(page => 
            page.title.toLowerCase().includes(query) || 
            page.url.toLowerCase().includes(query)
        );
    };
    
    // Initialize page
    const initPagesPage = async () => {
        // Load user data
        await loadUserData();
        
        // Load all pages
        const pages = await loadAllPages();
        
        // Initial render
        renderPages(pages, 'newest');
        
        // Set up search functionality
        const searchInput = document.getElementById('search-pages');
        searchInput.addEventListener('input', async () => {
            const query = searchInput.value;
            const allPages = await loadAllPages();
            const filteredPages = searchPages(query, allPages);
            const sortMethod = document.getElementById('sort-pages').value;
            renderPages(filteredPages, sortMethod);
        });
        
        // Set up sort functionality
        const sortSelect = document.getElementById('sort-pages');
        sortSelect.addEventListener('change', async () => {
            const sortMethod = sortSelect.value;
            const query = searchInput.value;
            const allPages = await loadAllPages();
            const filteredPages = searchPages(query, allPages);
            renderPages(filteredPages, sortMethod);
        });
    };
    
    initPagesPage();
});