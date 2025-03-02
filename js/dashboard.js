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
    
    // Load user data
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
            
            // Update dashboard stats
            document.getElementById('pages-count').textContent = userData.page_count;
            
            // Format joined date
            const joinedDate = new Date(userData.joined_at);
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            document.getElementById('joined-date').textContent = joinedDate.toLocaleDateString('en-US', options);
            
            // If user hasn't completed onboarding, redirect
            if (!userData.username) {
                window.location.href = 'onboarding.html';
            }
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };
    
    // Load user's pages
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
            
            // Update total views count
            let totalViews = 0;
            
            // Display recent pages (up to 3)
            const recentPagesGrid = document.getElementById('recent-pages-grid');
            const noPages = document.getElementById('no-pages');
            
            if (pages.length > 0) {
                noPages.style.display = 'none';
                
                // Clear existing content
                recentPagesGrid.innerHTML = '';
                
                // Get views for each page
                for (const page of pages.slice(0, 3)) { // Show only up to 3 recent pages
                    const viewsResponse = await fetch(`${API_URL}/views/${page.url}`);
                    const viewsData = await viewsResponse.json();
                    const views = viewsData.views;
                    
                    totalViews += views;
                    
                    // Create page card
                    const pageCard = document.createElement('div');
                    pageCard.className = 'page-card';
                    
                    pageCard.innerHTML = `
                        <div class="page-header">
                            <h3>${page.title}</h3>
                            <div class="page-actions">
                                <a href="customize.html?page_id=${page.page_id}" class="btn btn-sm btn-icon" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </a>
                                <a href="https://versz.fun/p/${page.url}" class="btn btn-sm btn-icon" target="_blank" title="View">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            </div>
                        </div>
                        <div class="page-url">versz.fun/p/${page.url}</div>
                        <div class="page-stats">
                            <div class="stat">
                                <i class="fas fa-eye"></i> ${views} views
                            </div>
                            <div class="stat">
                                <i class="fas fa-layer-group"></i> ${page.layout.type}
                            </div>
                        </div>
                    `;
                    
                    recentPagesGrid.appendChild(pageCard);
                }
                
                // Update total views display
                document.getElementById('total-views').textContent = totalViews;
            }
        } catch (error) {
            console.error('Error loading pages:', error);
        }
    };
    
    // Initialize dashboard
    const initDashboard = async () => {
        const userData = await loadUserData();
        if (userData) {
            await loadUserPages();
        }
    };
    
    initDashboard();
});