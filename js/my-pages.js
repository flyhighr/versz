document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    let allPages = [];
    let cachedViews = {};
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.add('show');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.remove('show');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Close sidebar when clicking overlay
    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('show');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show confirmation notification
            showNotification({
                title: 'Logging out',
                message: 'You are being logged out...',
                type: 'info',
                duration: 2000
            });
            
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }, 1000);
        });
    }
    
    // Load user data for sidebar
    const loadUserData = async () => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    showNotification({
                        title: 'Session Expired',
                        message: 'Your session has expired. Please log in again.',
                        type: 'error'
                    });
                    
                    setTimeout(() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = 'login.html';
                    }, 2000);
                    return;
                }
                throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            
            // Update sidebar user info
            const usernameElement = document.getElementById('sidebar-username');
            const emailElement = document.getElementById('sidebar-email');
            const avatarElement = document.getElementById('sidebar-avatar');
            
            // Clear loading states
            usernameElement.innerHTML = userData.username || 'User';
            emailElement.innerHTML = userData.email;
            
            if (userData.avatar_url) {
                avatarElement.onload = function() {
                    this.classList.add('loaded');
                    avatarElement.parentElement.querySelector('.avatar-loading').style.display = 'none';
                };
                avatarElement.src = userData.avatar_url;
            } else {
                avatarElement.classList.add('loaded');
                avatarElement.parentElement.querySelector('.avatar-loading').style.display = 'none';
            }
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification({
                title: 'Error',
                message: 'Failed to load user data. Please refresh the page.',
                type: 'error'
            });
        }
    };
    
    // Load all user pages
    const loadAllPages = async () => {
        try {
            const response = await fetch(`${API_URL}/pages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch pages');
            }
            
            const pages = await response.json();
            allPages = pages; // Store globally
            return pages;
        } catch (error) {
            console.error('Error loading pages:', error);
            showNotification({
                title: 'Error Loading Pages',
                message: 'Failed to load your pages. Please try again.',
                type: 'error'
            });
            return [];
        }
    };
    
    // Get views for a page with caching
    const getPageViews = async (url) => {
        // Check if we have cached views for this URL
        if (cachedViews[url] !== undefined) {
            return cachedViews[url];
        }
        
        try {
            const response = await fetch(`${API_URL}/views/${url}`);
            if (!response.ok) {
                return 0;
            }
            const data = await response.json();
            // Cache the result
            cachedViews[url] = data.views || 0;
            return data.views || 0;
        } catch (error) {
            console.error(`Error fetching views for ${url}:`, error);
            return 0;
        }
    };
    
    // Batch fetch views for multiple pages
    const batchFetchViews = async (pages) => {
        // Create an array of promises
        const viewPromises = pages.map(page => {
            if (cachedViews[page.url] !== undefined) {
                return Promise.resolve({ url: page.url, views: cachedViews[page.url] });
            }
            
            return fetch(`${API_URL}/views/${page.url}`)
                .then(response => response.ok ? response.json() : { views: 0 })
                .then(data => {
                    cachedViews[page.url] = data.views || 0;
                    return { url: page.url, views: data.views || 0 };
                })
                .catch(() => ({ url: page.url, views: 0 }));
        });
        
        // Execute all promises concurrently
        const results = await Promise.all(viewPromises);
        
        // Convert results array to object for easy lookup
        const viewsMap = {};
        results.forEach(result => {
            viewsMap[result.url] = result.views;
        });
        
        return viewsMap;
    };
    
    // Generate random thumbnail color
    const getRandomColor = (seed) => {
        // Create a simple hash from the string
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Convert to hex color
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 80%)`;
    };
    
    // Generate thumbnail for a page
    const generateThumbnail = (page) => {
        const bgColor = getRandomColor(page.url || page.page_id);
        const letter = (page.title || 'U')[0].toUpperCase();
        
        return `
            <div class="page-thumbnail" style="background-color: ${bgColor};">
                <div class="thumbnail-text">${letter}</div>
                <div class="thumbnail-overlay"></div>
            </div>
        `;
    };
    
    // Format numbers for display (e.g., 1000 -> 1K)
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num;
    };
    
    // Render pages list
    const renderPages = async (pages, sortMethod = 'views') => {
        const pagesList = document.getElementById('pages-list');
        const noPages = document.getElementById('no-pages-found');
        
        if (!pages || pages.length === 0) {
            pagesList.innerHTML = '';
            noPages.style.display = 'flex';
            return;
        }
        
        noPages.style.display = 'none';
        
        // Batch fetch views for all pages
        const viewsMap = await batchFetchViews(pages);
        
        // Add views to pages
        const pagesWithViews = pages.map(page => ({
            ...page,
            views: viewsMap[page.url] || 0
        }));
        
        // Sort pages based on selected method
        let sortedPages = [...pagesWithViews];
        
        switch (sortMethod) {
            case 'views':
                sortedPages.sort((a, b) => (b.views || 0) - (a.views || 0));
                break;
            case 'name':
                sortedPages.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
        }
        
        // Clear existing content
        pagesList.innerHTML = '';
        
        // Create page items
        sortedPages.forEach(page => {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-card';
            pageItem.dataset.pageId = page.page_id;
            pageItem.dataset.pageUrl = page.url;
            pageItem.dataset.pageTitle = page.title || 'Untitled Page';
            
            // Format date with proper error handling
            let formattedDate = 'No date';
            try {
                if (page.created_at) {
                    const createdDate = new Date(page.created_at);
                    if (!isNaN(createdDate.getTime())) { // Check if date is valid
                        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
                        formattedDate = createdDate.toLocaleDateString('en-US', dateOptions);
                    }
                }
            } catch (e) {
                console.error('Error formatting date:', e);
            }
            
            // Generate a color thumbnail if no image is available
            const thumbnail = generateThumbnail(page);
            
            // Format layout type
            const layoutType = page.layout?.type || 'standard';
            const formattedLayoutType = layoutType.charAt(0).toUpperCase() + layoutType.slice(1);
            
            pageItem.innerHTML = `
                ${thumbnail}
                <div class="page-content">
                    <div class="page-title">${page.title || 'Untitled Page'}</div>
                    <div class="page-url">versz.fun/${page.url}</div>
                    <div class="page-meta">
                        <span><i class="fas fa-eye"></i> ${formatNumber(page.views || 0)} views</span>
                        <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                        <span><i class="fas fa-layer-group"></i> ${formattedLayoutType}</span>
                    </div>
                </div>
                <div class="page-actions">
                    <button class="action-btn" data-action="view" data-url="${page.url}" title="View Page">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" data-action="edit" data-page-id="${page.page_id}" title="Edit Page">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" data-action="more" data-page-id="${page.page_id}" data-url="${page.url}" title="More Options">
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
        
        // Add event listener for page items to open edit page
        document.querySelectorAll('.page-card').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    const pageId = item.dataset.pageId;
                    window.location.href = `customize.html?page_id=${pageId}`;
                }
            });
        });
    };
    
    // Handle page actions
    const handlePageAction = (e) => {
        e.stopPropagation(); // Prevent event bubbling
        
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
        const qrCodeBtn = document.getElementById('qr-code-btn');
        const deleteBtn = document.getElementById('delete-page-btn');
        
        // Find the page title
        const pageCard = document.querySelector(`.page-card[data-page-id="${pageId}"]`);
        const pageTitle = pageCard ? pageCard.dataset.pageTitle : 'Page';
        
        // Update modal info
        document.getElementById('modal-page-title').textContent = pageTitle;
        document.getElementById('modal-page-url').textContent = `versz.fun/${url}`;
        
        // Clean up previous event listeners
        const newViewBtn = viewBtn.cloneNode(true);
        const newEditBtn = editBtn.cloneNode(true);
        const newCopyBtn = copyBtn.cloneNode(true);
        const newQrCodeBtn = qrCodeBtn.cloneNode(true);
        const newDeleteBtn = deleteBtn.cloneNode(true);
        
        viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        qrCodeBtn.parentNode.replaceChild(newQrCodeBtn, qrCodeBtn);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        // Set up button actions
        newViewBtn.href = `https://versz.fun/${url}`;
        newViewBtn.target = "_blank";
        newEditBtn.href = `customize.html?page_id=${pageId}`;
        
        // Set up copy URL action
        newCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(`https://versz.fun/${url}`).then(() => {
                newCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                showNotification({
                    title: 'URL Copied',
                    message: `The URL has been copied to your clipboard.`,
                    type: 'success',
                    duration: 2000
                });
                
                setTimeout(() => {
                    newCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy URL';
                }, 2000);
            }).catch(err => {
                showNotification({
                    title: 'Copy Failed',
                    message: 'Could not copy the URL to clipboard.',
                    type: 'error'
                });
            });
        });
        
        // Set up QR code action
        newQrCodeBtn.addEventListener('click', () => {
            openQrCodeModal(url);
            modal.classList.remove('active');
        });
        
        // Set up delete action
        newDeleteBtn.dataset.pageId = pageId;
        newDeleteBtn.addEventListener('click', () => {
            openDeleteConfirmModal(pageId);
            modal.classList.remove('active');
        });
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        const handleModalClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                modal.removeEventListener('click', handleModalClick);
            }
        };
        
        modal.addEventListener('click', handleModalClick);
        
        const closeBtn = modal.querySelector('.modal-close');
        const handleCloseClick = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', handleCloseClick);
        };
        
        closeBtn.addEventListener('click', handleCloseClick);
    };
    
    // Open QR code modal
    const openQrCodeModal = (url) => {
        const modal = document.getElementById('qr-code-modal');
        const qrContainer = document.getElementById('qr-code-container');
        const qrUrl = document.getElementById('qr-code-url');
        const downloadBtn = document.getElementById('download-qr-btn');
        
        // Clear previous QR code but keep loading indicator
        qrContainer.innerHTML = '<div class="qr-loading"><i class="fas fa-spinner fa-spin"></i></div>';
        
        // Set URL text
        qrUrl.textContent = `versz.fun/${url}`;
        
        // Show modal immediately with loading indicator
        modal.classList.add('active');
        
        // Generate QR code
        QRCode.toCanvas(
            document.createElement('canvas'),
            `https://versz.fun/${url}`,
            {
                width: 200,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            },
            function(error, canvas) {
                // Remove loading indicator
                const loadingEl = qrContainer.querySelector('.qr-loading');
                if (loadingEl) loadingEl.remove();
                
                if (error) {
                    console.error('Error generating QR code:', error);
                    qrContainer.innerHTML = `
                        <div class="qr-error">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Failed to generate QR code</p>
                        </div>
                    `;
                    
                    showNotification({
                        title: 'QR Code Error',
                        message: 'Failed to generate QR code for your page.',
                        type: 'error'
                    });
                    return;
                }
                
                qrContainer.appendChild(canvas);
                
                // Set up download button
                downloadBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.download = `versz-${url}-qrcode.png`;
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    showNotification({
                        title: 'QR Code Downloaded',
                        message: 'Your QR code has been downloaded successfully.',
                        type: 'success',
                        duration: 2000
                    });
                };
            }
        );
        
        // Close modal when clicking outside or on close button
        const handleModalClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                modal.removeEventListener('click', handleModalClick);
            }
        };
        
        modal.addEventListener('click', handleModalClick);
        
        const closeBtn = modal.querySelector('.modal-close');
        const handleCloseClick = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', handleCloseClick);
        };
        
        closeBtn.addEventListener('click', handleCloseClick);
    };
    
    // Open delete confirmation modal
    const openDeleteConfirmModal = (pageId) => {
        const modal = document.getElementById('delete-confirm-modal');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const cancelBtn = document.getElementById('cancel-delete-btn');
        
        // Clean up previous event listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // Set up confirm button
        newConfirmBtn.dataset.pageId = pageId;
        newConfirmBtn.addEventListener('click', deletePage);
        
        // Set up cancel button
        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        const handleModalClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                modal.removeEventListener('click', handleModalClick);
            }
        };
        
        modal.addEventListener('click', handleModalClick);
        
        const closeBtn = modal.querySelector('.modal-close');
        const handleCloseClick = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', handleCloseClick);
        };
        
        closeBtn.addEventListener('click', handleCloseClick);
    };
    
    // Delete page function
    const deletePage = async (e) => {
        const pageId = e.currentTarget.dataset.pageId;
        const modal = document.getElementById('delete-confirm-modal');
        
        try {
            // Show loading state
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            const response = await fetch(`${API_URL}/pages/${pageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete page');
            }
            
            // Close modal
            modal.classList.remove('active');
            
            // Show success message
            showNotification({
                title: 'Page Deleted',
                message: 'Your page has been deleted successfully.',
                type: 'success'
            });
            
            // Remove the deleted page from allPages array
            allPages = allPages.filter(page => page.page_id !== pageId);
            
            // Re-render the pages without making another API call
            const sortMethod = document.getElementById('sort-pages').value;
            const query = document.getElementById('search-pages')?.value || '';
            const filteredPages = searchPages(query, allPages);
            renderPages(filteredPages, sortMethod);
        } catch (error) {
            console.error('Error deleting page:', error);
            
            showNotification({
                title: 'Delete Failed',
                message: 'Failed to delete the page. Please try again.',
                type: 'error'
            });
            
            // Reset button state
            e.currentTarget.disabled = false;
            e.currentTarget.innerHTML = '<i class="fas fa-trash"></i> Delete';
        }
    };
    
    // Show notification
    const showNotification = ({ title, message, type = 'info', duration = 5000 }) => {
        const container = document.querySelector('.notification-container');
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Icon based on type
        let icon;
        switch (type) {
            case 'success':
                icon = 'fas fa-check-circle';
                break;
            case 'error':
                icon = 'fas fa-exclamation-circle';
                break;
            case 'warning':
                icon = 'fas fa-exclamation-triangle';
                break;
            default:
                icon = 'fas fa-info-circle';
        }
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <p class="notification-message">${message}</p>
            </div>
            <button class="notification-close" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
            <div class="notification-progress"></div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Set up close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });
        
        // Auto-close after duration
        const timeoutId = setTimeout(() => {
            closeNotification(notification);
        }, duration);
        
        // Store timeout ID to cancel if manually closed
        notification.dataset.timeoutId = timeoutId;
        
        // Function to close notification
        function closeNotification(notif) {
            // Clear timeout if it exists
            if (notif.dataset.timeoutId) {
                clearTimeout(parseInt(notif.dataset.timeoutId));
            }
            
            // Remove show class to trigger exit animation
            notif.classList.remove('show');
            
            // Remove from DOM after animation completes
            setTimeout(() => {
                notif.remove();
            }, 300);
        }
    };
    
    // Search pages functionality
    const searchPages = (query, pages) => {
        if (!query) return pages;
        
        query = query.toLowerCase();
        return pages.filter(page => 
            (page.title && page.title.toLowerCase().includes(query)) || 
            (page.url && page.url.toLowerCase().includes(query))
        );
    };
    
    // Debounce function to limit how often a function can be called
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    // Initialize page
    const initPagesPage = async () => {
        try {
            // Load user data
            await loadUserData();
            
            // Load all pages
            allPages = await loadAllPages();
            
            // Initial render
            const defaultSort = 'views'; // Changed from 'newest' to 'views'
            renderPages(allPages, defaultSort);
            
            // Set up search functionality with debounce
            const searchInput = document.getElementById('search-pages');
            if (searchInput) {
                const handleSearch = debounce(() => {
                    const query = searchInput.value;
                    const filteredPages = searchPages(query, allPages);
                    const sortMethod = document.getElementById('sort-pages').value;
                    renderPages(filteredPages, sortMethod);
                }, 300);
                
                searchInput.addEventListener('input', handleSearch);
            }
            
            // Set up sort functionality
            const sortSelect = document.getElementById('sort-pages');
            if (sortSelect) {
                // Set default value
                sortSelect.value = defaultSort;
                
                sortSelect.addEventListener('change', () => {
                    const sortMethod = sortSelect.value;
                    const query = document.getElementById('search-pages')?.value || '';
                    const filteredPages = searchPages(query, allPages);
                    renderPages(filteredPages, sortMethod);
                });
            }
        } catch (error) {
            console.error('Error initializing page:', error);
            showNotification({
                title: 'Error',
                message: 'There was an error loading your pages. Please try refreshing.',
                type: 'error'
            });
            
            const pagesList = document.getElementById('pages-list');
            pagesList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error Loading Pages</h3>
                    <p>There was a problem loading your pages. Please try again later.</p>
                    <button id="retry-load-btn" class="btn btn-primary">Retry</button>
                </div>
            `;
            
            const retryBtn = document.getElementById('retry-load-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', initPagesPage);
            }
        }
    };
    
    // Start the initialization
    initPagesPage();
});