document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://api.versz.fun';
    let allPages = [];
    let currentPageId = null;
    let currentCharts = {
        views: null,
        countries: null,
        hourly: null
    };
    
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
    
    // Populate page select dropdown
    const populatePageSelect = (pages) => {
        const pageSelect = document.getElementById('page-select');
        
        // Clear any existing options except the default
        while (pageSelect.options.length > 1) {
            pageSelect.remove(1);
        }
        
        // Add pages to dropdown
        pages.forEach(page => {
            const option = document.createElement('option');
            option.value = page.page_id;
            option.textContent = page.title || 'Untitled Page';
            pageSelect.appendChild(option);
        });
        
        // Add event listener for page selection
        pageSelect.addEventListener('change', () => {
            const pageId = pageSelect.value;
            if (pageId) {
                currentPageId = pageId;
                loadAnalyticsData(pageId);
            } else {
                // Show no page selected state
                document.getElementById('no-page-selected').style.display = 'flex';
                document.getElementById('analytics-content').style.display = 'none';
                document.getElementById('analytics-loading').style.display = 'none';
                document.getElementById('analytics-error').style.display = 'none';
            }
        });
    };
    
    // Load analytics data for a specific page
    const loadAnalyticsData = async (pageId) => {
        // Show loading state
        document.getElementById('no-page-selected').style.display = 'none';
        document.getElementById('analytics-content').style.display = 'none';
        document.getElementById('analytics-loading').style.display = 'flex';
        document.getElementById('analytics-error').style.display = 'none';
        
        try {
            const dateRange = document.getElementById('date-range').value;
            
            const response = await fetch(`${API_URL}/analytics/${pageId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch analytics data');
            }
            
            const analyticsData = await response.json();
            
            // Hide loading state, show content
            document.getElementById('analytics-loading').style.display = 'none';
            document.getElementById('analytics-content').style.display = 'block';
            
            // Update analytics UI
            updateAnalyticsUI(analyticsData);
            
        } catch (error) {
            console.error('Error loading analytics data:', error);
            
            // Show error state
            document.getElementById('analytics-loading').style.display = 'none';
            document.getElementById('analytics-error').style.display = 'flex';
            
            const retryBtn = document.getElementById('retry-load-btn');
            if (retryBtn) {
                // Remove existing event listeners
                const newRetryBtn = retryBtn.cloneNode(true);
                retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);
                
                // Add new event listener
                newRetryBtn.addEventListener('click', () => {
                    loadAnalyticsData(pageId);
                });
            }
        }
    };
    
    // Update analytics UI with data
    const updateAnalyticsUI = (data) => {
        // Update stat cards
        document.getElementById('total-views').textContent = data.total_views.toLocaleString();
        
        // Calculate countries count
        const countryCount = Object.keys(data.countries).length;
        document.getElementById('total-countries').textContent = countryCount;
        
        // Calculate device percentages from recent visits
        let desktopCount = 0;
        let mobileCount = 0;
        
        data.recent_views.forEach(view => {
            if (view.device_type === 'desktop') {
                desktopCount++;
            } else if (view.device_type === 'mobile' || view.device_type === 'tablet') {
                mobileCount++;
            }
        });
        
        const totalDevices = desktopCount + mobileCount;
        const desktopPercentage = totalDevices > 0 ? Math.round((desktopCount / totalDevices) * 100) : 0;
        const mobilePercentage = totalDevices > 0 ? Math.round((mobileCount / totalDevices) * 100) : 0;
        
        document.getElementById('desktop-percentage').textContent = `${desktopPercentage}%`;
        document.getElementById('mobile-percentage').textContent = `${mobilePercentage}%`;
        
        // Update views chart
        updateViewsChart(data.daily_views);
        
        // Update countries chart
        updateCountriesChart(data.countries);
        
        // Update hourly distribution chart
        updateHourlyChart(data.hourly_distribution);
        
        // Update recent visits table
        updateRecentVisitsTable(data.recent_views);
    };
    
    // Update views chart
    const updateViewsChart = (dailyViews) => {
        const ctx = document.getElementById('views-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (currentCharts.views) {
            currentCharts.views.destroy();
        }
        
        // Sort dates
        const sortedDates = Object.keys(dailyViews).sort();
        const viewsData = sortedDates.map(date => dailyViews[date]);
        
        // Format dates for display
        const formattedDates = sortedDates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        // Create new chart
        currentCharts.views = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [{
                    label: 'Views',
                    data: viewsData,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true,
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                return sortedDates[tooltipItems[0].dataIndex];
                            }
                        }
                    }
                }
            }
        });
    };
    
    // Update countries chart
    const updateCountriesChart = (countriesData) => {
        const ctx = document.getElementById('countries-chart').getContext('2d');
        const noCountryData = document.getElementById('no-country-data');
        
        // Check if there's any country data
        if (Object.keys(countriesData).length === 0) {
            noCountryData.style.display = 'flex';
            return;
        } else {
            noCountryData.style.display = 'none';
        }
        
        // Destroy existing chart if it exists
        if (currentCharts.countries) {
            currentCharts.countries.destroy();
        }
        
        // Parse country data
        const countries = [];
        const counts = [];
        const backgroundColors = [];
        
        // Generate random colors for each country
        const getRandomColor = () => {
            const letters = '0123456789ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        };
        
        // Sort countries by count (descending)
        const sortedCountries = Object.entries(countriesData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Limit to top 10
        
        sortedCountries.forEach(([countryCode, count]) => {
            const [code, name] = countryCode.split(':');
            countries.push(name || code);
            counts.push(count);
            backgroundColors.push(getRandomColor());
        });
        
        // Create new chart
        currentCharts.countries = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: countries,
                datasets: [{
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    };
    
    // Update hourly distribution chart
    const updateHourlyChart = (hourlyData) => {
        const ctx = document.getElementById('hourly-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (currentCharts.hourly) {
            currentCharts.hourly.destroy();
        }
        
        // Prepare data for all 24 hours (even if some hours have no data)
        const hours = Array.from({length: 24}, (_, i) => i);
        const hourLabels = hours.map(hour => `${hour.toString().padStart(2, '0')}:00`);
        const viewsData = hours.map(hour => {
            const hourKey = `${hour.toString().padStart(2, '0')}:00`;
            return hourlyData[hourKey] || 0;
        });
        
        // Create new chart
        currentCharts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Views',
                    data: viewsData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                return `Hour: ${tooltipItems[0].label}`;
                            }
                        }
                    }
                }
            }
        });
    };
    
    // Update recent visits table
    const updateRecentVisitsTable = (recentViews) => {
        const tableBody = document.getElementById('visits-table-body');
        const noVisitsEl = document.getElementById('no-visits');
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        if (!recentViews || recentViews.length === 0) {
            noVisitsEl.style.display = 'flex';
            return;
        }
        
        noVisitsEl.style.display = 'none';
        
        // Add new rows
        recentViews.forEach(visit => {
            const row = document.createElement('tr');
            
            // Format date
            const visitDate = new Date(visit.timestamp);
            const formattedDate = visitDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Format country
            const country = visit.country_name || 'Unknown';
            const countryCode = visit.country_code || '';
            const countryDisplay = countryCode ? `${country} (${countryCode})` : country;
            
            // Format device and browser
            const device = visit.device_type ? visit.device_type.charAt(0).toUpperCase() + visit.device_type.slice(1) : 'Unknown';
            const browser = visit.browser || 'Unknown';
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${countryDisplay}</td>
                <td>${device}</td>
                <td>${browser}</td>
            `;
            
            tableBody.appendChild(row);
        });
    };
    
    // Handle date range change
    const setupDateRangeSelector = () => {
        const dateRangeSelect = document.getElementById('date-range');
        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', () => {
                if (currentPageId) {
                    loadAnalyticsData(currentPageId);
                }
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
    
    // Initialize page
    const initAnalyticsPage = async () => {
        try {
            // Load user data
            await loadUserData();
            
            // Load all pages
            const pages = await loadAllPages();
            
            // Populate page select dropdown
            populatePageSelect(pages);
            
            // Setup date range selector
            setupDateRangeSelector();
            
            // Check if a page is specified in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const pageId = urlParams.get('page_id');
            
            if (pageId) {
                // Check if this page exists in the user's pages
                const pageExists = pages.some(page => page.page_id === pageId);
                
                if (pageExists) {
                    // Select this page in the dropdown
                    document.getElementById('page-select').value = pageId;
                    
                    // Load analytics for this page
                    currentPageId = pageId;
                    loadAnalyticsData(pageId);
                } else {
                    // Show no page selected state
                    document.getElementById('no-page-selected').style.display = 'flex';
                }
            } else {
                // Show no page selected state
                document.getElementById('no-page-selected').style.display = 'flex';
            }
            
        } catch (error) {
            console.error('Error initializing page:', error);
            showNotification({
                title: 'Error',
                message: 'There was an error initializing the analytics page. Please try refreshing.',
                type: 'error'
            });
        }
    };
    
    // Start the initialization
    initAnalyticsPage();
});