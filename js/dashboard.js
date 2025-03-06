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
    
    // Format number with comma separators
    const formatNumber = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
    
    // Load user data
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
            
            // Update dashboard stats
            const pagesCountElement = document.getElementById('pages-count');
            pagesCountElement.innerHTML = formatNumber(userData.page_count || 0);
            
            // Format joined date
            const joinedDate = new Date(userData.joined_at);
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const joinedDateElement = document.getElementById('joined-date');
            joinedDateElement.innerHTML = joinedDate.toLocaleDateString('en-US', options);
            
            // If user hasn't completed onboarding, redirect
            if (!userData.username) {
                showNotification({
                    title: 'Welcome to Versz',
                    message: 'Please complete your profile setup to continue.',
                    type: 'info'
                });
                
                setTimeout(() => {
                    window.location.href = 'onboarding.html';
                }, 2000);
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
    
    // Load user's pages
    const loadUserPages = async () => {
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
            
            // Update total views count
            let totalViews = 0;
            
            // Display recent pages (up to 3)
            const recentPagesGrid = document.getElementById('recent-pages-grid');
            const noPages = document.getElementById('no-pages');
            
            // Remove skeleton loaders
            const skeletons = recentPagesGrid.querySelectorAll('.skeleton');
            skeletons.forEach(skeleton => {
                skeleton.remove();
            });
            
            if (pages.length > 0) {
                noPages.style.display = 'none';
                
                // Get views for each page
                const viewsPromises = pages.slice(0, 3).map(page => 
                    fetch(`${API_URL}/views/${page.url}`)
                        .then(res => res.json())
                        .then(data => ({ page, views: data.views || 0 }))
                        .catch(() => ({ page, views: 0 }))
                );
                
                const pagesWithViews = await Promise.all(viewsPromises);
                
                // Calculate total views
                totalViews = pagesWithViews.reduce((sum, { views }) => sum + views, 0);
                
                // Update total views display
                document.getElementById('total-views').textContent = formatNumber(totalViews);
                
                // Create page cards
                pagesWithViews.forEach(({ page, views }) => {
                    // Create page card
                    const pageCard = document.createElement('div');
                    pageCard.className = 'page-card';
                    
                    // Format layout type for display
                    const layoutType = page.layout?.type || 'standard';
                    const formattedLayoutType = layoutType.charAt(0).toUpperCase() + layoutType.slice(1);
                    
                    pageCard.innerHTML = `
                        <div class="page-header">
                            <h3>${page.title || 'Untitled Page'}</h3>
                            <div class="page-actions">
                                <a href="customize.html?page_id=${page.page_id}" class="btn btn-sm btn-icon" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </a>
                                <a href="https://versz.fun/${page.url}" class="btn btn-sm btn-icon" target="_blank" title="View">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            </div>
                        </div>
                        <a href="https://versz.fun/${page.url}" class="page-url" target="_blank">versz.fun/${page.url}</a>
                        <div class="page-stats">
                            <div class="stat">
                                <i class="fas fa-eye"></i> ${formatNumber(views)} views
                            </div>
                            <div class="stat">
                                <i class="fas fa-layer-group"></i> ${formattedLayoutType}
                            </div>
                        </div>
                    `;
                    
                    recentPagesGrid.appendChild(pageCard);
                });
            } else {
                // Show empty state
                noPages.style.display = 'flex';
                document.getElementById('total-views').textContent = '0';
            }
        } catch (error) {
            console.error('Error loading pages:', error);
            
            // Show error in the pages grid
            const recentPagesGrid = document.getElementById('recent-pages-grid');
            
            // Remove skeleton loaders
            const skeletons = recentPagesGrid.querySelectorAll('.skeleton');
            skeletons.forEach(skeleton => {
                skeleton.remove();
            });
            
            // Add error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'empty-state';
            errorMessage.style.display = 'flex';
            errorMessage.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error Loading Pages</h3>
                <p>We couldn't load your pages. Please try refreshing the page.</p>
                <button class="btn btn-primary" onclick="location.reload()">Refresh</button>
            `;
            recentPagesGrid.appendChild(errorMessage);
            
            showNotification({
                title: 'Error',
                message: 'Failed to load your pages. Please try again.',
                type: 'error'
            });
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
    
    // Initialize dashboard
    const initDashboard = async () => {
        try {
            const userData = await loadUserData();
            if (userData) {
                await loadUserPages();
            }
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showNotification({
                title: 'Error',
                message: 'Failed to initialize dashboard. Please refresh the page.',
                type: 'error'
            });
        }
    };
    
    // Start initialization
    initDashboard();
});
